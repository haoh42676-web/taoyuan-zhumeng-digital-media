// Run deliberately when replacing the source archive, never during service startup.
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext(await read('source-data.js'),context);
vm.runInContext((await read('project-data.js'))+';globalThis.project={productData,scenarioData,traceData,ipData}',context);
const app=await read('app.js');
vm.runInContext(app.slice(app.indexOf('const groups='),app.indexOf('function factRows')),context);
vm.runInContext(app.slice(app.indexOf('const slides='),app.indexOf('function renderCompetition')),context);
const groups=vm.runInContext('groups',context),slides=vm.runInContext('slides',context),{project}=context;
const records=[];
const add=(module,slug,data,sort_order=records.length)=>records.push({module,slug,data,sort_order});
const pageTitles={home:['HOME','数商桃乡，让好桃被看见','看真实桃园，选合适规格，让小桃满陪你问清一箱桃。商品咨询、内容复核与售后回访，在这里连成一条完整的体验。']};
const routeFns={renderEvidence:'evidence',renderConsumer:'consumer',renderTrace:'trace',renderIP:'ip',renderOperator:'operator',renderContent:'content',renderRural:'rural',renderService:'service',renderCompetition:'competition',renderRecords:'records',renderAPI:'api'};
for(const [fn,route]of Object.entries(routeFns)){const segment=app.slice(app.indexOf('function '+fn+'('));const match=segment.match(/return shell\('([^']*)','([^']*)','([^']*)'/);if(match)pageTitles[route]=match.slice(1);}
for(const [slug,[kicker,title,intro]]of Object.entries(pageTitles))add('pages',slug,{kicker,title,intro,body:'',image:'',sourceRef:'项目现有演示模型'});
for(const p of project.productData)add('products',p.id,{...p,sourceRef:'icanAIOPC 商品方案；参考价，实际批次待确认'});
for(const [slug,p]of Object.entries(project.scenarioData))add('scenarios',slug,{...p,productId:project.productData.find(x=>x.name===p.product).id});
for(const [slug,[title,description,owner,state]]of Object.entries(project.traceData))add('trace_steps',slug,{title,description,owner,state});
add('batches','SP-2026-06',{batchId:'SP-2026-06',status:'example',originName:'连平县上坪镇（示例，待核验）',shippingOrigin:'',harvestDate:'',stock:null,shippingFee:null,shippingWindow:'',grading:'',shippingRegions:'',aftercareRule:'',owner:'',sourceRef:'演示流程，非真实采摘记录',verifiedAt:''});
add('ip_profile','xiaotaoman',{name:'小桃满',identity:'上坪桃林守护人、品牌好物推荐官',tone:'真诚 · 细致 · 有点俏皮',image:'assets/xiaotaoman.png',description:'讲产地、讲规格，也提醒发货和保存。',guide:'以icanAIOPC策划书4.2和项目现有素材为基准。保留桃形、草帽及服饰识别特征。角色故事不替代地方史或产地证据；背景图不作为真实产地证据。不虚构库存、检测或效果。',sourceRef:'icanAIOPC 策划书4.2'});
const voices={season:'跟我看一段果园日常。画面是哪一天拍的、属于哪一批，我们一起记清楚。',package:'拆箱前先看说明卡：规格、保存方式和售后入口，都留在同一个地方。',social:'想要脆一点，还是送给家人？先说说需要，再确认这一批适不适合。',live:'先别急着拍。把这一批的规格、到手总价和发货安排问清楚。',care:'收到桃先看外箱和果品；遇到问题，把照片和情况一起留给运营。',tour:'先了解果园开放安排，再计划出行。现在可以记录意向，确认后再出发。'};
for(const [slug,data]of Object.entries(project.ipData))add('ip_series',slug,{...data,voice:voices[slug],sourceRef:'icanAIOPC 策划书4.2及项目素材'});
for(const [slug,g]of Object.entries(groups))add('research_sets',slug,{...g,metrics:g.metrics.map(m=>slug==='farmer'?m:[m[0],m[1],null,m[2]])});
for(const dataset of ['consumer','opc']){
 const dimensions=new Map();
 for(const row of context.window.PeachSurveyData[dataset]){
  const matrix=row.type==='矩阵量表';
  if(matrix&&!dimensions.has(row.option))dimensions.set(row.option,dimensions.size+1);
  const option=matrix?row.label.split(' ')[0]:row.option,dimension=matrix?row.option:'';
  add('survey_rows',`${dataset}-${row.question}-${matrix?'m'+dimensions.get(row.option)+'-':''}${option}`,{...row,option,dimension,dataset,denominator:groups[dataset].n,sourceRef:groups[dataset].source});
 }
}
for(const [q,count,n,label]of groups.farmer.metrics)add('survey_rows',`farmer-${q}-summary`,{dataset:'farmer',question:q,type:'引用指标',option:'summary',label,dimension:'',count,denominator:n,sourceRef:groups.farmer.source});
for(const [slug,title,type,body,sourceRef]of [
 ['citizen','河源市民访谈','qualitative','理解购买场景与沟通需求，个人经历不能计入团队销量。','附件01'],
 ['enterprise','企业负责人访谈','oral_estimate','分拣、物流与短销售季提示经营约束；48小时冷链讨论不构成配送承诺。投流、产量和运费均为口述估计。','附件02'],
 ['collection','30人次访谈汇编','qualitative','与独立访谈可能重合，不简单相加。80／120／150箱采购经历不属于团队交易。未经账目核验不写成经营实绩。','附件06']])add('interviews',slug,{title,type,body,sourceRef});
add('tours','tour-shangping',{name:'一日桃乡',description:'接待日期、人员与容量待合作方核验。可以记录出行意向，之后再确认。',stops:[['桃园观察','认识花期、套袋和成熟节奏；开放日期、人数和安全条件待确认。'],['分拣体验','认识规格分级与包装；指导人员、时长和卫生规范待确认。'],['集市与礼盒','产地记忆进入礼盒和回访；商品按当季批次确认。']],openDates:[],capacity:null,bookingAvailable:false,conditions:'提交意向不锁定名额、不收费，也不代表果园已接受预约。',sourceRef:'项目路线设计，开放安排待确认'});
for(const [i,[question,answer]]of [['什么时候发货？','鲜果按成熟度分批采摘。具体日期、区域与运费按可售批次确认；问卷的48小时情境不是配送承诺。'],['收到后如何保存？','先检查外箱和果品，按随箱的当批食用指南保存。没有明确温度与时长时，不用演示文案代替正式指南。'],['有破损或物流问题怎么办？','保留外箱、面单与果品照片，及时联系运营，按购买前公开的批次规则核验。反馈提交不等于已确认赔付。']].entries())add('faqs','faq-'+i,{question,answer,sourceRef:'项目服务说明，按实际批次确认'});
for(const [slug,title,image]of [['wechat','微信咨询','contact-safe.png'],['douyin','抖音看果园','contact-safe.png'],['xhs','小红书看礼盒','contact-safe.png']])add('social',slug,{title,image:'assets/'+image,description:'个人联系二维码已移除，请使用本站商品咨询或售后反馈表单联系运营。',sourceRef:'项目现有社交入口'});
slides.forEach((s,i)=>add('slides','slide-'+i,{...s,image:'assets/'+s.image}));
for(const [slug,title,body]of [['video','短视频脚本','镜头1｜带日期的真实素材\n{title}\n{copy}\n小桃满提醒：{voice}\n行动：先核对到手总价、运费与发货窗口，再留下咨询意向。'],['live','直播讲解','开场｜先看批次与规格\n{title}\n{copy}\n小桃满提醒：{voice}\n行动：先核对到手总价、运费与发货窗口，再留下咨询意向。'],['group','社群通知','社群通知｜{title}\n{copy}\n小桃满提醒：{voice}\n行动：先核对到手总价、运费与发货窗口，再留下咨询意向。'],['card','随箱说明卡','小桃满的随箱提醒\n批次号：[当批填写]\n产地与采摘日：[核验后填写]\n净重／个数／分级：[按实填写]\n保存指南：[按当批说明填写]\n破损反馈：留存外箱、面单与果品照片，按批次规则核验。']])add('templates',slug,{title,channel:slug,body,sourceRef:'项目渠道内容结构模板，未调用在线AI'});
add('settings','site',{brand:'数商桃乡',slogan:'数商桃乡，让好桃被看见',heroIntro:pageTitles.home[2],heroNote:'商品参考方案与示例批次有明确状态标识，实际履约需按批次确认。',heroPhoto:'assets/origin-walk.jpeg',ipImage:'assets/xiaotaoman.png',proofs:[['206','产业端受访者','159户自有果园 + 47名代管者'],['243','消费者有效样本','购买偏好与首购阻力'],['437','学生与 OPC 调查','其中351人在校'],['1 批桃','从采摘到回访','示例流程，非实际经营数据']],analyticsEnabled:true,analyticsRetentionDays:180,requestRetentionDays:30,privacyNotice:'本站保存你主动提交的咨询、售后与出行意向，以便项目运营跟进；不在公开页面展示个人记录。访问统计使用匿名标识，不记录完整IP或表单正文。可在页脚关闭访问统计。清除浏览器Cookie后将无法自动找回此前记录，请保留记录编号。',contact:'桃源筑梦团队'});
await writeFile(new URL('../server/seed-data.json',import.meta.url),JSON.stringify(records,null,2)+'\n');
console.log(`Prepared ${records.length} source records across ${new Set(records.map(x=>x.module)).size} modules.`);
