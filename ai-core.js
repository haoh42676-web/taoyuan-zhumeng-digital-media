// Shared deterministic engine. Runs locally; no external model or personal-data upload.
import {selectProjectKnowledge} from './project-knowledge.js';
export const AI_DEFAULTS = Object.freeze({
  chatEnabled:true, descriptionEnabled:true, recommendationEnabled:true,
  lowStockThreshold:10, recommendationLimit:3,
  welcomeMessage:'我是小桃满，可以聊选桃与售后、项目调研、IP营销、青年协作、赛事演示和合作流程。请先告诉我你想了解哪一部分。',
  fallbackMessage:'这条项目问题还没有足够的已发布依据，请通过对应咨询入口交给运营核实。'
});
export const ENGINE_META={provider:'rules',label:'规则引擎 · 未接入大模型',version:'1.0.0'};
const clean=x=>String(x??'').trim();
const publicText=v=>String(v??'').replace(/sk-[a-zA-Z0-9_-]{8,}/g,'[密钥已隐藏]').replace(/(?:postgres(?:ql)?:\/\/|Bearer\s+)[^\s"']+/gi,'[私密连接已隐藏]').replace(/(?:\+?86[- ]?)?1[3-9](?:[- ]?\d){9}(?!\d)/g,'[手机号已隐藏]').replace(/\b\d{17}[\dXx]\b/g,'[证件号已隐藏]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已隐藏]').replace(/(?:姓名|联系人|详细地址|收货地址|学号|微信号)\s*[:：=]\s*[^，。；\n]{1,90}/g,'[个人信息已隐藏]');
export function merchandise(products=[]){
  return products.filter(p=>p.id!=='ip-card'&&!/设计展示|IP\s*触点/.test(p.priceNote+' '+p.type+' '+p.desc));
}
export function answerQuestion({message,products=[],faqs=[],batches=[],productId='',logistics=null,config={},publicContent={}}){
  const rules={...AI_DEFAULTS,...config},text=clean(message),product=merchandise(products).find(p=>p.id===productId);
  const response=(intent,answer,sources=[],route='consumer')=>({intent,answer:publicText(answer),sources:sources.map(s=>({title:publicText(s.title),ref:publicText(s.ref)})),route,...ENGINE_META});
  const knowledge=selectProjectKnowledge(text,{publicContent:{...publicContent,products,faqs,batches}});
  if(knowledge.scope==='unrelated')return response('handoff','我只回答数商桃乡项目相关咨询，包括选桃与售后、项目调研、IP营销、青年协作、赛事演示和合作流程；不提供内部账号、密钥、原始个人资料，也不处理完全无关的任务。',[],'home');
  const projectTopics=['research','ip','opc','cooperation','competition','tour','platform','trace'];
  const execution=!!logistics?.requested||!!logistics?.found||/我.{0,8}(?:订单|买的|收到|物流)|查询.{0,8}(?:物流|订单)|收到.{0,10}(?:坏|破损|桃)|退(?:款|货)|破损|坏[了果桃]|腐烂|发霉/.test(text);
  const projectTopic=execution?'':knowledge.topics.find(t=>projectTopics.includes(t))||(/项目.{0,10}(?:介绍|运作|流程|设计|设想)|介绍.{0,10}项目/.test(text)?'overview':!knowledge.topics.some(t=>['sales','delivery','aftercare','trace'].includes(t))?'overview':'');
  if(projectTopic){
    const chosen=knowledge.answerFacts||knowledge.facts.filter(f=>f.status!=='boundary'),facts=[...chosen.filter(f=>f.topic===projectTopic),...chosen.filter(f=>f.topic!==projectTopic)].slice(0,5);
    const route={research:'evidence',ip:'ip',opc:'operator',cooperation:'operator',competition:'competition',tour:'rural',platform:'api',trace:'trace',overview:'home'}[projectTopic];
    return response('project',facts.length?facts.map(f=>f.text).join('\n'):'这部分尚无足够公开依据，请提交项目咨询，由运营核实。',facts.map(f=>({title:({research:'调查证据',plan:'方案设想',reference:'参考信息',example:'示例',verified:'已核验记录',qualitative:'定性访谈',boundary:'适用边界'})[f.status]||'项目公开资料',ref:f.source})),route);
  }
  if(/破损|坏[了果桃]|腐烂|发霉|售后|退款|赔|挤压/.test(text)){
    const faq=faqs.find(f=>/破损|物流问题|售后/.test(f.question));
    return response('aftercare',(faq?.answer||'请保留外箱、面单和果品照片，通过收货与售后页面提交反馈，运营会按购买前公开的批次规则核验。反馈提交不等于已确认赔付。')+' 请勿在聊天中发送详细住址或完整电话。',faq?[{title:faq.question,ref:faq.sourceRef||'已发布FAQ'}]:[], 'service');
  }
  if(/物流|快递|运单|到哪|查单|订单|发货了吗/.test(text)){
    if(logistics?.found){
      const d=logistics;
      return response('logistics','已找到当前访客关联的登记订单：'+({confirmed:'成交已核实，尚未登记发货',shipped:'已登记发货',completed:'已登记签收完成'}[d.status]||'待核实')+'。'+(d.carrier?'物流公司：'+d.carrier+'。':'')+(d.trackingTail?'运单尾号：'+d.trackingTail+'。':'')+(d.shippedAt?'登记发货日期：'+d.shippedAt+'。':'')+'这里显示后台人工登记状态，未连接快递公司的实时轨迹。',[{title:'本人咨询关联的订单登记',ref:'仅当前浏览器归属记录'}],'records');
    }
    return response('logistics',logistics?.requested?'未查到属于当前访客的关联订单。请核对本浏览器“我的记录”中的咨询编号；在其他浏览器提交的记录不能在这里直接查询。':'请填写本浏览器“我的记录”中的咨询编号，再查询登记物流。系统只查询与你的咨询关联的订单，未接入快递实时轨迹。',[],'records');
  }
  if(/包邮|运费|配送|几天|多久|发货|能到|能送|48小时/.test(text)){
    const batch=batches.find(b=>b.status==='verified'&&b.productId===productId);
    const faq=faqs.find(f=>/什么时候发货/.test(f.question));
    let answer=faq?.answer||'发货日期、可配送地区和运费需要按当季可售批次确认，不能把问卷中的48小时设定当作实际承诺。';
    if(batch)answer+=' 已核验批次 '+batch.id+'：'+(batch.shippingRegions||'可配送地区仍待确认')+'；'+(batch.shippingWindow||'发货窗口仍待确认')+'；'+(batch.shippingFee==null?'运费待确认':'登记运费 '+batch.shippingFee+' 元，适用范围以批次说明为准')+'。';
    return response('shipping',answer,faq?[{title:faq.question,ref:faq.sourceRef||'已发布FAQ'}]:[],'trace');
  }
  if(/保存|冷藏|保鲜|怎么吃|放几天/.test(text)){
    const faq=faqs.find(f=>/保存/.test(f.question));
    return response('storage',faq?.answer||'请按当批随箱食用指南保存；当前资料不足以承诺保存温度或天数。',faq?[{title:faq.question,ref:faq.sourceRef||'已发布FAQ'}]:[],'service');
  }
  if(/价格|多少钱|规格|几斤|重量|等级|产地|介绍|推荐|礼盒|家庭|尝鲜|桃子|买桃/.test(text)){
    if(product){
      const fields=(product.fields||[]).filter(([key])=>/规格/.test(key)).map(([k,v])=>k+'：'+v).join('；');
      return response('product',product.name+'。\n页面价格：'+product.price+'（'+(product.priceNote||'价格状态需核验')+'）。\n'+(fields?fields+'。':product.desc||'')+'\n参考价不等于到手总价，运费、库存与发货安排请按当季批次确认。',[{title:product.name,ref:product.sourceRef||'已发布商品规格'}]);
    }
    const shortlist=merchandise(products).filter(p=>/礼|送/.test(text)?p.scene==='gift':p.scene==='family').slice(0,3);
    return response('product',shortlist.length?'可以先比较：'+shortlist.map(p=>p.name+'（'+p.price+'，'+(p.priceNote||'需核价')+'）').join('、')+'。在上方选择具体规格后，我可以继续解释。价格和配送仍需按批次确认。':'当前没有已发布的对应规格，请提交咨询核实。',shortlist.map(p=>({title:p.name,ref:p.sourceRef||'已发布商品规格'})));
  }
  return response('handoff',rules.fallbackMessage,[],'consumer');
}
export function generateDescription(input){
  const weight=clean(input.weight),grade=clean(input.grade),origin=clean(input.origin);
  const scene={family:'家庭分享',gift:'礼赠交流',group:'社群拼单'}[input.scene]||'家庭分享';
  const title=(weight+' '+grade+'鹰嘴蜜桃 · '+scene).slice(0,110);
  const body='这一箱桃，先把信息说清楚。\n标注产地：'+origin+'；标注规格：'+weight+'；分级说明：'+grade+'。\n'+
    ({family:'适合按家庭人数比较份量，第一次购买可先核对口感、到手总价和到货条件。',gift:'送礼前请先核对果品分级、包装版本、收货地区及预计发货安排。',group:'拼单前请统一确认人数、数量、收货地与售后对接人，履约以实际批次为准。'}[input.scene]||'购买前请核对规格、到手总价和履约条件。')+
    '\n小桃满提醒：价格、运费、采摘日和库存须按已核验批次确认；这份文案不会替代批次说明。';
  return {title,body,before:clean(input.before),after:body,sourceRef:clean(input.sourceRef),facts:{weight,grade,origin},warnings:['以上规格、等级和产地来自操作者录入，尚须人工核验。','未自动添加糖度、有机认证、保鲜天数、销量或时效承诺。','生成结果只可保存为草稿，需走现有审核和发布流程。'],...ENGINE_META};
}
export function recommendProducts({products=[],history=[],scene='',batches=[],limit=3,now=Date.now()}){
  const recent=history.filter(v=>typeof v.id==='string'&&Number.isFinite(v.at)&&v.at<=now&&now-v.at<30*86400000).slice(-50);
  const candidates=merchandise(products),preferred=new Map();
  for(const view of recent){const p=candidates.find(x=>x.id===view.id);if(p)preferred.set(p.scene,(preferred.get(p.scene)||0)+1);}
  return candidates.map((p,index)=>{
    const reasons=[],verified=batches.filter(b=>b.status==='verified'&&b.productId===p.id);
    let score=0;
    if(scene&&p.scene===scene){score+=30;reasons.push('符合你选择的'+({family:'家庭鲜食',gift:'礼赠',group:'团购'}[scene]||'场景'));}
    if(preferred.get(p.scene)){score+=Math.min(20,preferred.get(p.scene)*4);reasons.push('与你最近浏览的用途相近');}
    if(verified.some(b=>Number.isFinite(b.availableQuantity)&&b.availableQuantity>0)){score+=15;reasons.push('存在已核验且有可承接余量的批次');}
    if(!reasons.length)reasons.push(p.scene==='family'?'家庭与首购备选':p.scene==='gift'?'礼赠规格备选':'团购规格备选');
    const unavailable=verified.length>0&&verified.every(b=>Number.isFinite(b.availableQuantity)&&b.availableQuantity<=0);
    return {product:p,score,reasons,availability:verified.length?'以对应批次为准':'当季批次与配送待确认',unavailable,index};
  }).filter(x=>!x.unavailable).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,Math.min(6,Math.max(1,limit)));
}

