/* Local implementation of the API contract. Replace the adapter to connect a server. */
(() => {
  'use strict';
  const KEY = 'peach-northflank-demo:v3';
  const fresh = () => ({version:3, records:[], logs:[], ops:{draft:null, revision:0, checks:Array(7).fill(false), publications:[]}});
  let db = fresh(), storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.version === 3 && Array.isArray(saved.records) && Array.isArray(saved.logs) &&
      Array.isArray(saved.ops?.checks) && saved.ops.checks.length === 7 && Array.isArray(saved.ops.publications)) db = saved;
  } catch { storageAvailable = false; }
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2,8));
  function error(status, message) { const e = new Error(message); e.status = status; throw e; }
  const clean = (v, max = 500) => typeof v === 'string' ? v.trim().slice(0,max) : '';
  function commit(next, method, path, entityId) {
    next.logs.unshift({id:id('LOG'), method, path, entityId, at:new Date().toISOString(), mode:'local'});
    next.logs = next.logs.slice(0,100);
    try { localStorage.setItem(KEY, JSON.stringify(next)); storageAvailable = true; }
    catch { storageAvailable = false; }
    db = next;
    window.dispatchEvent(new CustomEvent('peach:datachange'));
  }
  function local(method, path, payload) {
    const url = new URL(path,'http://local.demo');
    const p = url.pathname;
    if (method === 'GET' && p === '/api/facts') {
      const dataset = url.searchParams.get('dataset') || 'consumer';
      if (!['consumer','opc','farmer','interview'].includes(dataset)) error(404,'数据集不存在');
      return {dataset, rows:window.PeachSurveyData[dataset] || [], sourceRef:dataset === 'consumer' ? '01_消费者调研问卷.csv' : dataset === 'opc' ? '02_学生与OPC调研问卷.csv' : '附件01、02、04、06', status:'research'};
    }
    if (method === 'GET' && p === '/api/catalog') {
      const scene = url.searchParams.get('scene');
      if (scene && !['family','gift','group'].includes(scene)) error(422,'场景参数不正确');
      return productData.filter(x => !scene || x.scene === scene);
    }
    if (method === 'GET' && /^\/api\/batches\//.test(p)) {
      if (p.split('/').pop() !== 'SP-2026-06') error(404,'未找到该批次。试用 SP-2026-06 查看示例。');
      return {batchId:'SP-2026-06',status:'example',originName:'连平县上坪镇（示例，待核验）',harvestDate:null,stock:null,shippingFee:null,aftercareRule:null,steps:traceData};
    }
    if (method === 'GET' && p === '/api/ip/xiaotaoman') return {characterId:'xiaotaoman',sourceRef:'icanAIOPC 商业策划书 4.2',series:ipData};
    if (method === 'GET' && p === '/api/ops/tasks') return clone(db.ops);
    if (method === 'GET' && p === '/api/records') return clone(db.records);
    if (method === 'GET' && p === '/api/logs') return clone(db.logs);
    if (method === 'GET' && p === '/api/content/matrix') return Object.entries(ipData).map(([key,v])=>({id:key,...v,status:'design'}));
    if (method === 'GET' && p === '/api/tours/routes') return {id:'tour-shangping',name:'一日桃乡',status:'concept',openDates:[],capacity:null,bookingAvailable:false};
    if (method === 'GET' && p === '/api/service/faq') return {status:'batch_confirmation_required',rules:['发货日期和运费按当季批次确认','签收时留存外箱、面单与果品照片','按公开批次规则核验售后，页面不承诺退款结果']};
    if (method === 'GET' && p === '/api/presentation/competition') return {steps:['问题与证据','消费者路径','IP 辅助营销','协作与推广'],mode:'local'};
    const next = clone(db);
    if (method === 'POST' && ['/api/consultations','/api/service/claims','/api/tours/inquiries'].includes(p)) {
      if (payload.consent !== true) error(422,'请确认仅在此设备保存台账记录。');
      const kind = p.includes('claims') ? 'claim' : p.includes('tours') ? 'tour' : 'consultation';
      const name = clean(payload.name,40), region = clean(payload.region,80), note = clean(payload.note,800);
      if (!name || !region) error(422,'请填写称呼和收货／出行地区。');
      const record = {id:id(kind==='tour'?'TOUR':kind==='claim'?'CARE':'ASK'),kind,name,region,note,status:'pending',reply:'',createdAt:new Date().toISOString(),mode:'local'};
      if (kind === 'consultation') {
        const product = productData.find(x=>x.id === payload.productId && x.id !== 'ip-card');
        if (!product) error(422,'请选择鲜果或礼盒规格。IP 物料请使用素材功能。');
        if (!Number.isInteger(payload.quantity) || payload.quantity < 1 || payload.quantity > 999) error(422,'数量应为 1—999 的整数。');
        Object.assign(record,{productId:product.id,productName:product.name,quantity:payload.quantity,scene:product.scene,shippingFee:null,total:null});
      }
      if (kind === 'claim') {
        if (!['damage','storage','shipping','other'].includes(payload.issue)) error(422,'请选择反馈类型。');
        if (note.length < 5) error(422,'请至少用 5 个字说明问题。');
        Object.assign(record,{issue:payload.issue,batchId:clean(payload.batchId,50) || '未提供',photoNames:Array.isArray(payload.photoNames)?payload.photoNames.slice(0,3).map(x=>clean(x,160)):[]});
      }
      if (kind === 'tour') {
        const date = clean(payload.date,10), today = new Date();
        const minDate = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
        const parsedDate = new Date(date + 'T00:00:00Z');
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0,10) === date;
        if (!validDate || date < minDate || !Number.isInteger(payload.people) || payload.people < 1 || payload.people > 50) error(422,'请选择今天或之后的有效日期，人数为 1—50。');
        Object.assign(record,{date,people:payload.people,bookingConfirmed:false});
      }
      next.records.unshift(record); commit(next,method,p,record.id); return clone(record);
    }
    if (method === 'PATCH' && /^\/api\/records\//.test(p)) {
      const record = next.records.find(x=>x.id === decodeURIComponent(p.split('/').pop()));
      if (!record) error(404,'记录不存在，可能已经在另一标签页被清空。');
      if (!['pending','processing','resolved'].includes(payload.status)) error(422,'状态不正确。');
      if (payload.status === 'resolved' && clean(payload.reply).length < 5) error(422,'完成前请填写至少 5 个字的处理备注。');
      Object.assign(record,{status:payload.status,reply:clean(payload.reply,800),updatedAt:new Date().toISOString()});
      commit(next,method,p,record.id); return clone(record);
    }
    if (method === 'PATCH' && p === '/api/ops/tasks/current') {
      const ops = next.ops;
      if (payload.action === 'draft') {
        if (clean(payload.body,3000).length < 10) error(422,'草稿正文至少 10 个字。');
        const title = clean(payload.title,80), body = clean(payload.body,3000);
        if (!title) error(422,'请填写草稿标题。');
        if (ops.draft?.title === title && ops.draft?.body === body) return clone(ops);
        ops.revision++; ops.checks = Array(7).fill(false);
        ops.draft = {id:'DRAFT-current',title,body,status:'draft',revision:ops.revision,sourceRefs:['icanAIOPC 商品方案','附件02 分拣与物流访谈','C14 / C20'],updatedAt:new Date().toISOString()};
      } else if (payload.action === 'submit') {
        if (!ops.draft) error(422,'请先保存一份内容草稿。');
        if (/48\s*小时(必达|送达|到货)|绝对安全|零农残|保证(增收|销量)|包治/.test(ops.draft.body)) error(422,'草稿含未经核验的承诺，请修改后再提交。');
        if (ops.draft.status === 'published') error(409,'此版本已生成本地发布记录；修改草稿可开始新一轮。');
        ops.draft.status = 'submitted';
      } else if (payload.action === 'review') {
        if (!ops.draft || !['submitted','published'].includes(ops.draft.status)) error(422,'先保存草稿并提交复核，再勾选演练清单。');
        if (!Number.isInteger(payload.index) || payload.index < 0 || payload.index > 6 || typeof payload.checked !== 'boolean') error(422,'复核项参数不正确。');
        ops.checks[payload.index] = payload.checked;
        if (!payload.checked) ops.draft.status = 'submitted';
      } else error(422,'不支持的任务动作。');
      commit(next,method,p,'DRAFT-current'); return clone(ops);
    }
    if (method === 'POST' && p === '/api/ops/publish') {
      const ops = next.ops;
      if (!ops.draft || !['submitted','published'].includes(ops.draft.status) || !ops.checks.every(Boolean)) error(422,'草稿提交复核并完成全部 7 项演练检查后才能生成发布记录。');
      const existing = ops.publications.find(x=>x.revision===ops.revision);
      if (existing) { ops.draft.status = 'published'; commit(next,method,p,existing.id); return clone(existing); }
      const record = {id:id('PUB'),revision:ops.revision,title:ops.draft.title,body:ops.draft.body,sourceRefs:ops.draft.sourceRefs,createdAt:new Date().toISOString(),mode:'local',status:'local_published'};
      ops.publications.unshift(record); ops.draft.status = 'published';
      commit(next,method,p,record.id); return clone(record);
    }
    error(404,'该接口或请求方法尚未实现。');
  }
  const request = async (method,path,payload={}) => {
    await new Promise(resolve=>setTimeout(resolve,140));
    if (typeof path !== 'string' || !path.startsWith('/api/')) error(422,'请求路径应以 /api/ 开头。');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) error(422,'请求体须为 JSON 对象。');
    return {data:clone(local(method.toUpperCase(),path,payload)),meta:{mode:'local',persisted:storageAvailable,requestId:id('REQ'),updatedAt:new Date().toISOString()}};
  };
  window.PeachAPI = {
    request,
    snapshot:()=>clone(db),
    get storageAvailable(){return storageAvailable;},
    reset:()=>{const next=fresh();commit(next,'DELETE','/api/local-data','local');},
    contract:[
      ['GET','/api/facts?dataset=consumer','读取调查选项、人数、比例和来源'],
      ['GET','/api/catalog?scene=family','按场景读取参考商品'],
      ['GET','/api/batches/SP-2026-06','读取批次资料，未知值返回 null'],
      ['GET','/api/ip/xiaotaoman','读取 IP 栏目与角色资料'],
      ['POST','/api/consultations','保存规格、数量、地区与咨询意向'],
      ['GET','/api/records','读取三类本地业务记录'],
      ['PATCH','/api/records/:recordId','更新跟进状态和处理备注'],
      ['GET','/api/ops/tasks','读取草稿、复核与发布快照'],
      ['PATCH','/api/ops/tasks/current','保存草稿、提交复核或更新检查项'],
      ['POST','/api/ops/publish','校验 7 项后生成本地发布记录'],
      ['GET','/api/content/matrix','读取六类内容栏目'],
      ['GET','/api/tours/routes','读取路线与待核验开放条件'],
      ['POST','/api/tours/inquiries','保存出行意向，不确认预约'],
      ['GET','/api/service/faq','读取收货与售后说明'],
      ['POST','/api/service/claims','保存问题和照片文件名'],
      ['GET','/api/presentation/competition','读取赛事演示路径'],
      ['GET','/api/logs','读取本地操作日志']
    ]
  };
  window.addEventListener('storage',e=>{
    if(e.key!==KEY)return;
    try {
      const other=JSON.parse(e.newValue);
      if(other?.version===3 && Array.isArray(other.records) && Array.isArray(other.ops?.checks) && other.ops.checks.length===7 && Array.isArray(other.ops.publications)){
        db=other;window.dispatchEvent(new CustomEvent('peach:externalchange'));
      }
    }catch{/* Retain the current valid state. */}
  });
})();
