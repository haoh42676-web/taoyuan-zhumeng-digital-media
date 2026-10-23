import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {WORKFLOWS,PROJECT_MAP} from '../server/workflow-schema.js';

const code=await readFile(new URL('../admin/workflow.js',import.meta.url),'utf8');
const data=kind=>Object.fromEntries(WORKFLOWS[kind].fields.map(f=>[f.key,f.type==='number'?null:f.type==='checkbox'?false:f.type==='select'?Object.keys(f.options)[0]:'']));
const order={id:'ORDER-UI',kind:'orders',version:1,title:'原订单名称',data:{...data('orders'),title:'原订单名称',quantity:1},updatedAt:'2026-10-18T10:00:00Z'};
function runtime(request,role='admin'){
 const listeners={},list={innerHTML:''},modals=[];
 const context=vm.createContext({window:{},document:{addEventListener:(type,handler)=>listeners[type]=handler},generation:1,editing:null,state:{user:{role}},
  api:async(path,options)=>path==='/admin/workflow/schema'?{modules:WORKFLOWS,map:PROJECT_MAP}:path==='/admin/workflow/options'?{}:request(path,options),
  $:selector=>selector==='#workflow-list'?list:null,$$:()=>[],canPublish:()=>['admin','operator'].includes(role),esc:v=>String(v??''),button:(label,action)=>`<button data-action="${action}">${label}</button>`,heading:(a,b,actions='')=>a+b+actions,table:(headers,rows)=>JSON.stringify(rows),paginate:()=>'',time:v=>v,
  blankData:def=>data(Object.keys(WORKFLOWS).find(k=>WORKFLOWS[k]===def)),modal:(title,html)=>modals.push({title,html}),notice:()=>{}});
 vm.runInContext(code,context);return{context,workflow:context.window.PeachWorkflow,list,listeners,modals};
}

test('late category responses cannot replace the records belonging to the current page',async()=>{
 let release,started;const requested=new Promise(r=>started=r);
 const rt=runtime(async path=>{if(path.endsWith('/customers')){started();return new Promise(r=>release=r);}return[order];});
 const old=rt.workflow.category('customers');await requested;rt.context.generation++;
 await rt.workflow.category('orders');release([{id:'CUSTOMER-OLD',kind:'customers',title:'迟到的客户数据',data:data('customers')}]);await old;
 await rt.workflow.action('workflow-edit',order.id);assert.match(rt.modals.at(-1).title,/查看与处理/);assert.match(rt.modals.at(-1).html,/原订单名称/);
});

test('operating export buttons follow the same role boundary as business data exports',async()=>{
 for(const role of ['admin','operator','viewer']){
  const rt=runtime(async()=>[],role);
  for(const kind of Object.keys(WORKFLOWS)){
   const html=await rt.workflow.category(kind);
   if(role==='viewer')assert.doesNotMatch(html,/data-action="workflow-export"/,role+' '+kind);
   else assert.match(html,/data-action="workflow-export"/,role+' '+kind);
  }
 }
 const editor=runtime(async()=>[],'editor');assert.doesNotMatch(await editor.workflow.category('tasks'),/data-action="workflow-export"/);
});

test('saving a record updates its list immediately as well as the editor',async()=>{
 const updated={...order,version:2,title:'保存后的订单名称',data:{...order.data,title:'保存后的订单名称'}};
 const rt=runtime(async(path,options)=>options?.method==='PATCH'?updated:[order]);await rt.workflow.category('orders');rt.workflow.list();await rt.workflow.action('workflow-edit',order.id);
 const elements=WORKFLOWS.orders.fields.map(f=>({value:order.data[f.key]??'',checked:false,disabled:false,willValidate:false}));
 WORKFLOWS.orders.fields.forEach((f,i)=>elements[f.key]=elements[i]);elements.title.value='保存后的订单名称';await rt.workflow.submit({elements});
 assert.match(rt.list.innerHTML,/保存后的订单名称/);
});

test('refreshing a filtered list retains the selected status visibly',async()=>{
 const rt=runtime(async()=>[order]);await rt.workflow.category('orders');rt.listeners.change({target:{id:'workflow-status',value:'confirmed'}});
 const html=await rt.workflow.category('orders');assert.match(html,/<option value="confirmed" selected>/);
});

