import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,one} from '../server/db.js';
import {seed,published} from '../server/content.js';
import {createApp} from '../server/app.js';
import {createDemoApp,openDemoDatabase,seedDemo} from '../server/demo.js';
import {WORKFLOWS} from '../server/workflow-schema.js';
import {saveWorkflow,orderAmounts} from '../server/workflow.js';
import {validateContent} from '../server/modules.js';
import {seedDemoScenarios} from '../server/demo-scenarios.js';
let real,demo,db,server,base,csrf='',cookies='';
async function request(path,{method='GET',body,redirect='follow'}={}){const response=await fetch(base+path,{method,headers:{'X-Peach-Request':'1','Content-Type':'application/json','X-CSRF-Token':csrf,Cookie:cookies},body:body?JSON.stringify(body):undefined,redirect});for(const item of response.headers.getSetCookie()){const pair=item.split(';')[0];if(pair.startsWith('peach_nf_demo_session='))cookies=pair;}const json=await response.json().catch(()=>null);if(json?.data?.csrf)csrf=json.data.csrf;return{response,data:json?.data,error:json?.error};}
before(async()=>{real=await openDatabase({url:'',dataDir:'memory://'});await migrate(real);await seed(real);demo=await createDemoApp(real,{demoDataDir:'memory://',secret:'demo-test-'.repeat(5),disableLimits:true});db=demo.locals.demoDatabase;server=createApp(real,{secret:'real-test-'.repeat(5),disableLimits:true,demoApp:demo}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});
after(async()=>{if(server)await new Promise(r=>server.close(r));await new Promise(r=>setTimeout(r,60));await db?.close();await real?.close();});
test('test1 login redirects to demo API and cannot authenticate against real data',async()=>{
 const first=await request('/api/auth/login',{method:'POST',body:{email:'test1',password:'123456'},redirect:'manual'});assert.equal(first.response.status,307);assert.equal(first.response.headers.get('location'),'/demo/api/auth/login');
 assert.equal((await request('/demo/api/auth/login',{method:'POST',body:{email:'test1',password:'wrong'}})).response.status,401);
 const login=await request('/api/auth/login',{method:'POST',body:{email:'test1',password:'123456'}});assert.equal(login.response.status,200);assert.equal(login.data.user.demo,true);assert.ok(cookies.startsWith('peach_nf_demo_session='));assert.equal((await request('/demo/api/auth/me')).response.status,200);assert.equal((await request('/api/auth/me')).response.status,401);assert.equal((await request('/api/admin/workflow/orders')).response.status,401);
 assert.equal(Number((await one(real,"SELECT count(*) n FROM users WHERE email='test1'")).n),0);assert.equal(Number((await one(real,'SELECT count(*) n FROM workflow_items')).n),0);
});
test('all seven workflow types self-save with valid references and statuses',async()=>{
 const user=await one(db,"SELECT * FROM users WHERE email='test1'");for(const [kind,def]of Object.entries(WORKFLOWS)){const rows=(await db.query('SELECT * FROM workflow_items WHERE kind=$1',[kind])).rows;assert.ok(rows.length,kind+' nonempty');for(const row of rows){for(const f of def.fields){const value=row.data[f.key];if(f.type==='select')assert.ok(Object.hasOwn(f.options,value),kind+'.'+f.key+' valid option');if(f.type==='number'&&value!==null)assert.equal(typeof value,'number');}const saved=await saveWorkflow(db,user,kind,row.id,{data:row.data,version:row.version});assert.equal(saved.id,row.id);}}
 const customer=(await one(db,"SELECT data FROM workflow_items WHERE kind='customers'")).data;assert.equal(customer.marketingConsent,false);assert.equal(customer.contactPurpose,'service');
});
test('demo batches, amounts, snapshots and stock reconcile',async()=>{
 const orders=(await db.query("SELECT data FROM workflow_items WHERE kind='orders'")).rows.map(r=>r.data);assert.equal(orders.length,18);assert.deepEqual(new Set(orders.map(d=>d.status)),new Set(['draft','confirmed','shipped','completed','cancelled']));
 for(const d of orders){if(d.status!=='draft')assert.equal(d.receivedAmount,orderAmounts(d).total);assert.ok(d.refundAmount<=d.receivedAmount);assert.ok(d.productSnapshot?.name);assert.equal(d.batchSnapshot.batchId,d.batchId);assert.equal(d.batchSnapshot.productId,d.productId);assert.doesNotMatch(d.note,/模拟/);if(d.status==='completed')assert.ok(d.receivedAt>=d.shippedAt);if(d.status==='cancelled')assert.equal(d.receivedAmount,d.refundAmount);}
 const batch=(await published(db,'batches')).find(b=>b.id==='DEMO-BATCH');assert.equal(batch.availableQuantity,87);assert.equal(batch.allocatedQuantity,13);assert.doesNotThrow(()=>validateContent('batches',batch));
 const boot=await request('/demo/api/bootstrap');assert.equal(boot.response.status,200);assert.equal(boot.data.user.demo,true);assert.ok(boot.data.content.products.length);assert.ok(boot.data.content.batches.length);
});
test('operational and AI dashboards provide nonempty sales, user, inventory and visitor series',async()=>{
 const summary=await request('/demo/api/admin/workflow/summary');assert.equal(summary.response.status,200);assert.equal(summary.data.completed,14);assert.equal(summary.data.customers,5);assert.ok(summary.data.totals.netReceipts>0);
 const ai=await request('/demo/api/admin/ai/dashboard');assert.equal(ai.response.status,200);assert.equal(ai.data.example,true);assert.equal(ai.data.sales.daily.length,7);assert.equal(ai.data.sales.orders,14);assert.ok(ai.data.audience.pv>0);assert.ok(ai.data.audience.devices.length>0);assert.ok(ai.data.audience.regions.length>0);assert.ok(ai.data.inventory.some(b=>b.id==='DEMO-BATCH'&&b.remaining===87));
 assert.deepEqual(new Set(ai.data.inventory.map(b=>b.state)),new Set(['normal','low','empty','unknown']));assert.equal(ai.data.sales.daily.reduce((n,d)=>n+d.orders,0),ai.data.sales.orders);assert.equal(ai.data.sales.daily.reduce((n,d)=>n+Math.round(d.netReceipts*100),0),Math.round(ai.data.sales.netReceipts*100));assert.equal(ai.data.audience.regions.reduce((n,r)=>n+r.value,0),ai.data.sales.orders);assert.equal(ai.data.audience.devices.reduce((n,r)=>n+r.value,0),ai.data.audience.pv);
 const analytics=await request('/demo/api/admin/analytics/summary');assert.equal(analytics.response.status,200);for(const key of ['daily','pages','sources','devices','clicks','conversions'])assert.ok(analytics.data[key].length,key+' series nonempty');
});

test('simulation covers task decisions experiments and private project material examples',async()=>{
 for(const kind of ['tasks','decisions','experiments']){const statuses=new Set((await db.query('SELECT data FROM workflow_items WHERE kind=$1',[kind])).rows.map(r=>r.data.status));assert.deepEqual(statuses,new Set(Object.keys(WORKFLOWS[kind].fields.find(f=>f.key==='status').options)));}
 const accepted=(await db.query("SELECT data FROM workflow_items WHERE kind='tasks' AND data->>'status'='accepted'")).rows;assert.ok(accepted.length);for(const {data}of accepted){assert.ok(data.paidFee<=data.agreedFee);assert.match(data.paymentRef,/结算凭据/);assert.notEqual(data.assigneeId,data.reviewerId);}
 const sources=(await db.query("SELECT draft,published FROM content_items WHERE module='source_library' AND slug LIKE 'DEMO-V3-%'")).rows;assert.ok(sources.length>=4);for(const s of sources){assert.equal(s.published,null);assert.doesNotMatch(s.draft.body,/模拟/);}
 assert.equal(Number((await one(real,"SELECT count(*) n FROM workflow_items WHERE id LIKE 'DEMO-%'")).n),0);
});

test('rolling demo dates preserve edited records and never duplicate samples',async()=>{
 const isolated=await createDemoApp(real,{demoDataDir:'memory://',secret:'rolling-demo-only-'.repeat(3),disableLimits:true}),d=isolated.locals.demoDatabase;
 try{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  await seedDemoScenarios(d,{today:yesterday});const count=Number((await one(d,'SELECT count(*) n FROM workflow_items')).n);
  await d.query("UPDATE workflow_items SET data=jsonb_set(data,'{note}','\"【模拟】人工修改保留\"'),version=version+1 WHERE id='DEMO-V3-ORDER-01'");
  await d.query("UPDATE content_items SET published=NULL,status='archived' WHERE module='products' AND slug='fresh-5'");
  await seedDemoScenarios(d,{today});assert.equal(Number((await one(d,'SELECT count(*) n FROM workflow_items')).n),count);assert.equal((await one(d,"SELECT data FROM workflow_items WHERE id='DEMO-V3-ORDER-01'")).data.note,'【模拟】人工修改保留');assert.equal((await one(d,"SELECT data FROM workflow_items WHERE id='DEMO-V3-ORDER-07'")).data.receivedAt,today);
 }finally{await d.close();}
});
test('public demo cannot create or restore business backups before multipart parsing',async()=>{const before=Number((await one(db,'SELECT count(*) n FROM content_items')).n);const backup=await request('/demo/api/admin/backup');assert.equal(backup.response.status,403);assert.match(backup.error.message,/演示/);const restore=await request('/demo/api/admin/restore',{method:'POST',body:{confirmation:'恢复并覆盖当前业务数据'}});assert.equal(restore.response.status,403);assert.match(restore.error.message,/演示/);assert.equal(Number((await one(db,'SELECT count(*) n FROM content_items')).n),before);});
test('demo public-media and claim uploads share the persistent site budget',async()=>{const day=new Date().toISOString().slice(0,10);await db.query('CREATE TABLE IF NOT EXISTS demo_material_usage(bucket text PRIMARY KEY,used integer NOT NULL,expires_at timestamptz NOT NULL)');await db.query("INSERT INTO demo_material_usage(bucket,used,expires_at) VALUES($1,20,now()+interval '2 days')",['upload:site:'+day]);for(const path of ['/demo/api/admin/media','/demo/api/service/claims']){const result=await request(path,{method:'POST',body:{}});assert.equal(result.response.status,429,path);assert.match(result.error.message,/额度/);}await db.query('DELETE FROM demo_material_usage');});
test('demo mutations stay isolated and seed is idempotent',async()=>{
 const user=await one(db,"SELECT * FROM users WHERE email='test1'"),old=await one(db,"SELECT * FROM workflow_items WHERE kind='customers'");const updated=await saveWorkflow(db,user,'customers',old.id,{version:old.version,data:{...old.data,name:'【模拟】隔离修改'}});assert.equal(updated.data.name,'【模拟】隔离修改');assert.equal(Number((await one(real,'SELECT count(*) n FROM workflow_items WHERE id=$1',[old.id])).n),0);
 const count=(await one(db,'SELECT count(*) n FROM workflow_items')).n;await seedDemo(db);assert.equal((await one(db,'SELECT count(*) n FROM workflow_items')).n,count);assert.equal((await one(db,'SELECT data FROM workflow_items WHERE id=$1',[old.id])).data.name,'【模拟】隔离修改');
});
test('Neon wrapper contains search_path in each transaction without altering TLS/URL options',async()=>{
 const calls=[],client={query:async(sql,args)=>{calls.push([sql,args]);if(sql==='SELECT fail')throw Error('intentional');return{rows:[{n:1}]};},release:()=>calls.push(['release'])},pool={connect:async()=>client,end:async()=>calls.push(['end'])},realFake={kind:'postgres',query:async sql=>{calls.push(['real:'+sql]);return{rows:[]};}};
 const isolated=await openDemoDatabase(realFake,{url:'postgres://ignored.test/db?sslmode=require',pool});assert.equal(isolated.schema,'peach_demo');await isolated.query('SELECT 1');assert.deepEqual(calls.slice(1).map(r=>r[0]),['BEGIN','SET LOCAL search_path TO peach_demo','SELECT 1','COMMIT','release']);calls.length=0;await assert.rejects(()=>isolated.transaction(tx=>tx.query('SELECT fail')),/intentional/);assert.deepEqual(calls.map(r=>r[0]),['BEGIN','SET LOCAL search_path TO peach_demo','SELECT fail','ROLLBACK','release']);await isolated.close();
});
