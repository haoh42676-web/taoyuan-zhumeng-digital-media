import {SITE_MODULES} from './site-schema.js';
import { z } from 'zod';

z.config(z.locales.zhCN());
const field = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const text = (k, l, extra) => field(k, l, 'text', extra);
const area = (k, l, extra) => field(k, l, 'textarea', extra);
const select = (k, l, options, extra) => field(k, l, 'select', { options, ...extra });
export const ROUTES = ['home','evidence','consumer','trace','ip','operator','content','rural','service','competition','records','api'];
export const REVIEW_ITEMS = ['产地与实际发货地','规格与重量分档','批次库存与可售数量','商品价格与计价单位','收货区域与配送费用','采摘安排与发货窗口','售后规则与对外话术'];
export const MODULES = { ...SITE_MODULES,
  ai_settings: {label:'智能辅助规则',singleton:true,fixedSlug:'default',help:'控制规则客服、推荐与文案生成；保存并发布后生效。正式客服与商品文案优先调用项目AI主模型，六秒未完成或报错切换DeepSeek备用；未配置、调用失败或事实检查失败时回退本地规则。资料分类当前使用本地规则，GLM暂不启用。演示后台不调用外部AI。对外回答以已发布商品、批次与FAQ为依据，模型仅接收所需的公开脱敏片段，密钥仅放环境变量。',fields:[field('chatEnabled','启用登录客服','checkbox',{default:true}),field('descriptionEnabled','启用商品文案生成','checkbox',{default:true}),field('recommendationEnabled','启用首页推荐','checkbox',{default:true}),field('lowStockThreshold','低库存预警阈值（箱/盒）','number',{min:0,max:1000000,required:true}),field('recommendationLimit','首页推荐数量','number',{min:1,max:6,required:true}),area('welcomeMessage','客服欢迎语',{required:true}),area('fallbackMessage','未命中知识时的引导',{required:true})]},
  source_library: { label:'项目资料档案',adminOnly:true,help:'仅登录后台可见的脱敏资料正文、来源与导入口径。按原稿保存方案、研究、预算和评审材料；导入不代表结论已核验，不会作为真实订单、库存或营销成果。原始问卷个人明细不导入。',fields:[text('title','资料标题',{required:true}),select('category','资料类别',{research:'调研与匿名统计',interview:'访谈摘录',ip:'IP设计与营销方案',proposal:'项目方案与实践报告',finance:'预算、预测与模型',competition:'赛事规范',review:'评审意见',media:'素材索引',other:'其他项目资料'}),select('evidenceStatus','证据与使用状态',{source:'脱敏原稿，待业务核验',research:'调查汇总，非经营实绩',plan:'方案设想，非实际成果',forecast:'预算或预测，非实际财务',reference:'参考材料',pending:'敏感或权利状态待人工复核，仅导入索引'}),text('sourceRef','源文件与位置',{required:true}),text('fileHash','源文件SHA-256'),text('part','正文分段 / 页码'),area('body','脱敏正文或索引说明',{required:true}),area('reviewNote','脱敏处理与使用限制')]},
  pages: { label: '页面与首页', help: '每个页面的标题、引导文字、补充内容。首页主标题保持项目口号。', fields: [text('title','页面标题',{required:true}),text('kicker','栏目眉题'),area('intro','介绍文字'),area('body','补充说明（纯文本）'),field('image','补充配图','image'),area('notice','页面状态说明'),text('sourceRef','依据 / 来源')] },
  products: { label: '商品规格', help: '参考价与实际价格分清；未知价格、库存、运费留空，不能填0替代。', fields: [text('name','商品名称',{required:true}),select('category','类别',{fresh:'鲜果',gift:'礼盒'}),select('scene','推荐场景',{family:'家庭鲜食',gift:'节庆礼赠',group:'社群团购'}),text('type','显示类别'),text('price','价格显示（如 ¥65 / 待确认）',{required:true}),text('priceNote','价格说明'),field('image','商品图片','image'),area('desc','商品说明'),field('fields','详情信息','pairs',{help:'每行一项：字段名称 | 字段内容'}),text('sourceRef','方案或批次依据')] },
  scenarios: { label:'消费场景',help:'家庭、礼赠和团购的推荐规格、说明及按钮关联。关联商品须已发布。',fields:[text('title','场景名称',{required:true}),text('productId','推荐商品编号',{required:true}),area('copy','选购引导'),select('filter','类别',{fresh:'鲜果',gift:'礼盒'})] },
  batches: { label:'批次与溯源',help:'数量填写本批已核验总量，系统从中扣除成交占用显示余量。实际产地与发货地分开录入。示例保持“示例”，只有完成核验的实际记录才能标为已核验。',fields:[text('batchId','批次编号',{required:true}),text('verificationCode','核验码 / 资料索引（录入不代表核验通过）'),text('productId','对应商品规格编号（核验必填）'),select('status','事实状态',{example:'示例',pending:'待核验',verified:'已核验'}),text('originName','实际产地'),text('shippingOrigin','实际发货地'),field('harvestDate','采摘日期','date'),field('stock','本批可承接总量（对应规格的箱/盒）','number',{min:0,nullable:true}),field('shippingFee','配送费（元，区域不同请填说明）','number',{min:0,nullable:true}),text('shippingWindow','发货窗口'),text('grading','规格分级'),area('shippingRegions','可配送地区与费用规则'),area('aftercareRule','当批售后规则'),text('owner','事实确认人'),text('sourceRef','原始记录依据'),field('verifiedAt','核验日期','date')] },
  trace_steps: { label:'事实链步骤',help:'果园、分拣、发货、回访四个步骤的字段、责任人与当前状态。',fields:[text('title','步骤名称',{required:true}),area('description','说明字段'),text('owner','责任人 / 分工'),text('state','状态说明')] },
  ip_profile: { label:'小桃满角色',singleton:true,fixedSlug:'xiaotaoman',help:'以icanAIOPC的设计为准。角色故事与真实产地事实分别标识。',fields:[text('name','角色名称',{required:true}),text('identity','角色定位'),text('tone','性格与语气'),field('image','角色主图','image'),area('description','角色介绍'),area('guide','使用规范'),text('sourceRef','IP设计来源')] },
  ip_series: { label:'IP栏目与内容',help:'栏目素材、用途、责任人、小桃满台词，可在前台IP和内容工作室统一使用。',fields:[text('title','栏目名称',{required:true}),field('image','栏目素材','image'),area('copy','栏目说明'),text('use','使用触点'),text('owner','执行与审核责任'),area('voice','小桃满台词'),text('sourceRef','素材来源')] },
  research_sets: { label:'调查分组与指标',help:'分组样本量和重点指标。各分组均可按题号与选项汇总，或录入有来源的引用人数与有效分母。',fields:[text('name','调查名称',{required:true}),field('n','样本总量','number',{min:1,required:true}),text('source','来源文件',{required:true}),area('note','口径与局限'),field('metrics','重点指标','metrics')] },
  survey_rows: { label:'问卷完整选项',help:'逐条录入题号、选项和人数。比例按人数/分母计算，多选题不要求合计100%。',fields:[select('dataset','调查分组',{consumer:'消费者',opc:'学生与OPC',farmer:'产业端'}),text('question','题号',{required:true}),text('dimension','矩阵题能力维度（普通题留空）'),text('type','题型'),text('option','选项编码',{required:true}),text('label','选项内容',{required:true}),field('count','人数','number',{min:0,required:true}),field('denominator','该题有效分母','number',{min:1,required:true}),text('sourceRef','来源')] },
  interviews: { label:'访谈与依据',help:'定性访谈和口述估计分别标识，不计为团队销量。',fields:[text('title','材料名称',{required:true}),select('type','证据类型',{qualitative:'定性观察',oral_estimate:'口述估计',verified:'已核验记录'}),area('body','访谈结论与使用边界',{required:true}),text('sourceRef','附件 / 原文位置',{required:true})] },
  tours: { label:'农文旅路线',help:'维护路线节点、接待安排和限制。可单独暂停咨询意向；接待条件核实不等于正式预约确认。',fields:[text('name','路线名称',{required:true}),field('image','路线背景图片','image'),area('description','路线介绍'),field('stops','路线节点','pairs',{help:'每行：节点名称 | 内容与限制'}),field('openDates','可接待日期（每行一个）','lines'),field('capacity','接待容量','number',{min:1,nullable:true}),field('inquiryEnabled','接受路线咨询意向（不代表开放预约）','checkbox',{default:true}),field('bookingAvailable','接待条件已核实（仅说明状态，不确认预约）','checkbox'),area('conditions','开放与接待条件'),text('sourceRef','合作方核验依据')] },
  faqs: { label:'收货与售后FAQ',help:'解释发货、保存与售后规则，具体承诺须与批次一致。',fields:[text('question','问题',{required:true}),area('answer','回答',{required:true}),text('sourceRef','适用依据')] },
  social: {label:'社交入口',help:'前台二维码与联系说明。确认是项目授权账号。',fields:[text('title','入口名称',{required:true}),field('image','二维码图片','image'),area('description','联系说明'),text('sourceRef','账号依据')]},
  slides: { label:'赛事讲解',help:'维护讲解标题、事实依据与跳转页面。',fields:[text('title','讲解标题',{required:true}),area('copy','讲解内容',{required:true}),text('source','材料依据'),select('route','对应页面',Object.fromEntries(ROUTES.map(x=>[x,x]))),field('image','配图','image')] },
  templates: { label:'渠道脚本模板',help:'可用 {title}、{copy}、{voice} 插入当前IP栏目内容。只做文本替换，不执行脚本。',fields:[text('title','模板名称',{required:true}),select('channel','渠道',{video:'短视频',live:'直播',group:'社群',card:'随箱卡'}),area('body','正文模板',{required:true}),text('sourceRef','依据说明')] },
  settings: { label:'网站设置',singleton:true,help:'网站品牌、首页说明和统计设置；敏感的数据库连接和密码不在这里保存。',fields:[text('brand','品牌名',{required:true}),text('brandSubtitle','品牌副标题'),text('heroEyebrow','首页眉题'),text('heroCaption','首页IP图说明'),text('dashboardTitle','功能分区标题'),area('dashboardIntro','功能分区介绍'),text('footerText','首页底部说明'),text('slogan','项目口号',{required:true}),area('heroIntro','首页介绍'),area('heroNote','首页状态说明'),field('heroPhoto','首页彩色照片','image'),field('ipImage','首页IP形象','image'),field('proofs','首页数据条','proofs'),field('analyticsEnabled','开启匿名访问统计','checkbox'),field('analyticsRetentionDays','访问明细保留天数','number',{min:7,max:730,required:true}),field('requestRetentionDays','请求日志保留天数','number',{min:1,max:180,required:true}),area('privacyNotice','数据处理说明'),text('contact','项目联系说明')] }
};