test('confirmed order forms preserve original receipts while permitting actual refund updates',async()=>{
 const rt=runtime(async()=>[{...order,data:{...order.data,status:'confirmed',receivedAmount:65,refundAmount:0}}]);await rt.workflow.category('orders');await rt.workflow.action('workflow-edit',order.id);
 const html=rt.modals.at(-1).html;assert.match(html,/<input name="receivedAmount"[^>]*disabled/);assert.doesNotMatch(html,/<input name="refundAmount"[^>]*disabled/);
});

test('accepted task forms retain the agreement while allowing a settlement record',async()=>{
 const item={id:'TASK-UI',kind:'tasks',title:'已验收任务',version:3,data:{...data('tasks'),title:'已验收任务',status:'accepted',agreedFee:20}};
 const rt=runtime(async()=>[item]);await rt.workflow.category('tasks');await rt.workflow.action('workflow-edit',item.id);
 const html=rt.modals.at(-1).html;assert.match(html,/<input name="agreedFee"[^>]*disabled/);assert.doesNotMatch(html,/<input name="paidFee"[^>]*disabled/);
});

test('admin default date inputs include the current UTC+8 day after midnight',async()=>{
 const adminCode=await readFile(new URL('../admin/admin.js',import.meta.url),'utf8');
 const fakeNow=new Date('2026-10-18T17:00:00Z').getTime();
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[fakeNow]));}static now(){return fakeNow;}}
 const context=vm.createContext({Date:FixedDate});vm.runInContext(adminCode.slice(0,adminCode.indexOf('let generation='))+'\nglobalThis.initialRange={start:state.start,end:state.end};',context);
 assert.equal(context.initialRange.start,'2026-10-13');assert.equal(context.initialRange.end,'2026-10-19');
});

