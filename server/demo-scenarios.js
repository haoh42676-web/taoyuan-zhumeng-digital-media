import {createHash} from 'node:crypto';
import {one} from './db.js';
import {validateContent} from './modules.js';
import {WORKFLOWS} from './workflow-schema.js';

const KEY='demo_scenarios_v3';
const dayCN=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
const ago=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const initial=(kind,today)=>Object.fromEntries(WORKFLOWS[kind].fields.map(f=>[f.key,f.type==='checkbox'?false:f.type==='number'?0:f.type==='select'?Object.keys(f.options)[0]:f.type==='date'?today:'']));

/** Only used by the isolated demo app. Add examples without replacing visitor edits. */
export async function seedDemoScenarios(db,{today=dayCN()}={}){
 await db.transaction(async tx=>{
  if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362018)');
  if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362011)');
  const actor=await one(tx,"SELECT id FROM users WHERE email='test1'");
  if(!actor)throw Error('Demo identity required before installing simulation scenarios');
  const manifest=(await one(tx,'SELECT value FROM app_meta WHERE key=$1',[KEY]))?.value||{day:'',signatures:{}};
  if(manifest.day===today)return;
  const signatures={...manifest.signatures},oldSignatures=manifest.signatures||{};
  const keep=async(table,id,payload,insert)=>{
   const old=await one(tx,'SELECT * FROM '+table+' WHERE id=$1 FOR UPDATE',[id]),key=table+':'+id;
   if(!old){await insert();signatures[key]=hash(payload);return;}
   const current=table==='content_items'?{title:old.title,data:old.draft}:table==='workflow_items'?{title:old.title,data:old.data}:null;
   if(current&&old.version===1&&oldSignatures[key]===hash(current)){
    if(table==='content_items')await tx.query('UPDATE content_items SET title=$2,draft=$3,published=$3 WHERE id=$1',[id,payload.title,JSON.stringify(payload.data)]);
    else await tx.query('UPDATE workflow_items SET title=$2,data=$3 WHERE id=$1',[id,payload.title,JSON.stringify(payload.data)]);
    signatures[key]=hash(payload);
   }
  };
  const flow=async(kind,id,title,extra)=>{
   const data={...initial(kind,today),...extra},payload={title:'【模拟】'+title,data};
   await keep('workflow_items',id,payload,()=>tx.query('INSERT INTO workflow_items(id,kind,title,data,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[id,kind,payload.title,JSON.stringify(data),actor.id]));
  };
  const batches={};
  for(const [id,productId,total,status,grading] of [
   ['DEMO-V3-FAMILY','fresh-5',120,'verified','模拟5斤家庭装'],
   ['DEMO-V3-TASTER','fresh-2',8,'verified','模拟2.5斤尝鲜装'],
   ['DEMO-V3-GIFT','gift-12',2,'verified','模拟12个礼盒'],
   ['DEMO-V3-GROUP','group-8',40,'verified','模拟8斤团购装'],
   ['DEMO-V3-PENDING','gift-max',null,'pending','模拟特大果，仍待核对']
  ]){
   const data=validateContent('batches',{batchId:id,productId,status,stock:total,originName:'模拟果园（非真实产地证明）',shippingOrigin:'模拟分拣点',harvestDate:ago(today,7),shippingFee:0,shippingWindow:'合成场景日期，不构成实际采摘或发货承诺',grading,shippingRegions:'模拟省级配送范围；金额只供流程演练',aftercareRule:'模拟售后：留存外箱、面单与果品照片，人工核验后登记处理，不执行扣款或退款。',owner:'模拟运营审核人',sourceRef:'DEMO-V3系统合成，不是库存、认证或经营实绩',verifiedAt:status==='verified'?ago(today,7):'',verificationCode:id+'-CODE'});
   const payload={title:'【模拟】'+grading+(status==='pending'?' · 待核验':''),data};
   await keep('content_items','batches--'+id,payload,()=>tx.query("INSERT INTO content_items(id,module,slug,title,draft,published,status) VALUES($1,'batches',$2,$3,$4,$4,'published') ON CONFLICT(id) DO NOTHING",['batches--'+id,id,payload.title,JSON.stringify(data)]));batches[id]=data;
  }
  for(const [id,name,type,skill] of [['STUDENT','模拟学生A','student','IP说明卡与批次事实整理'],['FARMER','模拟桃农B','farmer','产品事实确认，不代替运营审核'],['OPERATOR','模拟协作者C','operator','售后核验演练与内容复核']])await flow('collaborators','DEMO-V3-'+id,name,{name,type,expertise:skill,training:'模拟培训：来源核对、隐私保护、规格与配送口径；非真实人员履历。',active:true,sourceRef:'DEMO-V3合成人员，不创建真实登录账号'});
  for(const [i,segment,region,intent,consent]of [[0,'family','广东','interested',false],[1,'gift','福建','later',false],[2,'group','江西','interested',true],[3,'family','广西','unknown',false]]){
   await tx.query("INSERT INTO business_records(id,kind,visitor_hash,data,status,reply) VALUES($1,'consultation',$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",['DEMO-V3-CONSULT-'+i,'DEMO-V3-VISITOR-'+i,JSON.stringify({name:'模拟访客'+(i+1),region,contact:'演示站内联系；无真实号码',productId:['fresh-5','gift-12','group-8','fresh-2'][i],quantity:1,note:'【模拟】咨询规格、总价、批次与配送条件；未发生真实成交。',consent:true}),i%2?'processing':'pending','【模拟】已登记问题，等待对应负责人确认。']);
   await flow('customers','DEMO-V3-CUSTOMER-'+i,'客户卡'+(i+1),{name:'模拟客户'+(i+1),region,contact:'无真实联系方式',sourceRecordId:'DEMO-V3-CONSULT-'+i,segment,tags:'到手总价、果品完好、信息完整',repurchaseIntent:intent,marketingConsent:consent,consentRef:consent?'模拟单独授权记录（非实际授权）':'',contactPurpose:consent?'marketing':'service',followupDate:today,nextAction:'模拟服务回访；只登记，不发送消息。',followupResult:'模拟偏好记录，不能推断真实购买意愿。',sourceRef:'DEMO-V3合成客户卡'});
  }
  const configs=[
   ['01','fresh-5','DEMO-V3-FAMILY',2,65,8,'completed',6,0,0],
   ['02','gift-12','DEMO-V3-GIFT',1,68,10,'completed',5,0,1],
   ['03','group-8','DEMO-V3-GROUP',3,88,0,'completed',4,0,2],
   ['04','fresh-2','DEMO-V3-TASTER',2,39,8,'completed',3,6,3],
   ['05','fresh-5','DEMO-V3-FAMILY',1,65,8,'completed',2,0,0],
   ['06','gift-12','DEMO-V3-GIFT',1,68,10,'completed',1,0,1],
   ['07','group-8','DEMO-V3-GROUP',2,88,0,'completed',0,0,2],
   ['08','fresh-2','DEMO-V3-TASTER',1,39,8,'confirmed',0,0,3],
   ['09','fresh-5','DEMO-V3-FAMILY',2,65,8,'shipped',0,0,0],
   ['10','group-8','DEMO-V3-GROUP',1,88,0,'draft',0,0,2],
   ['11','fresh-5','DEMO-V3-FAMILY',1,65,8,'cancelled',0,73,0]
  ];
  for(const [code,productId,batchId,quantity,unitPrice,shippingCharged,status,days,refundAmount,customer]of configs){
   const product=(await one(tx,"SELECT published FROM content_items WHERE module='products' AND slug=$1 AND status!='archived'",[productId]))?.published;
   if(!product)continue;
   const date=ago(today,days),paid=status==='draft'?0:quantity*unitPrice+shippingCharged;
   await flow('orders','DEMO-V3-ORDER-'+code,product.name+' · '+({draft:'待核对',confirmed:'已核实',shipped:'已发货',completed:'已签收',cancelled:'已取消'}[status]),{title:'【模拟】'+product.name+'订单'+code,customerId:'DEMO-V3-CUSTOMER-'+customer,sourceRecordId:'DEMO-V3-CONSULT-'+customer,productId,batchId,status,channel:['wechat','offline','xhs','video'][customer],externalOrderNo:'DEMO-V3-EXTERNAL-'+code,sourceRef:'DEMO-V3合成成交凭据；未收款、未发货',quantity,unitPrice,shippingCharged,receivedAmount:paid,refundAmount,goodsCost:status==='draft'||status==='cancelled'?0:quantity*25,packagingCost:status==='draft'||status==='cancelled'?0:5,logisticsCost:status==='draft'||status==='cancelled'?0:8,otherCost:0,shippingRegion:['广东','福建','江西','广西'][customer],carrier:['shipped','completed'].includes(status)?'模拟承运方':'',trackingNo:['shipped','completed'].includes(status)?'DEMO-V3-TRACK-'+code:'',shippedAt:['shipped','completed'].includes(status)?date:'',receivedAt:status==='completed'?date:'',receiptRef:status==='completed'?'DEMO-V3模拟签收凭据':'',note:'【模拟】全流程合成记录，日期仅用于图表；'+(refundAmount?'含模拟退款登记，不产生实际退款。':'不表示真实成交或当季供应。'),productSnapshot:{name:product.name,sourceRef:'模拟商品快照'},batchSnapshot:batches[batchId]});
  }
  for(const [i,kind,status,note]of [[0,'claim','pending','模拟破损反馈，待补充开箱照片'],[1,'claim','processing','模拟规格疑问，运营正在核对批次'],[2,'claim','resolved','模拟已登记6元退款凭据，不发生实际退款'],[3,'tour','pending','模拟参访意向，人数和时段待人工确认'],[4,'tour','processing','模拟合作走访意向，不代表预约成功']])await tx.query('INSERT INTO business_records(id,kind,visitor_hash,data,status,reply) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',['DEMO-V3-SERVICE-'+i,kind,'DEMO-V3-VISITOR-'+(i%4),JSON.stringify({name:'模拟访客'+(i%4+1),region:'广东',contact:'无真实联系方式',productId:'fresh-2',productName:'模拟尝鲜装',batchId:'DEMO-V3-TASTER',quantity:1,issue:'damage',date:today,people:2,note:'【模拟】'+note,consent:true}),status,'【模拟】'+note+'；系统只记录，不执行对外服务。']);
  for(const [i,type,body]of [[0,'consumer','模拟咨询反复询问到手总价，建议补齐商品与运费拆分。'],[1,'fulfillment','模拟售后涉及开箱照片缺失，先完善提交指引。'],[2,'content','模拟小桃满说明卡需要先讲批次事实再讲角色故事。'],[3,'market','模拟团购场景需确认统一配送与合单条件。']])await flow('signals','DEMO-V3-SIGNAL-'+i,'市场与服务观察'+(i+1),{title:'【模拟】观察'+(i+1),type,observedAt:today,sourceRecordId:i===1?'DEMO-V3-SERVICE-0':'DEMO-V3-CONSULT-0',productId:'fresh-5',batchId:'DEMO-V3-FAMILY',channel:'模拟项目演练',body:'【模拟】'+body,sourceRef:'DEMO-V3合成反馈；非调查结论'});
  for(const status of ['proposed','adopted','rejected','executed','reviewed'])await flow('decisions','DEMO-V3-DECISION-'+status,'经营建议 · '+status,{title:'【模拟】规格与售后信息优化 · '+status,signal:'模拟信号：用户希望先了解规格、到手总价与售后。',hypothesis:'把信息放在咨询前可能减少重复询问，须实际验证。',action:'补充小桃满说明卡和批次入口，记录咨询类型。',metric:'同口径咨询率、问题类型、实际签收与退款',risk:'合成数据不能用于证明营销效果或因果关系。',sourceRef:'DEMO-V3-SIGNAL-0',ownerId:actor.id,dueDate:today,status,reason:status==='rejected'?'模拟不采用：暂缺足够样本，避免提前推广。':'模拟采用理由：先把事实说明完整，再开展小范围观察。',result:['executed','reviewed'].includes(status)?'模拟完成说明卡改版，未证明销量提升。':'',writebackId:status==='reviewed'?'products--fresh-5':'',writebackRef:status==='reviewed'?'DEMO-V3模拟复盘记录':'',nextStep:status==='reviewed'?'继续积累真实反馈，核对事实后再决定推广。':''});
  for(const [i,status]of ['planned','running','completed'].entries())await flow('experiments','DEMO-V3-EXPERIMENT-'+i,'小桃满事实卡版本对照 · '+status,{title:'【模拟】事实说明卡版本对照'+(i+1),decisionId:'DEMO-V3-DECISION-adopted',hypothesis:'仅改变信息排列，模拟相同渠道和日期口径。',variantA:'模拟A：IP故事在前，规格与运费在后。',variantB:'模拟B：规格、总价、售后在前，IP辅助解释。',startDate:ago(today,6),endDate:today,visitorsA:100,visitorsB:100,consultationsA:12,consultationsB:16,buyersA:4,buyersB:5,status,choice:status==='completed'?'adjust':'pending',conclusion:status==='completed'?'模拟观察：咨询率12%与16%，成交率4%与5%；只是合成演练，不证明因果关系，也非真实调查。':'模拟执行计划，观察尚未完成。',sourceRef:'DEMO-V3独立合成A/B场景，非站点实际访客'});
  const drafts=[['FACTS','模拟原文：桃子5斤，广东上坪，先问清。','【模拟】5斤家庭装。先核对分级、批次、到手总价、配送区域与售后，再决定是否咨询。小桃满负责说明，运营负责核验。'],['IP','模拟原文：小桃满礼盒，很好看。','【模拟】12个礼盒场景。小桃满说明卡帮助了解规格、保存与售后，包装和价格仍需人工确认，不宣称已量产。']];
  for(const [id,before,body]of drafts)await tx.query("INSERT INTO drafts(id,title,body,source_refs,status,owner_id) VALUES($1,$2,$3,$4,'draft',$5) ON CONFLICT(id) DO NOTHING",['DEMO-V3-DRAFT-'+id,'【模拟】商品文案前后对照 · '+id,body,JSON.stringify(['DEMO-V3模拟批次','前稿对照（模拟）：'+before]),actor.id]);
  for(const [i,status]of ['draft','assigned','submitted','rework','accepted'].entries())await flow('tasks','DEMO-V3-TASK-'+status,'小桃满协作 · '+status,{title:'【模拟】事实卡整理'+(i+1),type:'copy',assigneeId:'DEMO-V3-STUDENT',reviewerId:actor.id,trainingStatus:status==='draft'?'pending':'completed',trainingRef:status==='draft'?'':'DEMO-V3模拟培训与操作演练',requirements:'先核对批次、重量、分级、总价、区域、发货窗口和售后；有来源、无夸大、无个人信息。',factSource:'DEMO-V3-FAMILY，仅隔离模拟',aiMode:'template',deliverableType:'draft',deliverableId:'DEMO-V3-DRAFT-FACTS',minutes:status==='draft'?0:35,reworks:status==='rework'?1:0,agreedFee:30,paidFee:status==='accepted'?30:0,paymentRef:status==='accepted'?'DEMO-V3模拟结算凭据，系统不转账':'',status,reviewNote:status==='rework'?'模拟退回：补充配送区域与未核验边界。':status==='accepted'?'模拟验收：已核对事实来源和服务边界，不代表真实劳动或结算。':'模拟待审核'});
  for(const [id,category,title,body]of [['IP','ip','小桃满说明卡使用规范','模拟角色口吻：亲切说明规格与服务，不替代认证或事实。'],['COOP','proposal','合作需求登记模板','模拟合作需登记目标、分工、时间、授权与交付标准，未签约不得写成合作成果。'],['RESEARCH','research','调查引用口径演练','只演示题号、分母和来源登记，不新增调查人数、百分比或访谈事实。'],['CONTEST','competition','赛事演示讲解模板','模拟按项目问题、调研依据、功能路径、限制和下一步说明，不虚构获奖或真实交易。']]){
   const data=validateContent('source_library',{title:'【模拟】'+title,category,evidenceStatus:category==='research'?'reference':'plan',sourceRef:'DEMO-V3系统合成模板，非原始项目材料',body:'【模拟】'+body,reviewNote:'合成示例，无真实个人信息；不能作为成果或事实证据。'});
   await tx.query("INSERT INTO content_items(id,module,slug,title,draft,status) VALUES($1,'source_library',$2,$3,$4,'draft') ON CONFLICT(id) DO NOTHING",['source_library--DEMO-V3-'+id,'DEMO-V3-'+id,data.title,JSON.stringify(data)]);
  }
  for(let i=0;i<7;i++)for(let j=0;j<8+i;j++){
   const date=ago(today,6-i),base='DEMO-V3-EVENT-'+i+'-'+j,session='DEMO-V3-SESSION-'+i+'-'+j,visitor='DEMO-V3-VISITOR-'+(j%6),route=['home','consumer','ip','trace','service','operator'][j%6];
   await tx.query("INSERT INTO analytics_events(id,visitor_hash,session_id,event,route,device,browser,os,country,referrer,created_at) VALUES($1,$2,$3,'pageview',$4,$5,'模拟浏览器','模拟系统','CN',$6,$7) ON CONFLICT(id) DO UPDATE SET created_at=EXCLUDED.created_at",[base,visitor,session,route,j%3?'手机':'电脑',['模拟直接访问','模拟IP内容入口','模拟社群'][j%3],date+'T08:00:00+08:00']);
   if(j<2)await tx.query("INSERT INTO analytics_events(id,visitor_hash,session_id,event,route,target,device,browser,os,country,duration,created_at) VALUES($1,$2,$3,'click',$4,'模拟查看批次','手机','模拟浏览器','模拟系统','CN',0,$5) ON CONFLICT(id) DO UPDATE SET created_at=EXCLUDED.created_at",[base+'-CLICK',visitor,session,route,date+'T08:01:00+08:00']);
  }
  await tx.query('INSERT INTO app_meta(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[KEY,JSON.stringify({day:today,signatures,notice:'全部合成数据，仅演示库。仅日期滚动更新未编辑样本，人工修改保留。'})]);
 });
}

