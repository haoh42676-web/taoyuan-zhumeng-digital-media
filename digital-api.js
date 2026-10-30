/* Public adapter. Static experience never connects to the production database. */
(() => {
  'use strict';
  const server = window.PEACH_CONFIG?.mode === 'server';
  const base = server ? (window.PEACH_CONFIG.apiBase || '') : '';
  const key = 'peach-northflank-focused:v1';
  let user = null;
  let csrf = '';
  let cachedGallery = [];
  let cachedSeed = null;
  let seedPromise;
  let memoryStore = {}, memorySession = null, storageNotice = '', volatileStorage=false, volatileSession=false;
  let chatContext = {topics:[]}, knowledgePromise;
  const clone = value => typeof globalThis.structuredClone === 'function' ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
  function storageUnavailable() { storageNotice = '当前浏览器未允许保存体验记录，已改为本页临时使用；刷新或关闭后，部分记录可能无法保留。正式平台请使用账号查看服务端记录。';if(typeof Event==='function')window.dispatchEvent?.(new Event('digital:storage-notice')); }
  async function timedFetch(url, options = {}, milliseconds = 45000, consume = response => response) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), milliseconds);
    try { const response=await fetch(url, {...options, signal:controller.signal}); return await consume(response); }
    finally { clearTimeout(timer); }
  }
  const sampleProducts = [
    {id:'fresh-3',name:'3斤尝鲜装',subtitle:'先尝一箱，再认识这片桃园',weight:'3斤',grade:'分级方案待当季确认',origin:'广东桃乡，具体批次产地待核实',price:39,shippingFee:0,stock:36,availableStock:36,image:'assets/orchard/fruit-branch.webp',description:'适合初次尝鲜。果径、成熟度、实际装箱净重以当季批次确认信息为准。',dispatch:'确认订单后约定发货时间',regions:'具体可配送地区与运费由管理员确认',aftercare:'收货时检查外箱与果况；异常请保留照片并通过订单提交反馈。',batchCode:'示例批次 · 待核验',realEnabled:false,evidence:'规格、价格和库存为交互体验数据，不代表当前可售商品。',active:true},
    {id:'fresh-5',name:'5斤家庭装',subtitle:'一家人围坐时，刚好的分享',weight:'5斤',grade:'分级方案待当季确认',origin:'广东桃乡，具体批次产地待核实',price:59,shippingFee:0,stock:48,availableStock:48,image:'assets/orchard/fruit-branch.webp',description:'面向家庭分享的规格方案。甜度、口感及成熟度受当季气候和批次影响，不作统一数值承诺。',dispatch:'确认订单后约定发货时间',regions:'具体可配送地区与运费由管理员确认',aftercare:'请按到货成熟度保存，及时检查并反馈；赔付与处理方式经核实后确认。',batchCode:'示例批次 · 待核验',realEnabled:false,evidence:'规格、价格和库存为交互体验数据，不代表当前可售商品。',active:true},
    {id:'gift-5',name:'5斤礼赠装',subtitle:'把一份桃乡心意，认真送达',weight:'5斤',grade:'包装与分级方案待确认',origin:'广东桃乡，具体批次产地待核实',price:79,shippingFee:0,stock:24,availableStock:24,image:'assets/orchard/fruit-branch.webp',description:'配合小桃满IP的礼赠包装设计方案。包装效果与实际供货安排以管理员确认内容为准。',dispatch:'确认订单后约定发货时间',regions:'具体可配送地区与运费由管理员确认',aftercare:'下单前确认收件地区与时间；如有破损、延误或其他问题，可在订单中反馈。',batchCode:'示例批次 · 待核验',realEnabled:false,evidence:'规格、价格和库存为交互体验数据，不代表当前可售商品。',active:true}
  ];
  const defaultSite = {name:'数商桃乡',slogan:'数商桃乡，让好桃被看见',intro:'我们走进广东桃乡的桃园，用真实影像记录桃乡日常，让小桃满把一箱桃的故事、规格与服务讲清楚。',joinIntro:'欢迎愿意认真记录、学习推广和服务桃乡的你。先培训，再领任务；内容审核后才发布。',shippingNote:'不同地区的配送方式、运费与发货时间需逐单确认。页面示例不构成实际配送承诺。',aftercare:'到货后及时检查，保留外箱、面单和果况照片。通过对应订单提交问题，由管理员核实处理。'};
  const training = [
    {id:'facts',title:'第一课：把桃子的事实说清楚',body:'宣传使用已核实的产地、规格、批次与配送信息。糖度、时效和销量按对应记录表述，实拍呈现现场，小桃满帮助解释。',questions:[{question:'尚未检测本批次糖度，应该怎么写？',options:['保证每颗甜度相同','说明口感受批次影响，等待核验'],answer:1},{question:'订单提交后尚未付款，可以宣传为销量吗？',options:['可以，已提交就是已成交','不可以，提交、付款与完成要分开'],answer:1}],completed:false},
    {id:'service',title:'第二课：内容发布与服务边界',body:'先由成员提交内容，再由管理员审核发布。不公开消费者电话、地址、订单截图或内部资料。物流与售后需回到订单状态核实，AI文案只是草稿。',questions:[{question:'成员可以直接发布含顾客电话的截图吗？',options:['不可以，须保护个人信息','可以，能证明真实性'],answer:0},{question:'AI生成的脚本完成后下一步是什么？',options:['立即当成真实成片发布','核实事实并提交管理员审核'],answer:1}],completed:false}
  ];
  function read() { if(!volatileStorage)try { const raw=localStorage.getItem(key),value=raw?JSON.parse(raw):{};if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid experience record');memoryStore=value; } catch { volatileStorage=true;storageUnavailable(); } return clone(memoryStore); }
  function write(data) { memoryStore=clone(data);if(!volatileStorage)try { localStorage.setItem(key, JSON.stringify(data)); } catch { volatileStorage=true;storageUnavailable(); } }
  function localUser() { if(!volatileSession)try { const raw=sessionStorage.getItem(key + ':session'),value=raw?JSON.parse(raw):null;memorySession=value?.account==='test1'?value:null; } catch { volatileSession=true;storageUnavailable(); } return memorySession; }
  function saveLocalUser(value) { memorySession=value;if(!volatileSession)try { if(value)sessionStorage.setItem(key+':session',JSON.stringify(value));else sessionStorage.removeItem(key+':session'); } catch { volatileSession=true;storageUnavailable(); } }
  function mustLogin() { if (!user) throw Object.assign(new Error('请先登录后继续'), {status:401}); }
  function staticState() {
    const d=read();return {...d,site:{...defaultSite,...cachedSeed?.site,...d.site},products:(d.products || cachedSeed?.products || sampleProducts).map(p=>({version:1,...p})),gallery:d.gallery || cachedSeed?.gallery || cachedGallery,orders:d.orders || [],applications:d.applications || (d.application?[d.application]:[]),tasks:d.tasks || [],training:d.training || cachedSeed?.training || training};
  }
  function loadStaticSeed() {
    if(server)return Promise.resolve();
    if(!seedPromise)seedPromise=(async()=>{
      try {
        const data=await timedFetch('assets/digital-public.json',{cache:'force-cache'},12000,response=>response.ok?response.json():null);
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
        const {response,json} = await timedFetch(base + '/api' + path, {method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Peach-Request':'1','X-Customer-CSRF':csrf},body:body === undefined ? undefined : JSON.stringify(body)},45000,async response=>{if(readOnly&&attempt===0&&[502,503,504].includes(response.status))return {response,json:null};try{return {response,json:await response.json()};}catch(error){if(error.name==='AbortError')throw error;throw new Error('服务暂未返回有效结果，请稍后重试');}});
        if(readOnly && attempt===0 && [502,503,504].includes(response.status)){await retryPause();continue;}
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
    try { const j=await timedFetch('assets/orchard/gallery.json',{cache:'force-cache'},12000,r=>r.ok?r.json():null);if(j){cachedGallery=Array.isArray(j)?j:(j.items || j.photos || []);return cachedGallery;} } catch {}
    return [{id:'orchard-walk',title:'走进桃园',caption:'团队走访桃园的真实记录。照片呈现记录时的场景，不等同于当前在售批次。',category:'orchard',src:'assets/web/origin-walk.webp',alt:'团队在桃园实地走访'}];
  }
  const api = {
    server,
    get demo() {return !!window.PEACH_CONFIG?.demo || !!user?.demo;},
    get user() { return user; },
    get storageNotice() { return server ? '' : storageNotice; },
    async init() { if(server){const d=await request('/customer/session');user=d.user;csrf=d.csrf || '';}else {await loadStaticSeed();user=localUser();}return user; },
    async site() {if(server)return request('/digital/site');await Promise.all([gallery(),loadStaticSeed()]);const d=staticState();return {site:d.site,products:d.products,gallery:d.gallery,training:d.training};},
    async login(account,password,register=false) {if(server){const d=await request('/customer/'+(register?'register':'login'),{method:'POST',body:{account,password}});user=d.user;csrf=d.csrf;}else {if(register)throw new Error('静态体验不创建正式账号');if(account!=='test1'||password!=='123456')throw new Error('请使用体验账号 test1 / 123456');user={id:'static-visitor',account:'test1',name:'体验访客',demo:true};saveLocalUser(user);}return user;},
    async logout() {if(server)await request('/customer/logout',{method:'POST',body:{}});else saveLocalUser(null);user=null;csrf='';chatContext={topics:[]};},
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
    async submitTask(id,payload) {mustLogin();if(server)return request('/digital/member/tasks/'+encodeURIComponent(id)+'/submit',{method:'POST',body:payload});const d=staticState();if(d.applications[0]?.status!=='approved')throw new Error('成员申请尚未通过');if(d.training.some(x=>!x.completed))throw new Error('请先完成培训');const task=d.tasks.find(x=>x.id===id);if(!task)throw new Error('任务不存在');if(!['assigned','changes_requested'].includes(task.status))throw new Error('成果已提交，请等待审核反馈');Object.assign(task,{status:'submitted',submission:{...payload,createdAt:new Date().toISOString()}});write(d);return task;},
    async assist(payload) {mustLogin();if(server)return request('/digital/member/assist',{method:'POST',body:payload});const d=staticState();if(d.applications[0]?.status!=='approved')throw new Error('申请通过后才能使用成员工具');const p=d.products.find(x=>x.id===payload.productId);if(!p)throw new Error('请选择一个商品');return {body:payload.type==='script'?`【开场画面】桃园实拍，不使用库存照片冒充当前批次。\n【小桃满旁白】今天认识${p.name}，规格${p.weight}，产地${p.origin}。\n【产品特写】说明分级与成熟度，以${p.batchCode || '已确认批次'}的信息为准。\n【服务提示】${p.dispatch}；${p.regions}。\n【结尾】了解完整规格与到手总价，再决定是否下单。\n【发布前检查】核实事实、图片权利与个人信息，提交管理员审核。`:`${p.name}\n${p.description}\n规格：${p.weight}；产地：${p.origin}。\n配送：${p.dispatch}；${p.regions}。\n售后：${p.aftercare}\n${p.realEnabled?'请在下单前再次确认实际批次。':'此为交互体验方案，不代表当前实际供货。'}\n${payload.extra?'补充意向（待核验）：'+payload.extra:''}`,provider:'rules',modelUsed:false,label:'规则辅助草稿',notice:'草稿需核实商品事实并经管理员审核；脚本用于后续拍摄与剪辑。'};},
    async chat(message) {mustLogin();if(server)return request('/ai/chat',{method:'POST',body:{message,productId:'',recordId:''}});return localAnswer(message);},
    staticAdminRead() {if(server)throw new Error('线上管理须通过管理员登录与服务端授权');return clone(staticState());},
    staticAdminSave(section,value) {if(server)throw new Error('线上管理须通过管理员登录与服务端授权');if(!['site','products','gallery','orders','applications','tasks','training'].includes(section))throw new Error('不支持该体验数据分类');const d=staticState();if(section==='products')value=value.map(p=>({...p,version:Number(d.products.find(old=>old.id===p.id)?.version || 0)+1,availableStock:Math.max(0,Number(p.stock)||0)}));d[section]=value;write(d);return clone(d[section]);},
    clearExperience() {if(server)throw new Error('线上数据请在对应功能管理');memoryStore={};chatContext={topics:[]};try{localStorage.removeItem(key);}catch{volatileStorage=true;storageUnavailable();}}
  };
  async function publicKnowledge() {
    if(!knowledgePromise)knowledgePromise=new Promise(resolve=>{
      const timer=setTimeout(()=>resolve(null),12000);
      import('./project-knowledge.js').then(module=>{clearTimeout(timer);resolve(module);},()=>{clearTimeout(timer);resolve(null);});
    });
    return knowledgePromise;
  }
  async function localAnswer(message) {
    const knowledge=await publicKnowledge(),q=String(message||'').trim().slice(0,500);
    if(chatContext.at&&Date.now()-chatContext.at>30*60000)chatContext={topics:[]};
    const plan=knowledge?.classifyProjectMessage(q,{context:chatContext}) || {kind:/^(你好|您好|嗨|hello|hi|在吗)[！!?？。\s]*$/i.test(q)?'greeting':'clarify',topics:[]};
    const result=(answer,sources=[])=>({answer,sources,label:'小桃满 · 静态规则回答',provider:'rules',modelUsed:false,modelAttempted:false,modelAttempts:0});
    if(['privacy','unrelated'].includes(plan.kind))chatContext={topics:[]};
    if(plan.kind==='greeting')return result('在呢，我是小桃满。想挑一箱桃，聊聊桃乡的内容设计，还是了解调研和合作？直接说就好。');
    if(plan.kind==='thanks')return result('不客气～有想继续聊的，随时告诉我。');
    if(plan.kind==='acknowledgment')return result('好呀。你可以接着问刚才的内容，也可以换个项目问题。');
    if(plan.kind==='clarify')return result('可以。你想了解怎么选桃、怎么做小桃满内容，还是怎么参与调研和合作？说说你现在想做的事，我再帮你往下拆。');
    if(plan.kind==='privacy')return result('我可以介绍公开流程、账号管理和信息保护方式。你想先了解哪一项？');
    if(plan.kind==='unrelated')return result('这个话题超出了小桃满的项目服务范围。我可以帮你选桃、整理桃乡内容，或聊调研和合作。');
    const d=staticState(),old=chatContext,products=d.products.filter(p=>p.active!==false),topics=plan.topics||[],mention=knowledge?.resolveProductMention(q,products)||{matched:false},selected=mention.matched?mention.product:((plan.followup||topics.some(t=>['delivery','aftercare'].includes(t)))?products.find(p=>p.id===old.productId):null);
    chatContext={topics:topics.slice(0,3),productId:selected?.id||'',at:Date.now()};
    const topic=name=>topics.includes(name),query=plan.query||q,price=p=>`${p.name}：${p.weight}，商品金额¥${Number(p.price).toFixed(2)}，每单配送费¥${Number(p.shippingFee||0).toFixed(2)}${p.realEnabled?'':'（示例规格和价格，仅可模拟下单）'}。`;
    if(topic('platform')&&/忘记|找回|重置/.test(q)&&/密码|账号|登录/.test(q))return result('客户账号与后台工作人员账号分别管理。忘记密码时请通过站内公开合作入口说明账号问题，由管理员核实身份后处理；通过身份核验后可重设密码。静态体验可使用公开体验账号。');
    if(topic('platform')&&/保护|安全|泄露|存放|保存/.test(q)&&/密钥|API|隐私|资料|密码/i.test(q))return result('正式平台由服务端保管数据库连接和模型密钥，浏览器通过同源接口访问，并按账号权限读取本人记录。客服只使用允许公开的项目知识，不提供他人资料。这个静态备份不连接生产数据库，也不调用外部模型。');
    if(topic('aftercare')&&/保存|保鲜|冷藏|怎么吃|怎么放|放几天|放多久|存放多久|放多长时间/.test(query)&&!/退款|退货|赔|发霉/.test(q))return result((/偏?硬|没熟|未熟/.test(q)?'偏硬的话，先按随箱成熟度指南保存，轻拿轻放，定期检查果况。':/变软|偏?软|熟透/.test(q)?'已经变软的话，先检查有无破损或异常，尽快按随箱指南处理，避免挤压。':'先按随箱指南检查成熟度，把有压伤、需要尽快处理的果品分开，轻拿轻放，避免继续挤压。')+'具体温度和保存时间以当批说明为准。'+(/硬|软|熟/.test(q)?'如果出现异常果况，可通过对应订单提交照片请管理员核实。':'你手上的桃现在偏硬，还是已经变软了？'));
    if(topic('aftercare'))return result(`${selected?selected.name+'：'+selected.aftercare+'\n\n':''}${d.site.aftercare} 到“买桃下单 → 我的订单”打开对应订单提交反馈，由管理员核实。提交反馈不代表已经退款；静态站只模拟记录。`);
    if(topic('delivery'))return result(`${selected?selected.name+'：'+selected.dispatch+'；'+selected.regions+'。\n\n':''}${d.site.shippingNote} 已提交不代表已付款或发货；可在“买桃下单 → 我的订单”查看登记状态。静态站的模拟订单只保存在本浏览器，不会实际配送，也不提供实时快递轨迹。`);
    if(topic('sales')){
      const picks=selected?[selected]:products.slice(0,3),gift=/父母|爸妈|长辈|送人|送礼/.test(q),intro=gift?'送父母或朋友，可以先问清喜欢偏脆还是偏软、一次能吃多少，再核对包装和到货安排。':/甜|脆|软|硬|口感/.test(q)?'选口感可以先看当批成熟度和说明，再按份量与用途比较。':'先按用途、份量、预算和收货地区来比较。';
      return result(intro+'\n\n'+(picks.length?picks.map(price).join('\n'):'目前没有公开的可选商品，请稍后查看商品页。')+'\n\n规格、批次、配送和售后请在下单前确认。'+(gift?'你更在意份量、口感，还是包装？':'你是自己吃、和家人分享，还是送人？'));
    }
    if(topic('ip')&&/海报|封面|短视频|脚本|排版|文案|标题|宣传单|怎么做|怎么写|举例/.test(q))return result(/标题/.test(q)?'可以试试三个标题方向：“跟小桃满，走一趟桃园”“一箱桃里，藏着哪些认真？”“先看清一箱桃，再把心意送到”。\n\n配已授权的实拍，标题下面补上规格、配送与售后入口。这些是创作建议，发布前还要核对当前事实。':/宣传单/.test(q)?'宣传单可以分四块：一张已授权的桃园实拍、一句小桃满引导语、一组当前规格与商品金额、一处配送售后和选购入口。先用“数商桃乡，让好桃被看见”作主题，具体产地、批次与服务以已确认资料为准。':/文案|怎么写/.test(q)?'可以先用这段做草稿：\n\n“数商桃乡，让好桃被看见。跟着小桃满，看看桃园里的采摘与分拣，也把一箱桃的规格、配送和售后读明白。”\n\n配上一张已授权的产地实拍，让小桃满做引导。发布前核对当前商品信息，不写未经验证的糖度、销量或时效。':'可以从“桃园到一箱桃”开始：用已授权的桃园实拍开场，让小桃满介绍场景；接上采摘、分拣与装箱；最后把规格、配送和售后入口讲清楚。\n\n海报突出一张实拍与一句主题，短视频按三个镜头组织。你准备做哪一种？');
    if(topic('cooperation')||topic('opc'))return result(`${d.site.joinIntro}\n\n在“加入我们”提交意向，管理员审核通过后先完成培训，再领取自己的内容任务。提交照片、文案或脚本后还需审核。合作请说明可参与的角色、时间和内容；提交意向不代表已签约。静态站的申请和任务只在本浏览器模拟。`);
    const publicContent={products:products.map(p=>({id:p.id,name:p.name,price:'¥'+Number(p.price).toFixed(2),priceNote:p.realEnabled?'公开商品金额，配送另行确认':'示例价格，仅模拟下单',desc:p.description,fields:[['规格',p.weight]],sourceRef:'当前公开商品说明'})),tours:[]};
    const selectedKnowledge=knowledge?.selectProjectKnowledge(q,{context:old,publicContent}),facts=selectedKnowledge?.answerFacts?.slice(0,/详细|数据|分母|比例|全部/.test(q)?4:2)||[];
    if(facts.length)return result(facts.map(f=>f.text).join('\n\n'),facts.map(f=>({title:'项目公开资料',ref:f.source})));
    return result(d.site.intro+' 你可以从“桃乡见闻”看真实记录，到“买桃下单”了解规格，或在“加入我们”说明参与意向。');
  }
  window.DigitalAPI = api;
})();
