(() => {
  'use strict';
  if(window.PEACH_CONFIG?.mode!=='server')return;
  const previous=window.PeachAPI;
  let db={records:[],logs:[],ops:{draft:null,revision:0,checks:Array(7).fill(false),publications:[]}};
  let csrf='',user=null,cms=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const events=()=>window.dispatchEvent(new CustomEvent('peach:datachange'));
  function apply(content){cms=content;window.PeachCMS=content;
    productData=content.products;
    scenarioData=Object.fromEntries(content.scenarios.map(s=>[s.id,{...s,product:content.products.find(p=>p.id===s.productId)?.name||'暂无已发布推荐规格'}]));
    traceData=Object.fromEntries(content.trace_steps.map(s=>[s.id,[s.title,s.description,s.owner,s.state]]));
    ipData=Object.fromEntries(content.ip_series.map(s=>[s.id,s]));
    for(const dataset of ['consumer','opc','farmer'])window.PeachSurveyData[dataset]=content.survey_rows.filter(r=>r.dataset===dataset).map(r=>({...r,n:r.denominator,percent:Number((r.count/r.denominator*100).toFixed(dataset==='farmer'?2:1))}));
    window.PeachSurveyData.interview=content.interviews;
  }
  async function request(method,path,payload={}){
    if(typeof path!=='string'||!path.startsWith('/api/')||path.startsWith('/api//')||path.includes('://'))throw Error('请求路径须为本站/api/接口');
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('请求体须为JSON对象');
    method=method.toUpperCase();const headers={'X-Peach-Request':'1'};if(csrf)headers['X-CSRF-Token']=csrf;
    if(window.PeachAnalytics?.sessionId)headers['X-Analytics-Session']=window.PeachAnalytics.sessionId;
    if(window.PeachAnalytics?.optOut)headers['X-Analytics-Optout']='1';
    let body;
    if(method!=='GET'&&method!=='HEAD'){
      headers['Idempotency-Key']=crypto.randomUUID();
      if(payload.files?.length){body=new FormData();const{files,...data}=payload;body.append('payload',JSON.stringify(data));for(const f of files)body.append('photos',f);}
      else{headers['Content-Type']='application/json';body=JSON.stringify(payload);}
    }
    let response;
    const bootstrap=method==='GET'&&path.startsWith('/api/bootstrap'),timeout=bootstrap?90000:20000;
    for(let attempt=0;attempt<2;attempt++){
      try{response=await fetch(path,{method,headers,body,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(timeout)});}
      catch(error){if(method==='GET'&&attempt===0&&error.name!=='TimeoutError'){await new Promise(resolve=>setTimeout(resolve,700));continue;}throw Error(error.name==='TimeoutError'?'服务响应较慢，请稍后重试；免费服务休眠后首次启动可能需要等待。':'网络暂时未连接，请检查网络后重试。');}
      if(method==='GET'&&attempt===0&&[502,503,504].includes(response.status)){await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,700));continue;}break;
    }
    const json=await response.json().catch(()=>{throw Error('服务暂时未就绪，请稍后点击重试。');});
    if(!response.ok){const e=Error(json.error?.message||'请求未完成');e.status=response.status;throw e;}
    if(method==='GET'&&path.startsWith('/api/records'))db.records=json.data;
    if(path==='/api/ops/tasks'||path==='/api/ops/tasks/current')db.ops=json.data;
    if(method==='POST'&&['/api/consultations','/api/service/claims','/api/tours/inquiries'].includes(path)){db.records=[json.data,...db.records.filter(r=>r.id!==json.data.id)];}
    if(path==='/api/ops/publish'){db.ops.publications=[json.data,...db.ops.publications.filter(p=>p.id!==json.data.id)];if(db.ops.draft)db.ops.draft.status='published';}
    if(method!=='GET')events();return json;
  }
  const ready=(async()=>{const preview=new URLSearchParams(location.search).get('preview');const r=await request('GET','/api/bootstrap'+(preview?'?preview='+encodeURIComponent(preview):''));apply(r.data.content);user=r.data.user;csrf=r.data.csrf||'';db.records=r.data.records;db.ops=r.data.ops;return true;})();
  window.PeachAPI={request,ready,mode:'server',snapshot:()=>clone(db),get user(){return user;},get cms(){return cms;},storageAvailable:true,reset:()=>{throw Error('正式后台不允许从前台清空数据，请在后台管理');},contract:[['GET','/api/facts?dataset=consumer','问卷事实与有效分母'],['GET','/api/catalog','已发布规格'],['GET','/api/batches/:batchId','批次事实与当前余量'],['GET','/api/ip/xiaotaoman','IP角色与栏目'],['GET','/api/content/matrix','IP内容矩阵'],['GET','/api/content/published','已审核的站内发布'],['GET','/api/tours/routes','路线与接待条件'],['GET','/api/service/faq','收货与售后规则'],['GET','/api/presentation/competition','赛事讲解'],['GET','/api/records','当前访客记录'],['POST','/api/consultations','提交商品咨询'],['POST','/api/service/claims','提交售后反馈，照片通过业务表单上传'],['POST','/api/tours/inquiries','提交路线意向'],['GET','/api/ops/tasks','成员：运营草稿快照'],['PATCH','/api/ops/tasks/current','成员：新建草稿；修改须draftId和revision'],['POST','/api/ops/publish','运营：指定draftId与revision发布'],['GET','/api/admin/workflow/schema','成员：项目流程与经营表单'],['GET','/api/admin/workflow/summary','运营/只读：实际经营看板'],['GET','/api/admin/workflow/orders','运营/只读：订单台账'],['GET','/api/admin/workflow/customers','运营/只读：客户回访'],['GET','/api/admin/analytics/summary','运营/只读：匿名访问汇总']]};
  window.addEventListener('focus',async()=>{try{if(cms){const r=await request('GET','/api/records?limit=100');db.records=r.data;events();}}catch{/* The next visible action reports a connection failure. */}});
})();
