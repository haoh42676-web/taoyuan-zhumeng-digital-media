import {classifyProjectMessage,resolveProductMention} from '../project-knowledge.js';
import {hash} from './auth.js';
export {resolveProductMention};

const topicName={sales:'选桃',delivery:'配送',aftercare:'收货与保存',trace:'产地',ip:'小桃满内容',research:'调研',opc:'青年协作',cooperation:'合作',competition:'项目讲解',tour:'桃乡体验',platform:'网站使用',overview:'项目'};
const reply=(kind,answer,route='home')=>({intent:kind==='privacy'||kind==='unrelated'?'handoff':'conversation',conversationKind:kind,answer,route,sources:[],provider:'rules',label:'小桃满 · 项目助手',modelUsed:false,modelAttempted:false,modelAttempts:0});

// Session-scoped, bounded topic memory. No messages, customer fields or model credentials are stored.
export function createConversationMemory({ttlMs=30*60000,maxEntries=1000,now=()=>Date.now()}={}){
 const entries=new Map(),key=req=>hash('conversation:'+req.customer.csrf);
 return {
  get(req){const k=key(req),entry=entries.get(k);if(!entry||now()-entry.at>ttlMs){entries.delete(k);return{};}return{topics:[...entry.topics],productId:entry.productId,lastIntent:entry.lastIntent};},
  remember(req,plan,result){const k=key(req);if(['privacy','unrelated'].includes(plan.kind)){entries.delete(k);return;}if(plan.kind!=='project')return;entries.delete(k);entries.set(k,{topics:plan.topics.slice(0,3),productId:plan.productId||'',lastIntent:result.intent,at:now()});while(entries.size>maxEntries)entries.delete(entries.keys().next().value);}
 };
}

export function conversationPlan(input,context={}){
 const plan=classifyProjectMessage(input.message,{context}),commerce=plan.topics.some(t=>['sales','delivery','aftercare','trace'].includes(t));
 const inheritedProduct=commerce&&(plan.followup||plan.topics.some(t=>['delivery','aftercare'].includes(t)))?context.productId||'':'';
 return{...plan,productId:input.productId||inheritedProduct,previousIntent:context.lastIntent||''};
}

export function conversationalReply(plan){
 if(plan.kind==='greeting')return reply(plan.kind,'在呢，我是小桃满。想挑一箱桃，聊聊桃乡的内容设计，还是了解调研和合作？直接说就好。');
 if(plan.kind==='thanks')return reply(plan.kind,'不客气～有想继续聊的，随时告诉我。');
 if(plan.kind==='acknowledgment')return reply(plan.kind,plan.topics.length?'好呀。我们可以接着聊'+topicName[plan.topics[0]]+'，也可以换个项目问题。':'好呀，你想先了解哪一部分？');
 if(plan.kind==='clarify')return reply(plan.kind,'可以。你想了解怎么选桃、怎么做小桃满内容，还是怎么参与调研和合作？说说你现在想做的事，我再帮你往下拆。');
 if(plan.kind==='privacy')return reply(plan.kind,'后台凭据、密钥和他人资料不能提供。我可以继续解释公开流程，或聊聊平台怎样保护这些信息。');
 if(plan.kind==='unrelated')return reply(plan.kind,'这个话题超出了小桃满的项目服务范围。我可以帮你选桃、整理桃乡内容，或聊调研和合作。');
 return null;
}

