/* Public adapter. Static experience never connects to the production database. */
(() => {
  'use strict';
  const server = window.PEACH_CONFIG?.mode === 'server';
  const base = server ? (window.PEACH_CONFIG.apiBase || '') : '';
  const key = 'peach-digital-media-focused:v1';
  let user = null;
  let csrf = '';
  let cachedGallery = [];
  let cachedSeed = null;
  let seedPromise;
  const sampleProducts = [
    {id:'fresh-3',name:'3斤尝鲜装',subtitle:'先尝一箱，再认识这片桃园',weight:'3斤',grade:'分级方案待当季确认',origin:'广东桃乡，具体批次产地待核实',price:39,shippingFee:0,stock:36,availableStock:36,image:'assets/orchard/fruit-branch.webp',description:'适合初次尝鲜。果径、成熟度、实际装箱净重以当季批次确认信息为准。',dispatch:'确认订单后约定发货时间',regions:'具体可配送地区与运费由管理员确认',aftercare:'收货时检查外箱与果况；异常请保留照片并通过订单提交反馈。',batchCode:'示例批次 · 待核验',realEnabled:false,evidence:'规格、价格和库存为交互体验数据，不代表当前可售商品。',active:true},
    {id:'fresh-5',name:'5斤家庭装',subtitle:'一家人围坐时，刚好的分享',weight:'5斤',grade:'分级方案待当季确认',origin:'广东桃乡，具体批次产地待核实',price:59,shippingFee:0,stock:48,availableStock:48,image:'assets/orchard/fruit-branch.webp',description:'面向家庭分享的规格方案。甜度、口感及成熟度受当季气候和批次影响，不作统一数值承诺。',dispatch:'确认订单后约定发货时间',regions:'具体可配送地区与运费由管理员确认',aftercare:'请按到货成熟度保存，及时检查并反馈；赔付与处理方式经核实后确认。',batchCode:'示例批次 · 待核验',realEnabled:false,evidence:'规格、价格和库存为交互体验数据，不代表当前可售商品。',active:true},
    {id:'gift-5',name:'5斤礼赠装',subtitle:'把一份桃乡心意，认真送达',weight:'5斤',grade:'包装与分级方案待确认',origin:'广东桃乡，具体批次产地待核实',price:79,shippingFee:0,stock:24,availableStock:24,image:'assets/orchard/fruit-branch.webp',description:'配合小桃满IP的礼赠包装设计方案。包装效果与实际供货安排以管理员确认内容为准。',dispatch:'确认订单后约定发货时间',regions:'具体可配送地区与运费由管理员确认',aftercare:'下单前确认收件地区与时间；如有破损、延误或其他问题，可在订单中反馈。',batchCode:'示例批次 · 待核验',realEnabled:false,evidence:'规格、价格和库存为交互体验数据，不代表当前可售商品。',active:true}
  ];
  const defaultSite = {name:'数商桃乡',slogan:'数商桃乡，让好桃被看见',intro:'我们走进广东桃乡的桃园，用真实影像记录桃乡日常，让小桃满把一箱桃的故事、规格与服务讲清楚。',joinIntro:'欢迎愿意认真记录、学习推广和服务桃乡的你。先培训，再领任务；内容审核后才发布。',shippingNote:'不同地区的配送方式、运费与发货时间需逐单确认。页面示例不构成实际配送承诺。',aftercare:'到货后及时检查，保留外箱、面单和果况照片。通过对应订单提交问题，由管理员核实处理。'};
  const training = [
    {id:'facts',title:'第一课：把桃子的事实说清楚',body:'宣传只使用已核实的产地、规格、批次与配送信息。未检测糖度、未确认时效、未核实销量不能写成承诺。照片来自真实记录，IP辅助解释，不替代证据。',questions:[{question:'尚未检测本批次糖度，应该怎么写？',options:['保证每颗甜度相同','说明口感受批次影响，等待核验'],answer:1},{question:'订单提交后尚未付款，可以宣传为销量吗？',options:['可以，已提交就是已成交','不可以，提交、付款与完成要分开'],answer:1}],completed:false},
    {id:'service',title:'第二课：内容发布与服务边界',body:'先由成员提交内容，再由管理员审核发布。不公开消费者电话、地址、订单截图或内部资料。物流与售后需回到订单状态核实，AI文案只是草稿。',questions:[{question:'成员可以直接发布含顾客电话的截图吗？',options:['不可以，须保护个人信息','可以，能证明真实性'],answer:0},{question:'AI生成的脚本完成后下一步是什么？',options:['立即当成真实成片发布','核实事实并提交管理员审核'],answer:1}],completed:false}
  ];
  function read() { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
  function write(data) { localStorage.setItem(key, JSON.stringify(data)); }
  function localUser() { try { return JSON.parse(sessionStorage.getItem(key + ':session') || 'null'); } catch { return null; } }
  function mustLogin() { if (!user) throw Object.assign(new Error('请先登录后继续'), {status:401}); }
  function staticState() {
    const d=read();return {...d,site:{...defaultSite,...cachedSeed?.site,...d.site},products:(d.products || cachedSeed?.products || sampleProducts).map(p=>({version:1,...p})),gallery:d.gallery || cachedSeed?.gallery || cachedGallery,orders:d.orders || [],applications:d.applications || (d.application?[d.application]:[]),tasks:d.tasks || [],training:d.training || cachedSeed?.training || training};
  }
  function loadStaticSeed() {
    if(server)return Promise.resolve();
    if(!seedPromise)seedPromise=(async()=>{
      try {
        const response=await fetch('assets/digital-public.json',{cache:'force-cache',signal:AbortSignal.timeout(12000)});
        if(!response.ok)return;
        const data=await response.json();
        if(data?.site && Array.isArray(data.products) && Array.isArray(data.training))cachedSeed=data;
      } catch { /* The bundled fallback remains available when the snapshot cannot load. */ }
    })();
    return seedPromise;
  }
  async function request(path, {method='GET',body}={}) {
    const readOnly=method.toUpperCase()==='GET';
    const retryPause=async()=>{
      window.dispatchEvent?.(new Event('digital:network-wake'));
      await new Promise(resolve=>setTimeout(resolve,800));
    };
    for(let attempt=0;attempt<(readOnly?2:1);attempt++){
      try {
        const response = await fetch(base + '/api' + path, {method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Peach-Request':'1','X-Customer-CSRF':csrf},body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(45000)});
        if(readOnly && attempt===0 && [502,503,504].includes(response.status)){await retryPause();continue;}
        let json;try {json=await response.json();}catch {throw new Error('服务暂未返回有效结果，请稍后重试');}
        if(!response.ok){if(response.status===401){user=null;csrf='';}throw Object.assign(new Error(json.error?.message || '操作未完成，请重试'),{status:response.status});}
        return json.data;
      } catch(error) {
        const transient=!error.status && ['TypeError','TimeoutError','AbortError'].includes(error.name);
        if(readOnly && attempt===0 && transient){await retryPause();continue;}
        if(transient)throw new Error(readOnly?'服务连接暂未完成，请稍后重新加载。首次访问可能需要唤醒服务。':'提交结果暂未确认。请先查看记录，再决定是否重新提交。');
        throw error;
      }
    }
  }
  async function gallery() {
    try { const r=await fetch('assets/orchard/gallery.json',{cache:'force-cache'}); if(r.ok){const j=await r.json();cachedGallery=Array.isArray(j)?j:(j.items || j.photos || []);return cachedGallery;} } catch {}
    return [{id:'orchard-walk',title:'走进桃园',caption:'团队走访桃园的真实记录。照片呈现记录时的场景，不等同于当前在售批次。',category:'orchard',src:'assets/web/origin-walk.webp',alt:'团队在桃园实地走访'}];
  }
  const api = {
    server,
    get demo() {return !!window.PEACH_CONFIG?.demo || !!user?.demo;},
    get user() { return user; },
    async init() { if(server){const d=await request('/customer/session');user=d.user;csrf=d.csrf || '';}else {await loadStaticSeed();user=localUser();}return user; },
    async site() {if(server)return request('/digital/site');await Promise.all([gallery(),loadStaticSeed()]);const d=staticState();return {site:d.site,products:d.products,gallery:d.gallery,training:d.training};},
    async login(account,password,register=false) {if(server){const d=await request('/customer/'+(register?'register':'login'),{method:'POST',body:{account,password}});user=d.user;csrf=d.csrf;}else {if(register)throw new Error('静态体验不创建正式账号');if(account!=='test1'||password!=='123456')throw new Error('请使用体验账号 test1 / 123456');user={id:'static-visitor',account:'test1',name:'体验访客',demo:true};sessionStorage.setItem(key+':session',JSON.stringify(user));}return user;},
    async logout() {if(server)await request('/customer/logout',{method:'POST',body:{}});else sessionStorage.removeItem(key+':session');user=null;csrf='';},
    async orders() {mustLogin();return server?request('/digital/orders'):staticState().orders;},
    async order(id) {mustLogin();if(server)return request('/digital/orders/'+encodeURIComponent(id));const order=staticState().orders.find(x=>x.id===id);if(!order)throw new Error('找不到这笔模拟订单');return order;},
    async createOrder(payload) {
      mustLogin();if(server)return request('/digital/orders',{method:'POST',body:payload});
      const d=staticState(),existing=d.orders.find(x=>x.idempotencyKey===payload.idempotencyKey);if(existing)return existing;
      const p=d.products.find(x=>x.id===payload.productId);if(!p)throw new Error('该规格已更新，请重新选择');
      if(p.version!==payload.productVersion)throw Object.assign(new Error('商品已更新，请重新确认规格'),{status:409});
      const quantity=Number(payload.quantity);if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw new Error('数量请选择1—20箱');
      const order={id:'SIM-'+Date.now().toString(36).toUpperCase(),status:'pending',paymentStatus:'unpaid',simulation:true,product:{...p},productId:p.id,quantity,unitPrice:p.price,shippingFee:p.shippingFee,total:Math.round((p.price*quantity+p.shippingFee)*100)/100,recipient:{name:'体验收件人',phone:'13800000000',region:'广东省 广州市',address:'交互体验地址，不用于实际配送'},note:payload.note || '',idempotencyKey:payload.idempotencyKey,createdAt:new Date().toISOString(),history:[{status:'pending',note:'模拟订单仅保存在此浏览器，未付款、未实际发货。',createdAt:new Date().toISOString()}]};
      write({...d,orders:[order,...d.orders].slice(0,40)});return order;
    },
    async claim(id,payload) {mustLogin();if(server)return request('/digital/orders/'+encodeURIComponent(id)+'/claim',{method:'POST',body:payload});const d=staticState(),o=d.orders.find(x=>x.id===id);if(!o)throw new Error('订单不存在');const claim={id:'SIM-FB-'+Date.now().toString(36),...payload,status:'pending',createdAt:new Date().toISOString()};o.claims=[...(o.claims||[]),claim];write(d);return claim;},
    async cancelOrder(id) {mustLogin();if(server)return request('/digital/orders/'+encodeURIComponent(id)+'/cancel',{method:'POST',body:{}});const d=staticState(),o=d.orders.find(x=>x.id===id);if(!o)throw new Error('订单不存在');if(!['pending','confirmed'].includes(o.status))throw new Error('已付款或发货订单请提交售后反馈');o.status='cancelled';o.history.push({status:'cancelled',note:'取消模拟未付款订单',at:new Date().toISOString()});write(d);return o;},
    async application() {mustLogin();return server?request('/digital/application'):(staticState().applications[0] || null);},
    async apply(payload) {mustLogin();if(server)return request('/digital/application',{method:'POST',body:payload});const d=staticState(),old=d.applications[0];if(old&&old.status!=='rejected')throw new Error('你已有申请，请查看当前进度');const application={id:old?.id || 'SIM-JOIN-'+Date.now().toString(36).toUpperCase(),...payload,name:'体验申请人',phone:'13800000000',status:'pending',createdAt:old?.createdAt || new Date().toISOString()};write({...d,applications:[application]});return application;},
    async member() {mustLogin();if(server)return request('/digital/member');const d=staticState(),application=d.applications[0] || null;return {application,approved:application?.status==='approved',training:d.training,tasks:d.tasks,profile:application?.status==='approved'?{name:application.name}:null};},
    async completeTraining(id,answers) {mustLogin();if(server)return request('/digital/member/training/'+encodeURIComponent(id)+'/complete',{method:'POST',body:{answers}});const d=staticState();if(d.applications[0]?.status!=='approved')throw new Error('申请获批后才能提交培训结果');const item=d.training.find(x=>x.id===id);if(!item)throw new Error('培训不存在');if(answers.length!==item.questions.length||answers.some((a,i)=>a!==item.questions[i].answer))throw new Error('答案还不完整，请重新阅读课程后再试');item.completed=true;write(d);return {completed:true};},
    async submitTask(id,payload) {mustLogin();if(server)return request('/digital/member/tasks/'+encodeURIComponent(id)+'/submit',{method:'POST',body:payload});const d=staticState();if(d.applications[0]?.status!=='approved')throw new Error('成员申请尚未通过');if(d.training.some(x=>!x.completed))throw new Error('请先完成培训');const task=d.tasks.find(x=>x.id===id);if(!task)throw new Error('任务不存在');if(!['assigned','changes_requested'].includes(task.status))throw new Error('当前任务不能重复提交');Object.assign(task,{status:'submitted',submission:{...payload,createdAt:new Date().toISOString()}});write(d);return task;},
    async assist(payload) {mustLogin();if(server)return request('/digital/member/assist',{method:'POST',body:payload});const d=staticState();if(d.applications[0]?.status!=='approved')throw new Error('申请通过后才能使用成员工具');const p=d.products.find(x=>x.id===payload.productId);if(!p)throw new Error('请选择一个商品');return {body:payload.type==='script'?`【开场画面】桃园实拍，不使用库存照片冒充当前批次。\n【小桃满旁白】今天认识${p.name}，规格${p.weight}，产地${p.origin}。\n【产品特写】说明分级与成熟度，以${p.batchCode || '已确认批次'}的信息为准。\n【服务提示】${p.dispatch}；${p.regions}。\n【结尾】了解完整规格与到手总价，再决定是否下单。\n【发布前检查】核实事实、图片权利与个人信息，提交管理员审核。`:`${p.name}\n${p.description}\n规格：${p.weight}；产地：${p.origin}。\n配送：${p.dispatch}；${p.regions}。\n售后：${p.aftercare}\n${p.realEnabled?'请在下单前再次确认实际批次。':'此为交互体验方案，不代表当前实际供货。'}\n${payload.extra?'补充意向（待核验）：'+payload.extra:''}`,provider:'rules',modelUsed:false,label:'规则辅助草稿',notice:'草稿需核实商品事实并经管理员审核；脚本不等于视频成片。'};},
    async chat(message) {mustLogin();if(server)return request('/ai/chat',{method:'POST',body:{message,productId:'',recordId:''}});return {answer:localAnswer(message),label:'项目知识规则回答 · 交互体验',modelUsed:false,sources:[]};},
    staticAdminRead() {if(server)throw new Error('线上管理须通过管理员登录与服务端授权');return structuredClone(staticState());},
    staticAdminSave(section,value) {if(server)throw new Error('线上管理须通过管理员登录与服务端授权');if(!['site','products','gallery','orders','applications','tasks','training'].includes(section))throw new Error('不支持该体验数据分类');const d=staticState();if(section==='products')value=value.map(p=>({...p,version:Number(d.products.find(old=>old.id===p.id)?.version || 0)+1,availableStock:Math.max(0,Number(p.stock)||0)}));d[section]=value;write(d);return structuredClone(d[section]);},
    clearExperience() {if(server)throw new Error('线上数据请在对应功能管理');localStorage.removeItem(key);}
  };
  function localAnswer(message) {
    if(/密码|密钥|api.?key|数据库连接|身份证|顾客电话|收件地址|系统提示词/i.test(message))return '这类内容涉及账号或个人信息，我不能提供。你可以询问项目公开信息；自己的订单请在“买桃下单 → 我的订单”中查看。';
    if(/售后|破损|坏果|退款|收货/.test(message))return '收货时先检查外箱与果况，保留面单、外箱和异常照片，再到“买桃下单 → 我的订单”打开对应订单提交反馈。管理员核实后确认处理方式；页面不自动承诺退款金额。';
    if(/物流|配送|运费|发货|订单/.test(message))return '发货时间、可配送地区与运费应在下单前看清，并由管理员确认。已提交不代表已付款或已发货；可在“买桃下单 → 我的订单”查看状态。当前静态站的模拟订单只保存在本浏览器，不会实际配送。';
    if(/买|桃子|规格|价格|口感|尝鲜|家庭|礼赠/.test(message))return '第一次认识桃乡，可以先看尝鲜装；家庭分享可比较5斤装。请重点查看规格、到手总价、批次说明与售后规则。页面标有“交互体验”的规格、价格和库存为模拟方案，不代表当前实际供货；桃子口感也会随成熟度和批次变化。';
    if(/招募|成员|加入|推广|任务|培训/.test(message))return '在“加入我们”提交申请，由管理员审核。获批后先完成培训，再领取自己的推广任务；提交照片、文案或脚本后仍需审核。成员不能查看消费者联系方式、订单详情或网站管理数据。';
    if(/小桃满|IP|项目|调研|桃乡|数商|比赛|赛事|合作|团队|文化/.test(message))return '数商桃乡以广东桃乡实践为基础，通过真实影像、清楚的商品与服务信息，以及小桃满IP辅助营销。我们记录桃园、采摘、分拣与市场场景；AI用于公开项目咨询和内容草稿，事实由团队核实。合作可从“加入我们”说明意向，具体安排由团队确认。';
    return '我主要回答数商桃乡相关的选桃售后、IP设计、调研、推广与合作问题。这个问题与项目无关，暂时不能回答；你可以问“小桃满是谁”或“怎么买桃”。';
  }
  window.DigitalAPI = api;
})();