const adminSource=await readFile(new URL('../admin/admin.js',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const newAdmin={id:'new-admin',name:'Current administrator',role:'admin',demo:false,mustChangePassword:false};
const oldAdmin={id:'old-admin',name:'Previous identity',role:'viewer',demo:false,mustChangePassword:false};
const authResponse=(user,csrf)=>({data:{user,csrf}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function adminAuthRuntime({initialStatus=401,loginStatus=200,deferLogin=false}={}){
 const initialBody=deferred(),loginBody=deferred(),listeners={},requests=[];
 const element=()=>({hidden:false,open:false,isConnected:true,innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){}},addEventListener(){},prepend(){},close(){this.open=false;},showModal(){this.open=true;}});
 const nodes=Object.fromEntries(['workspace','login-screen','editor','navigation','current-user','sidebar','breadcrumb','main-content','notice','dialog-title','dialog-body'].map(id=>['#'+id,element()]));
 nodes['#workspace'].hidden=true;const password=element(),submit=element(),error=element();error.hidden=true;
 const form={...element(),id:'login-form',reset(){this.resetCalled=true;},querySelector(selector){if(selector==='[type="submit"]')return submit;if(selector==='.form-error')return error;throw Error('Unexpected form selector '+selector);}};
 const document={title:'',addEventListener(type,handler){listeners[type]=handler;},querySelector(selector){if(selector==='[data-action="password"]')return password;if(selector==='.demo-scope-banner')return null;if(nodes[selector])return nodes[selector];throw Error('Unexpected selector '+selector);},querySelectorAll(){return[];}};
 const response=(status,payload)=>({status,ok:status>=200&&status<300,json:async()=>payload});
 const context=vm.createContext({document,window:{addEventListener(){},PeachDigitalAdmin:{page:async()=>'<h1>Current workspace</h1>'}},location:{pathname:'/admin/',hash:''},Date,URLSearchParams,AbortSignal,setTimeout:()=>0,clearTimeout(){},
  FormData:class{constructor(){return new Map([['email','fixture-admin'],['password','fixture-only-password']]);}},
  fetch:async(url,options)=>{requests.push({url,method:options.method});if(url==='/api/auth/me')return{status:initialStatus,ok:initialStatus>=200&&initialStatus<300,json:()=>initialBody.promise};if(url==='/api/auth/login')return deferLogin?{status:loginStatus,ok:loginStatus>=200&&loginStatus<300,json:()=>loginBody.promise}:response(loginStatus,loginStatus===200?authResponse(newAdmin,'new-csrf'):{error:{message:'Invalid fixture login'}});if(url==='/api/admin/schema')return response(200,{data:{modules:{}}});if(url==='/api/admin/denied')return response(401,{error:{message:'Session expired'}});throw Error('Unexpected request '+url);}
 });
 vm.runInContext(adminSource,context);
 const snapshot=()=>JSON.parse(vm.runInContext('JSON.stringify({user:state.user?.id||null,csrf:state.csrf,route:state.route})',context));
 return{context,nodes,error,requests,initialBody,loginBody,snapshot,login:()=>listeners.submit({target:form,preventDefault(){}})};
}

test('a delayed initial 401 cannot hide the workspace after a successful manual login',async()=>{
 const h=adminAuthRuntime();await h.login();assert.equal(h.nodes['#workspace'].hidden,false);
 h.initialBody.resolve({error:{message:'Not signed in'}});await tick();
 assert.deepEqual(h.snapshot(),{user:'new-admin',csrf:'new-csrf',route:'overview'});assert.equal(h.nodes['#workspace'].hidden,false);assert.equal(h.nodes['#login-screen'].hidden,true);
});

test('a delayed initial identity cannot replace the account or CSRF token from a newer login',async()=>{
 const h=adminAuthRuntime({initialStatus:200});await h.login();h.initialBody.resolve(authResponse(oldAdmin,'old-csrf'));await tick();
 assert.deepEqual(h.snapshot(),{user:'new-admin',csrf:'new-csrf',route:'overview'});assert.equal(h.nodes['#workspace'].hidden,false);
});

test('a delayed initial network failure cannot reset a newer authenticated workspace',async()=>{
 const h=adminAuthRuntime({initialStatus:200});await h.login();h.initialBody.reject(new Error('Delayed initial timeout'));await tick();
 assert.equal(h.snapshot().user,'new-admin');assert.equal(h.nodes['#workspace'].hidden,false);assert.equal(h.nodes['#notice'].textContent,'');
});

test('starting manual login invalidates the initial check before the login response arrives',async()=>{
 const h=adminAuthRuntime({initialStatus:200,deferLogin:true}),login=h.login();h.initialBody.resolve(authResponse(oldAdmin,'old-csrf'));await tick();
 assert.equal(h.snapshot().user,null);assert.equal(h.nodes['#workspace'].hidden,true);assert.equal(h.requests.filter(r=>r.url==='/api/admin/schema').length,0);
 h.loginBody.resolve(authResponse(newAdmin,'new-csrf'));await login;assert.equal(h.snapshot().user,'new-admin');assert.equal(h.nodes['#workspace'].hidden,false);
});

test('an unchanged anonymous initial check still keeps the login screen available',async()=>{
 const h=adminAuthRuntime();h.initialBody.resolve({error:{message:'Not signed in'}});await tick();
 assert.equal(h.snapshot().user,null);assert.equal(h.nodes['#workspace'].hidden,true);assert.equal(h.nodes['#login-screen'].hidden,false);
});

test('an unchanged authenticated initial check still opens its workspace',async()=>{
 const h=adminAuthRuntime({initialStatus:200});h.initialBody.resolve(authResponse(oldAdmin,'old-csrf'));await tick();
 assert.equal(h.snapshot().user,'old-admin');assert.equal(h.snapshot().csrf,'old-csrf');assert.equal(h.nodes['#workspace'].hidden,false);assert.equal(h.nodes['#login-screen'].hidden,true);
});

test('an authenticated business request returning 401 still resets the login state',async()=>{
 const h=adminAuthRuntime();await h.login();await assert.rejects(vm.runInContext('api("/admin/denied")',h.context),/Session expired/);
 assert.equal(h.snapshot().user,null);assert.equal(h.nodes['#workspace'].hidden,true);assert.equal(h.nodes['#login-screen'].hidden,false);
 h.initialBody.resolve({error:{message:'Not signed in'}});await tick();
});