export function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
export const slugSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/, '编号只能包含字母、数字、下划线和短横线');
export function validateContent(module, value) {
  const definition = Object.hasOwn(MODULES,module)?MODULES[module]:null; if (!definition) fail(404,'内容模块不存在');
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(422,'数据须为对象');
  const result = {};
  for (const f of definition.fields) {
    const v = value[f.key];
    if (f.type === 'checkbox') { if (v !== undefined && typeof v !== 'boolean') fail(422,f.label+'格式不正确'); result[f.key] = v === undefined ? f.default === true : v === true; }
    else if (f.type === 'number') {
      if (v === null || v === '' || v === undefined) { if (f.required) fail(422,'请填写'+f.label); result[f.key] = null; continue; }
      if (typeof v !== 'number' || !Number.isFinite(v) || v < (f.min ?? 0) || v > (f.max ?? 10000000)) fail(422,f.label+'超出范围');
      if (!['shippingFee'].includes(f.key) && !Number.isInteger(v)) fail(422,f.label+'须为整数');
      result[f.key] = v;
    } else if (['pairs','lines','metrics','proofs'].includes(f.type)) {
      if (!Array.isArray(v) || v.length > 100) fail(422,f.label+'须为列表（最多100项）');
      if (f.type === 'pairs' && !v.every(row=>Array.isArray(row)&&row.length===2&&row.every(c=>typeof c==='string'&&c.length<=3000))) fail(422,f.label+'每项须为名称与内容');
      if (f.type === 'lines' && !v.every(row=>typeof row==='string'&&row.length<=200)) fail(422,f.label+'须逐行填写');
      if (f.type === 'metrics') for (const m of v) {
        if (!Array.isArray(m) || m.length!==4 || typeof m[0]!=='string' || !m[0] || typeof m[3]!=='string' || !m[3]) fail(422,'指标须包含题号、选项/人数、分母和名称');
        if (Array.isArray(m[1])) { if(!m[1].length||!m[1].every(x=>typeof x==='string'&&x.length<30))fail(422,'指标选项不正确'); }
        else if (!Number.isInteger(m[1]) || !Number.isInteger(m[2]) || m[1]<0 || m[2]<1 || m[1]>m[2]) fail(422,'指标人数不能大于有效分母');
      }
      if (f.type === 'proofs' && !v.every(row=>Array.isArray(row)&&row.length===3&&row.every(c=>typeof c==='string'&&c.length<=300))) fail(422,'首页数据条须包含数字、标题和说明');
      result[f.key]=v;
    } else {
      if (v !== undefined && v !== null && typeof v !== 'string') fail(422,f.label+'须为文字');
      const s=(v??'').trim(); if(f.required&&!s)fail(422,'请填写'+f.label); if(s.length>(f.type==='textarea'?12000:500))fail(422,f.label+'过长');
      if(f.type==='select' && !Object.hasOwn(f.options,s))fail(422,'请选择'+f.label);
      if(f.type==='image' && s && !/^(assets\/[a-zA-Z0-9_./-]+|\/media\/[a-zA-Z0-9_-]+\.webp)$/.test(s))fail(422,'图片请从项目素材或后台上传的公开素材选择');
      if(f.type==='date'&&s&&(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s))fail(422,f.label+'不是有效日期');
      result[f.key]=s;
    }
  }
  if(module==='survey_rows'&&result.count>result.denominator)fail(422,'人数不能大于该题有效分母');
  if(module==='pages'&&!ROUTES.includes(value.slug??'')) { /* Slug checked by content route. */ }
  if(module==='batches'&&result.status==='verified'&&(!result.productId||!result.originName||!result.shippingOrigin||!result.harvestDate||result.stock===null||!result.grading||!result.shippingWindow||!result.shippingRegions||!result.aftercareRule||!result.owner||!result.sourceRef||!result.verifiedAt))fail(422,'已核验批次须补齐对应商品规格、产地、发货地、日期、数量、分级、区域运费、发货窗口、售后、确认人及依据');
  if(module==='batches'&&result.status==='verified'){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());if(result.harvestDate>today||result.verifiedAt>today||result.verifiedAt<result.harvestDate)fail(422,'核验日期不能早于采摘日，实际采摘和核验不能填未来日期');}
  return result;
}
