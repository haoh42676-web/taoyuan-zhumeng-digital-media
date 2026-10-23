import { Router } from 'express';
import { one } from './db.js';
import { uid,audit,requireRole } from './auth.js';
import { fail } from './modules.js';
import { WORKFLOWS,PROJECT_MAP } from './workflow-schema.js';
import { sendCSV } from './analytics.js';
const editorFields=new Set(['deliverableType','deliverableId','minutes','reworks','aiMode','status']);
const canOperate=u=>['admin','operator'].includes(u.role);
const row=r=>r&&({id:r.id,kind:r.kind,title:r.title,data:r.data,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at});
const money=v=>Math.round((Number(v)||0)*100);
export function orderAmounts(d){const total=money(d.unitPrice)*d.quantity+money(d.shippingCharged),cost=['goodsCost','packagingCost','logisticsCost','otherCost'].reduce((n,k)=>n+money(d[k]),0),net=money(d.receivedAmount)-money(d.refundAmount);return{total:total/100,netReceipts:net/100,cost:cost/100,contribution:(net-cost)/100,costComplete:['goodsCost','packagingCost','logisticsCost','otherCost'].every(k=>d[k]!==null&&d[k]!==undefined)};}
function validate(kind,value){
 const def=Object.hasOwn(WORKFLOWS,kind)?WORKFLOWS[kind]:null;if(!def)fail(404,'经营类别不存在');if(!value||typeof value!=='object'||Array.isArray(value))fail(422,'经营数据须为对象');const d={};
 for(const f of def.fields){const v=value[f.key];if(f.type==='checkbox'){if(v!==undefined&&typeof v!=='boolean')fail(422,f.label+'格式不正确');d[f.key]=v===true;}
  else if(f.type==='number'){if(v===null||v===undefined||v===''){if(f.required)fail(422,'请填写'+f.label);d[f.key]=null;continue;}if(typeof v!=='number'||!Number.isFinite(v)||v<(f.min??0)||v>10000000||(f.integer&&!Number.isInteger(v))||(!f.integer&&Math.abs(v*100-Math.round(v*100))>0.000001))fail(422,f.label+'须为有效非负数，金额最多两位小数');d[f.key]=v;}
  else{if(v!==null&&v!==undefined&&typeof v!=='string')fail(422,f.label+'须为文字');d[f.key]=(v||'').trim();if(f.required&&!d[f.key])fail(422,'请填写'+f.label);if(d[f.key].length>(f.type==='textarea'?6000:500))fail(422,f.label+'过长');if(f.type==='select'&&!Object.hasOwn(f.options,d[f.key]))fail(422,'请选择'+f.label);if(f.type==='date'&&d[f.key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(d[f.key])||!Number.isFinite(Date.parse(d[f.key]))||new Date(d[f.key]).toISOString().slice(0,10)!==d[f.key]))fail(422,f.label+'须为有效日期');}}
 return d;
}
async function contentRef(tx,module,slug){return one(tx,`SELECT * FROM content_items WHERE module=$1 AND slug=$2 AND published IS NOT NULL AND status!='archived'`,[module,slug]);}
async function validateRelations(tx,kind,d,old,user){
 for(const f of WORKFLOWS[kind].fields.filter(f=>f.type==='reference'&&d[f.key])){let ref;
  if(['customers','orders','decisions'].includes(f.target))ref=await one(tx,'SELECT id FROM workflow_items WHERE kind=$1 AND id=$2',[f.target,d[f.key]]);
  else if(['products','batches'].includes(f.target))ref=await contentRef(tx,f.target,d[f.key]);
  else if(f.target==='records')ref=await one(tx,'SELECT * FROM business_records WHERE id=$1',[d[f.key]]);
  else if(['members','reviewers'].includes(f.target)){ref=await one(tx,"SELECT id FROM users WHERE id=$1 AND active=true"+(f.target==='reviewers'?" AND role IN ('admin','operator')":''),[d[f.key]]);if(!ref&&f.target==='members')ref=await one(tx,"SELECT id FROM workflow_items WHERE id=$1 AND kind='collaborators' AND data->>'active'='true'",[d[f.key]]);}
  else if(f.target==='content')ref=await one(tx,'SELECT id FROM content_items WHERE id=$1',[d[f.key]]);
  if(!ref&&old?.data[f.key]===d[f.key]&&['products','batches'].includes(f.target)&&old.data.status!=='draft')continue;
  // Finished work retains the original people after deactivation or an account-free restore.
  if(!ref&&kind==='tasks'&&old?.data.status==='accepted'&&d.status==='accepted'&&old.data[f.key]===d[f.key]&&['members','reviewers'].includes(f.target))continue;
  if(!ref)fail(422,f.label+'不存在、已停用或尚未发布');if(kind==='orders'&&f.key==='sourceRecordId'&&ref.kind!=='consultation')fail(422,'订单来源须是商品咨询');
 }
 if(kind==='customers'&&((d.marketingConsent&&!d.consentRef)||(d.contactPurpose==='marketing'&&!d.marketingConsent)))fail(422,'营销授权须有独立授权依据，安排预售或营销联系前须确认已取得授权');
 if(kind==='orders'){
  const transitions={draft:['draft','confirmed','cancelled'],confirmed:['confirmed','shipped','cancelled'],shipped:['shipped','completed'],completed:['completed'],cancelled:['cancelled']};
  if(!old&&d.status!=='draft')fail(422,'先登记待核对订单，检查后再确认成交');
  if(old&&!transitions[old.data.status].includes(d.status))fail(409,'履约顺序为待核对→成交核实→发货→签收；已发货订单不能直接取消');
  if(old&&old.data.status!=='draft')for(const k of ['customerId','productId','batchId','quantity','unitPrice','shippingCharged','receivedAmount','sourceRecordId','sourceRef','channel','externalOrderNo'])if(d[k]!==old.data[k])fail(422,'成交核实后不能改动商品、数量、价格、原收款或来源凭据，请保留原始成交记录');
  if(old?.data.productSnapshot)d.productSnapshot=old.data.productSnapshot;if(old?.data.batchSnapshot)d.batchSnapshot=old.data.batchSnapshot;
  if(['confirmed','shipped','completed'].includes(d.status)){
   const live=await contentRef(tx,'batches',d.batchId),b=live||{published:old?.data.batchSnapshot};if(b.published?.status!=='verified')fail(422,'真实订单须关联已核验批次，示例批次不能确认成交');
   if(b.published.productId!==d.productId)fail(422,'该批次的商品规格与订单不同，不能混用不同净重或礼盒规格的数量');
   if([d.unitPrice,d.shippingCharged,d.receivedAmount,d.refundAmount].some(x=>x===null)||!d.externalOrderNo||!d.sourceRef||!d.shippingRegion)fail(422,'请补齐实际单价、配送费、收款、退款、外部订单号、凭据和收货地区，已知为0须填写0');
   const amounts=orderAmounts(d);if(money(d.receivedAmount)!==money(amounts.total))fail(422,'已核实收款须等于单价×数量＋收取的配送费，退款单独记录');
   const used=Number((await one(tx,`SELECT coalesce(sum((data->>'quantity')::int),0) n FROM workflow_items WHERE kind='orders' AND data->>'batchId'=$1 AND data->>'status' IN ('confirmed','shipped','completed') AND id!=$2`,[d.batchId,old?.id||''])).n);
   if(b.published.stock===null||used+d.quantity>b.published.stock)fail(409,'该批次可承接总量不足，请先核对真实批次数量');
   if(!old||old.data.status==='draft'){const p=await contentRef(tx,'products',d.productId);d.productSnapshot={name:p.published.name,sourceRef:p.published.sourceRef};d.batchSnapshot={...b.published};}else{d.productSnapshot=old.data.productSnapshot;d.batchSnapshot=old.data.batchSnapshot;}
  }
  if(money(d.refundAmount)>money(d.receivedAmount))fail(422,'退款不能超过已核实收款');if(d.refundAmount>0&&!d.note)fail(422,'有退款时请填写退款原因和处理说明');
  if(d.status==='cancelled'&&money(d.receivedAmount)!==money(d.refundAmount))fail(422,'已收款订单取消前须核实全额退款，系统只登记实际凭据');
  if(['shipped','completed'].includes(d.status)&&(!d.carrier||!d.trackingNo||!d.shippedAt))fail(422,'发货须填写物流公司、单号和发货日期');
  if(d.status==='completed'&&(!d.receivedAt||!d.receiptRef||!orderAmounts(d).costComplete))fail(422,'签收完成须有签收日期、凭据和四项实际成本（已知为0须填0）');
  if(d.receivedAt&&d.shippedAt&&d.receivedAt<d.shippedAt)fail(422,'签收日期不能早于发货日期');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());if(d.shippedAt>today||d.receivedAt>today)fail(422,'实际发货和签收日期不能填未来日期');
 }
 if(kind==='decisions'){
  const next={proposed:['proposed','adopted','rejected'],adopted:['adopted','executed','rejected'],executed:['executed','reviewed'],reviewed:['reviewed'],rejected:['rejected','proposed']};if(!old&&d.status!=='proposed')fail(422,'建议先保存为待判断');if(old&&!next[old.data.status].includes(d.status))fail(409,'请依次完成判断、执行与复盘');
  if(['adopted','executed','reviewed'].includes(d.status)&&(!d.ownerId||!d.dueDate||!d.reason))fail(422,'采用建议须明确负责人、计划日期与采用理由');if(d.status==='rejected'&&!d.reason)fail(422,'请记录不采用的理由');
  if(['executed','reviewed'].includes(d.status)&&!d.result)fail(422,'执行后须填写实际结果');if(d.status==='reviewed'&&(!d.nextStep||(!d.writebackId&&!d.writebackCustomerId&&!d.writebackRef)))fail(422,'复盘须说明下一步，并关联回写内容、客户或其他凭据');
 }
 if(kind==='experiments'){
  if(d.startDate&&d.endDate&&d.endDate<d.startDate)fail(422,'结束日期不能早于开始日期');
  for(const v of ['A','B'])for(const[small,big]of [['buyers','consultations'],['consultations','visitors'],['buyers','visitors']])if(d[small+v]!==null&&d[big+v]!==null&&d[small+v]>d[big+v])fail(422,'同口径下成交人数≤咨询人数≤有效触达人数；未知数据不能跳过已知人数之间的校验');
  if(d.status==='completed'&&(!d.startDate||!d.endDate||!d.conclusion||d.choice==='pending'||['visitorsA','visitorsB','consultationsA','consultationsB','buyersA','buyersB'].some(k=>d[k]===null)))fail(422,'总结前请填写日期、两组真实数据、结论和下一步判断');
  if(d.status==='completed'&&d.endDate>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()))fail(422,'已总结的验证不能包含未来观察日期');
 }
 if(kind==='tasks'){
  if(old?.data.status==='accepted')for(const f of WORKFLOWS.tasks.fields)if(!['paidFee','paymentRef'].includes(f.key)&&JSON.stringify(d[f.key])!==JSON.stringify(old.data[f.key]))fail(422,'已验收任务保留原交付、工时、约定费用与审核记录；补充工作请新建任务，结算凭据可继续登记');
  if(!canOperate(user)&&(!old||old.data.assigneeId!==user.id))fail(403,'只能更新自己承接的任务');
  if(!canOperate(user))for(const k of Object.keys(d))if(!editorFields.has(k)&&JSON.stringify(d[k])!==JSON.stringify(old.data[k]))fail(403,'任务要求、培训确认、审核与费用由运营维护');
  const next={draft:['draft','assigned'],assigned:['assigned','submitted'],submitted:['submitted','accepted','rework'],rework:['rework','submitted'],accepted:['accepted']};if(!old&&d.status!=='draft')fail(422,'先保存任务准备，再派发');if(old&&!next[old.data.status].includes(d.status))fail(409,'请按准备、派发、提交、验收或退回的顺序操作');
  if(d.status!=='draft'&&(!d.assigneeId||!d.reviewerId||d.trainingStatus!=='completed'||!d.trainingRef))fail(422,'派发前请确定执行人、运营审核人并确认必要培训');
  if(d.status!=='draft'&&d.assigneeId===d.reviewerId)fail(422,'执行人与运营审核人须为不同成员');
  if(['submitted','accepted'].includes(d.status)){
   if(!d.deliverableId||d.minutes===null||d.reworks===null)fail(422,'提交前请填写交付物编号、实际工时和返工次数');
   if(d.deliverableType!=='external'){const table={draft:'drafts',content:'content_items',record:'business_records'}[d.deliverableType];if(!await one(tx,'SELECT id FROM '+table+' WHERE id=$1',[d.deliverableId]))fail(422,'交付物编号不存在，请关联实际保存的草稿、内容或业务记录');}
  }
  if(d.status==='accepted'&&old?.data.status!=='accepted'){if(!canOperate(user)||d.reviewerId!==user.id||d.assigneeId===user.id)fail(403,'验收须由指定运营审核人完成，执行人不能自行验收');if(!d.reviewNote)fail(422,'验收须填写核对意见');}
  if(d.status==='rework'&&old?.data.status!=='rework'&&(!canOperate(user)||d.reviewerId!==user.id||d.assigneeId===user.id))fail(403,'退回须由指定运营审核人完成');
  if(d.status==='rework'&&!d.reviewNote)fail(422,'退回请说明修改要求');if(d.paidFee!==null&&d.paidFee>0&&(d.status!=='accepted'||d.agreedFee===null||d.paidFee>d.agreedFee||!d.paymentRef))fail(422,'结算须在验收后记录，不得超过约定费用，并附实际结算凭据');
 }
}
export async function saveWorkflow(db,user,kind,id,body,internal={}){
 if(!Object.hasOwn(WORKFLOWS,kind))fail(404,'经营类别不存在');
 if(!canOperate(user)&&kind!=='tasks')fail(403,'经营数据由运营或管理员维护');
 return db.transaction(async tx=>{if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362011)');
  const old=id?await one(tx,'SELECT * FROM workflow_items WHERE id=$1 AND kind=$2 FOR UPDATE',[id,kind]):null;if(id&&!old)fail(404,'记录不存在');if(old&&body.version!==old.version)fail(409,'记录已变化，请重新打开后再修改');
  const d=validate(kind,body.data);if(old?.data.ruleKey||internal.ruleKey)d.ruleKey=old?.data.ruleKey||internal.ruleKey;await validateRelations(tx,kind,d,old,user);
  if(old)await tx.query('INSERT INTO workflow_history(item_id,version,data,actor_id) VALUES($1,$2,$3,$4)',[id,old.version,JSON.stringify(old.data),user.id]);
  const title=d.title||d.name,next=old?await one(tx,'UPDATE workflow_items SET title=$2,data=$3,version=version+1,updated_by=$4,updated_at=now() WHERE id=$1 RETURNING *',[id,title,JSON.stringify(d),user.id]):await one(tx,'INSERT INTO workflow_items(id,kind,title,data,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5) RETURNING *',[uid(kind.toUpperCase()),kind,title,JSON.stringify(d),user.id]);
  await audit(tx,user,'workflow.'+(old?'save':'create'),next.id,{kind,version:next.version,status:d.status});return row(next);
 });
}
export async function workflowSummary(db){
 const rows=(await db.query('SELECT * FROM workflow_items')).rows,orders=rows.filter(x=>x.kind==='orders'),completed=orders.filter(x=>x.data.status==='completed'),customers=rows.filter(x=>x.kind==='customers'),records=(await db.query('SELECT id,kind,status,data FROM business_records')).rows;
 const totals=completed.reduce((t,r)=>{const a=orderAmounts(r.data);for(const k of ['netReceipts','cost','contribution'])t[k]+=money(a[k]);return t;},{netReceipts:0,cost:0,contribution:0});for(const k of Object.keys(totals))totals[k]/=100;
 const fulfilledCustomers=new Map();for(const o of completed)fulfilledCustomers.set(o.data.customerId,(fulfilledCustomers.get(o.data.customerId)||0)+1);
 const channels=[...new Set(completed.map(o=>o.data.channel))].map(channel=>{const list=completed.filter(o=>o.data.channel===channel);return{channel,orders:list.length,revenue:list.reduce((n,o)=>n+money(orderAmounts(o.data).netReceipts),0)/100};});
 const open=records.filter(r=>r.status!=='resolved'),decisions=rows.filter(r=>r.kind==='decisions'),tasks=rows.filter(r=>r.kind==='tasks');
 return{orders:orders.length,completed:completed.length,openRecords:open.length,claims:records.filter(r=>r.kind==='claim').length,customers:customers.length,repeatCustomers:[...fulfilledCustomers.values()].filter(n=>n>=2).length,purchasedCustomers:fulfilledCustomers.size,totals,channels,decisions:decisions.filter(x=>['adopted','executed'].includes(x.data.status)).length,tasks:tasks.filter(x=>x.data.status!=='accepted').length,records,rows:rows.map(row),notes:'完成签收订单按实际收款减退款统计；成本包含已录入果品、包装、物流及其他成本。贡献额不等于净利润（未包含未录入的人工、税费等）。复购客按同一客户卡至少两笔签收订单计算；不能由浏览量或意向推断。'};
}
async function options(db,user){
 const content=(await db.query("SELECT id,module,slug,title,published FROM content_items WHERE status!='archived' ORDER BY sort_order")).rows;
 const members=(await db.query('SELECT id,name,role FROM users WHERE active=true ORDER BY name')).rows;
 const privateAccess=canOperate(user)||user.role==='viewer';
 const flows=privateAccess?(await db.query("SELECT id,kind,title FROM workflow_items WHERE kind IN ('customers','decisions','orders') ORDER BY created_at DESC")).rows:[];
 return{products:content.filter(x=>x.module==='products'&&x.published).map(x=>({id:x.slug,title:x.title})),batches:content.filter(x=>x.module==='batches'&&x.published).map(x=>({id:x.slug,title:x.slug+' · '+({verified:'已核验',pending:'待核验',example:'示例'}[x.published.status])})),content:content.map(x=>({id:x.id,title:x.title+' · '+x.module})),members:[...members.map(x=>({id:x.id,title:x.name+' · '+x.role})),...(await db.query("SELECT id,title FROM workflow_items WHERE kind='collaborators' AND data->>'active'='true' ORDER BY title")).rows.map(x=>({id:x.id,title:x.title+' · 协作人员（无登录）'}))],reviewers:members.filter(x=>['admin','operator'].includes(x.role)).map(x=>({id:x.id,title:x.name})),records:privateAccess?(await db.query('SELECT id,kind,data FROM business_records ORDER BY created_at DESC LIMIT 2000')).rows.map(x=>({id:x.id,title:({consultation:'咨询',claim:'售后',tour:'路线'}[x.kind])+' · '+x.data.name+' · '+x.id})):[],...Object.fromEntries(['customers','decisions','orders'].map(k=>[k,flows.filter(x=>x.kind===k).map(x=>({id:x.id,title:x.title}))]))};
}
export function workflowRouter(db,send){const r=Router();r.use('/workflow',requireRole('admin','operator','editor','viewer'));
 r.get('/workflow/schema',(req,res)=>send(res,{modules:WORKFLOWS,map:PROJECT_MAP}));
 r.get('/workflow/options',async(req,res)=>send(res,await options(db,req.user)));
 r.get('/workflow/summary',requireRole('admin','operator','viewer'),async(req,res)=>{const d=await workflowSummary(db);delete d.rows;delete d.records;send(res,d);});
 r.post('/workflow/diagnose',requireRole('admin','operator'),async(req,res)=>{
  const summary=await workflowSummary(db),open=summary.records.filter(x=>x.status!=='resolved'),signals=[];
  if(open.length)signals.push({key:'open-records',title:'优先完成未闭环服务',signal:`当前有${open.length}条未完成记录，其中售后${open.filter(x=>x.kind==='claim').length}条。`,hypothesis:'处理延迟可能影响体验，需核对原因与当前承接能力。',action:'在咨询与售后中分配负责人，核实问题并回复，再回访。',metric:'待处理条数、首次跟进与完成时间',sourceRef:open.slice(0,20).map(x=>x.id).join('；')});
  const due=summary.rows.filter(x=>x.kind==='customers'&&x.data.followupDate&&x.data.followupDate<=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()));
  if(due.length)signals.push({key:'followups',title:'核对已到期回访安排',signal:`${due.length}位客户到回访日期。`,hypothesis:'服务反馈可能仍未回写，需人工确认。',action:'查看客户卡，按服务用途完成回访。营销联系另行检查独立授权。',metric:'完成回访数与真实复购意向',sourceRef:due.slice(0,20).map(x=>x.id).join('；')});
  const low=summary.rows.filter(x=>x.kind==='orders'&&x.data.status==='completed'&&orderAmounts(x.data).contribution<0);
  if(low.length)signals.push({key:'negative-contribution',title:'核对实际订单贡献额为负的原因',signal:`${low.length}笔签收订单录入成本高于净收款。`,hypothesis:'可能与运费、包装或退款有关；先检查成本完整性。',action:'核对原单与成本凭据，比较规格、地区、退款原因，决定是否调整。',metric:'订单贡献额与同口径成本',sourceRef:low.slice(0,20).map(x=>x.id).join('；')});
  const observations=summary.rows.filter(x=>x.kind==='signals');if(observations.length)signals.push({key:'market-signals',title:'核对市场与消费者观察',signal:`已登记${observations.length}条有来源的市场、内容或履约观察。最新一条：${observations[0].title}。`,hypothesis:'观察可能提供选题、商品说明或履约优化线索，尚未核实代表性。',action:'回看原始来源，选一个可执行问题，必要时建立小范围验证与内容任务。',metric:'问题是否被证据支持、是否形成具体执行及回写',sourceRef:observations.slice(0,20).map(x=>x.id).join('；')});
  const created=[];for(const s of signals){const exists=await one(db,`SELECT id FROM workflow_items WHERE kind='decisions' AND data->>'ruleKey'=$1 AND data->>'status' IN ('proposed','adopted','executed')`,[s.key]);if(exists)continue;const defaults=Object.fromEntries(WORKFLOWS.decisions.fields.map(f=>[f.key,f.type==='select'?Object.keys(f.options)[0]:'']));const saved=await saveWorkflow(db,req.user,'decisions',null,{data:{...defaults,...s,risk:'本地规则整理，未调用在线模型；数据反映观察，原因和行动需OPC确认。',status:'proposed'}},{ruleKey:s.key});created.push(saved);}
  send(res,{created:created.length,cards:created,message:created.length?'已生成有数据依据的待判断建议卡':'没有新增可诊断信号，或同类建议仍待处理；不会补造建议'});
 });
 r.post('/workflow/customers/from-record/:id',requireRole('admin','operator'),async(req,res)=>{const record=await one(db,'SELECT * FROM business_records WHERE id=$1',[req.params.id]);if(!record)fail(404,'来源记录不存在');const existing=await one(db,"SELECT * FROM workflow_items WHERE kind='customers' AND data->>'sourceRecordId'=$1",[record.id]);if(existing)return send(res,row(existing));const d=record.data;send(res,await saveWorkflow(db,req.user,'customers',null,{data:{name:d.name,region:d.region,contact:d.contact,sourceRecordId:record.id,segment:d.scene||'other',tags:'',repurchaseIntent:'unknown',contactPurpose:'service',marketingConsent:false,consentRef:'',followupDate:'',nextAction:'先处理来源记录，再确认服务回访安排',followupResult:'',sourceRef:record.id}}),201);});
 r.get('/workflow/:kind/export',requireRole('admin','operator'),async(req,res)=>{const kind=req.params.kind;if(!Object.hasOwn(WORKFLOWS,kind))fail(404,'类别不存在');const rows=(await db.query('SELECT * FROM workflow_items WHERE kind=$1 ORDER BY created_at DESC',[kind])).rows;await audit(db,req.user,'workflow.export',kind,{rows:rows.length});sendCSV(res,'taoxiang-'+kind,['编号','版本',...WORKFLOWS[kind].fields.map(f=>f.label)],rows.map(x=>[x.id,x.version,...WORKFLOWS[kind].fields.map(f=>f.type==='select'?(f.options[x.data[f.key]]||x.data[f.key]):x.data[f.key])]));});
 r.get('/workflow/:kind',async(req,res)=>{const k=req.params.kind;if(!Object.hasOwn(WORKFLOWS,k))fail(404,'类别不存在');if(req.user.role==='editor'&&k!=='tasks')fail(403,'内容编辑只能查看本人任务');const args=[k];const w=req.user.role==='editor'?(args.push(req.user.id)," AND data->>'assigneeId'=$2") :'';send(res,(await db.query('SELECT * FROM workflow_items WHERE kind=$1'+w+' ORDER BY created_at DESC',args)).rows.map(row));});
 r.get('/workflow/:kind/:id/history',async(req,res)=>{const item=await one(db,'SELECT * FROM workflow_items WHERE id=$1 AND kind=$2',[req.params.id,req.params.kind]);if(!item)fail(404,'记录不存在');if(req.user.role==='editor'&&(item.kind!=='tasks'||item.data.assigneeId!==req.user.id))fail(403,'无权查看');send(res,(await db.query('SELECT h.*,u.name actor_name FROM workflow_history h LEFT JOIN users u ON u.id=h.actor_id WHERE item_id=$1 ORDER BY h.id DESC',[item.id])).rows);});
 r.post('/workflow/:kind',requireRole('admin','operator'),async(req,res)=>send(res,await saveWorkflow(db,req.user,req.params.kind,null,req.body),201));
 r.patch('/workflow/:kind/:id',requireRole('admin','operator','editor'),async(req,res)=>send(res,await saveWorkflow(db,req.user,req.params.kind,req.params.id,req.body)));
 return r;
}