export function naturalProjectReply(base,plan,{knowledge,digital}={}){
 const q=plan.q,sources=base.sources||[],isAdvice=plan.topics.includes('ip')&&/海报|排版|封面|怎么写|文案|宣传标题|宣传单|短视频|脚本|举例|具体|怎么做/.test(q);
 if(isAdvice){
  const wantsCopy=/文案|怎么写|写一段|写一句/.test(q),answer=/标题/.test(q)?'可以先选一个标题方向：\n1. 品牌介绍：“数商桃乡，让好桃被看见”。\n2. 产地故事：“跟着小桃满，看看一箱桃的来路”。\n3. 选购说明：“先看规格与服务，再选适合你的一箱桃”。\n\n这些是创作草稿。配图建议用已授权实拍，小桃满做引导，发布前再核对当前商品信息。':/宣传单/.test(q)?'宣传单可以按这四块来排：\n1. 顶部放“数商桃乡，让好桃被看见”和一张已授权桃园实拍。\n2. 中间用小桃满介绍采摘、分拣和一箱桃的来路。\n3. 留一块清晰的信息区，放已确认的规格、商品金额、配送费、发货窗口和售后入口。\n4. 底部引导进入商品详情或站内咨询。\n\n先把事实说清楚，再让IP帮读者记住；未核验信息保留待确认，不能编成承诺。':wantsCopy?'可以先用这段做草稿：\n\n“数商桃乡，让好桃被看见。跟着小桃满，看看桃园里的采摘与分拣，也把一箱桃的规格、配送和售后读明白。喜欢哪一款，先核对商品详情，再决定是否下单。”\n\n这段适合作为介绍文案；发布前再配上已授权的实拍和当前商品信息。':'可以先做一条“从桃园到一箱桃”的内容：\n1. 用一张已授权的桃园实拍开场，让小桃满带大家认识产地。\n2. 接上采摘、分拣和装箱画面，字幕只写已经确认的规格与批次信息。\n3. 结尾引导看商品详情，把到手价、配送和售后说清楚。\n\n这是创作建议。你准备做海报，还是短视频？我可以接着帮你拆版式或镜头。';
  return{...base,intent:'project',answer,sources:knowledge?.answerFacts?.slice(0,2).map(f=>({title:'IP内容设计依据',ref:f.source}))||sources,route:'stories',localOnly:true};
 }
 const storage=/保存|保鲜|冷藏|放几天|放多久|放多长时间|怎么放|存放|怎么吃/.test(q)||plan.followup&&plan.previousIntent==='storage';
 if(storage&&!/退款|退货|赔|腐烂|发霉/.test(q)){const answer=/软|熟透|已经熟|熟了/.test(q)?'已经偏软的话，先检查有没有压伤或其他异常，把准备食用的和需要反馈的问题果分开，按随箱指南处理。具体还能放多久，以这批桃的说明为准；有到货问题可以在自己的订单下提交反馈。':/硬|脆/.test(q)?'现在偏硬的话，先轻拿轻放，避免挤压，按随箱当批指南安排保存和食用。不同批次的成熟度不同，我不能直接保证放几天会变软；可以在自己的订单下请运营确认这批桃的处理方式。':'可以先按随箱指南检查成熟度，把有压伤、需要尽快处理的果品分开，轻拿轻放，避免继续挤压。具体温度和能放多久，以这批桃的保存说明为准。\n\n你手上的桃现在偏硬，还是已经变软了？';return{...base,intent:'storage',answer,route:'shop',localOnly:true};}
 if(plan.topics.includes('sales')&&/怎么选|选哪|适合|第一次|脆口|喜欢脆|软桃|硬桃|软一点|偏软|硬一点|偏硬|口感|甜|好吃|(?:送|给)(?:父母|爸妈|长辈)|送人/.test(q)&&!/数据|问卷|调查|调研/.test(q)){
  const picks=digital?.selected?[digital.selected]:(digital?.products||[]).slice(0,2),intro=/脆|硬|软|甜|好吃/.test(q)?'可以先按你的口感偏好来选。不过，哪款更甜或更脆、成熟度如何，要看当批说明，不能只凭包装判断。':/父母|爸妈|长辈|送人/.test(q)?'送父母或长辈的话，可以先问问他们喜欢偏脆还是偏软、一次能吃多少，再核对包装和到货安排。':'第一次买的话，可以先比较尝鲜份量和家庭份量，再结合预算和收货地区来选。';
  const details=picks.map(p=>`${p.name}：${p.weight}，商品金额¥${p.price.toFixed(2)}，每单配送费¥${p.shippingFee.toFixed(2)}${p.realEnabled?'':'（示例规格和价格，当前仅可模拟下单）'}。`).join('\n');
  return{...base,intent:'product',answer:intro+(details?'\n'+details:'')+'\n\n你是自己吃、和家人分享，还是送人？',route:'shop',localOnly:true};
 }
 if(base.intent==='project'&&knowledge?.answerFacts?.length&&!/详细|数据|题号|分母|全部|具体比例/.test(q)){
  const facts=knowledge.answerFacts.slice(0,2);return{...base,answer:facts.map(f=>f.text).join('\n\n'),sources:facts.map(f=>({title:topicName[f.topic]||'项目公开资料',ref:f.source}))};
 }
 return base;
}
