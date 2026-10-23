import {openDatabase,migrate,one} from './db.js';
import {seed} from './content.js';
import {passwordHash} from './auth.js';
import {WORKFLOWS} from './workflow-schema.js';
import {validateContent} from './modules.js';
import {createApp} from './app.js';
import {seedDemoScenarios} from './demo-scenarios.js';
const DEMO_SCHEMA='peach_demo',SEED_KEY='demo_seed_v2';
const todayCN=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
const previousDay=(today,n)=>new Date(Date.parse(today+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
function defaults(def,today){return Object.fromEntries(def.fields.map(f=>[f.key,f.type==='checkbox'?false:f.type==='number'?0:f.type==='select'?Object.keys(f.options)[0]:f.type==='date'?today:f.type==='reference'?'':'模拟·'+f.label]));}

/** Isolated seed only; createDemoApp owns the demo database connection. */
export async function seedDemo(db){
 if(await one(db,'SELECT key FROM app_meta WHERE key=$1',[SEED_KEY])){await seedDemoScenarios(db);return;}
 const today=todayCN(),user='DEMO-ADMIN',password=await passwordHash('123456');
 await db.transaction(async tx=>{
  if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362018)');
  if(await one(tx,'SELECT key FROM app_meta WHERE key=$1',[SEED_KEY]))return;
  await tx.query("INSERT INTO users(id,email,name,role,password_hash,must_change_password) VALUES($1,'test1','【模拟】体验管理员','admin',$2,false) ON CONFLICT(email) DO UPDATE SET active=true,must_change_password=false,role='admin'",[user,password]);
  const identity=(await one(tx,"SELECT id FROM users WHERE email='test1'")).id;
  const put=async(kind,id,title,data)=>tx.query('INSERT INTO workflow_items(id,kind,title,data,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,data=EXCLUDED.data',[id,kind,'【模拟】'+title,JSON.stringify(data),identity]);
  const batch=validateContent('batches',{batchId:'DEMO-BATCH',productId:'fresh-5',status:'verified',originName:'模拟产地（非真实批次）',shippingOrigin:'模拟分拣点',harvestDate:previousDay(today,7),stock:100,shippingFee:0,shippingWindow:'模拟窗口，不构成实际承诺',grading:'模拟大果，5斤/箱',shippingRegions:'模拟广东区域，示例配送费0元，不作为实际报价',aftercareRule:'模拟流程：留存外箱、面单与果品照片，由运营核验，不自动确认退款。',owner:'模拟核验员',sourceRef:'DEMO，非真实库存或第三方核验',verifiedAt:previousDay(today,7),verificationCode:'DEMO-CODE-001'});
  await tx.query("INSERT INTO content_items(id,module,slug,title,draft,published,status) VALUES('batches--DEMO-BATCH','batches','DEMO-BATCH','【模拟】完整批次',$1,$1,'published') ON CONFLICT(id) DO UPDATE SET draft=EXCLUDED.draft,published=EXCLUDED.published",[JSON.stringify(batch)]);
  for(const [kind,def]of Object.entries(WORKFLOWS)){
   if(kind==='orders')continue;const data=defaults(def,today);data.sourceRef='DEMO-2026，仅供功能演示';
   if(kind==='collaborators')Object.assign(data,{name:'模拟协作者小林',active:true,training:'模拟培训记录，非真实人员'});
   if(kind==='customers')Object.assign(data,{name:'模拟客户A',contact:'演示站内联系（无真实号码）',region:'广东',sourceRecordId:'DEMO-CONSULT',marketingConsent:false,consentRef:'',contactPurpose:'service',repurchaseIntent:'interested'});
   if(kind==='signals')Object.assign(data,{sourceRecordId:'DEMO-CLAIM',productId:'fresh-5',batchId:'DEMO-BATCH',body:'模拟反馈：希望先看到规格、到手总价和当批售后规则。'});
   if(kind==='decisions')Object.assign(data,{status:'adopted',ownerId:identity,writebackId:'products--fresh-5',writebackCustomerId:'DEMO-customers',signal:'模拟问答多次出现总价问题',action:'补充首购规格说明，开展小范围测试',reason:'模拟采用理由：先把价格、配送和售后说明放在咨询之前。',result:'模拟待回访，不作为实际经营结论'});
   if(kind==='experiments')Object.assign(data,{decisionId:'DEMO-decisions',startDate:previousDay(today,6),endDate:today,visitorsA:100,visitorsB:100,consultationsA:12,consultationsB:16,buyersA:4,buyersB:5,status:'completed',choice:'adjust',conclusion:'模拟样本仅展示计算，不证明因果关系'});
   if(kind==='tasks')Object.assign(data,{assigneeId:'DEMO-collaborators',reviewerId:identity,trainingStatus:'completed',aiMode:'none',status:'assigned',deliverableType:'draft',deliverableId:'DEMO-DRAFT',minutes:30,reworks:1,agreedFee:30,paidFee:0,paymentRef:'',reviewNote:'模拟验收待完成'});
   await put(kind,'DEMO-'+kind,def.label+'示例',data);
  }
  const product=(await one(tx,"SELECT published FROM content_items WHERE module='products' AND slug='fresh-5'")).published;
  for(let i=0;i<7;i++){
   const date=previousDay(today,6-i),quantity=i%3+1;
   const data={...defaults(WORKFLOWS.orders,today),title:'模拟家庭装订单'+(i+1),customerId:'DEMO-customers',sourceRecordId:'DEMO-CONSULT',productId:'fresh-5',batchId:'DEMO-BATCH',channel:'offline',externalOrderNo:'DEMO-ORDER-'+i,sourceRef:'模拟收款凭据',quantity,unitPrice:65,shippingCharged:0,receivedAmount:quantity*65,refundAmount:0,goodsCost:quantity*32,packagingCost:5,logisticsCost:8,otherCost:0,shippingRegion:'广东',carrier:'模拟物流',trackingNo:'DEMO000'+i,shippedAt:date,receivedAt:date,receiptRef:'模拟签收凭据',status:'completed',note:'【模拟】界面演示；未实际成交、未收款、未发货。',productSnapshot:{name:product.name,sourceRef:product.sourceRef},batchSnapshot:batch};
   await put('orders','DEMO-ORDER-'+i,data.title,data);
   for(let j=0;j<3+i;j++)await tx.query("INSERT INTO analytics_events(id,visitor_hash,session_id,event,route,device,browser,os,country,referrer,created_at) VALUES($1,$2,$3,'pageview',$4,$5,'模拟浏览器','模拟系统','CN','模拟渠道',$6) ON CONFLICT(id) DO UPDATE SET created_at=EXCLUDED.created_at",['DEMO-EVENT-'+i+'-'+j,'DEMO-VISITOR-'+j,'DEMO-SESSION-'+i+'-'+j,['home','consumer','ip'][j%3],j%2?'手机':'电脑',date+'T08:00:00+08:00']);
   for(const [event,target,duration]of [['click','模拟查看批次',0],['engagement','',25],['conversion','consultation',0]])await tx.query('INSERT INTO analytics_events(id,visitor_hash,session_id,event,route,target,device,browser,os,country,duration,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING',['DEMO-'+event+'-'+i,'DEMO-VISITOR-0','DEMO-SESSION-'+i+'-0',event,'consumer',target,'手机','模拟浏览器','模拟系统','CN',duration,date+'T09:00:00+08:00']);
  }
  for(const[id,kind,status,note]of [['DEMO-CONSULT','consultation','pending','模拟：咨询5斤家庭装规格与配送。'],['DEMO-CLAIM','claim','processing','模拟：外箱有挤压，等待人工核验。'],['DEMO-TOUR','tour','resolved','模拟：走访意向，非预约确认。']])await tx.query('INSERT INTO business_records(id,kind,visitor_hash,data,status,reply) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',[id,kind,'DEMO-VISITOR',JSON.stringify({name:'模拟访客',region:'广东',contact:'无真实联系方式',productId:'fresh-5',productName:'5斤大果家庭装',quantity:1,note,consent:true,date:today,people:2,batchId:'DEMO-BATCH',issue:kind==='claim'?'damage':undefined}),status,'模拟跟进：已登记，待实际核验。']);
  await tx.query("INSERT INTO drafts(id,title,body,source_refs,owner_id) VALUES('DEMO-DRAFT','【模拟】小桃满随箱说明','模拟文案：先核对产地、重量、到手总价与配送安排。小桃满负责说明，运营负责核验。','[\"DEMO，非对外正式文案\"]',$1) ON CONFLICT(id) DO NOTHING",[identity]);
  const source=validateContent('source_library',{title:'【模拟】资料归档样例',category:'proposal',evidenceStatus:'plan',sourceRef:'DEMO-INPUT',body:'模拟资料：展示上传、分类、人工复核、草稿保存。无真实个人信息。',reviewNote:'全部为模拟内容'});
  await tx.query("INSERT INTO content_items(id,module,slug,title,draft,status) VALUES('source_library--DEMO-SOURCE','source_library','DEMO-SOURCE','【模拟】资料归档样例',$1,'draft') ON CONFLICT(id) DO NOTHING",[JSON.stringify(source)]);
  await tx.query("INSERT INTO app_meta(key,value) VALUES($1,'true') ON CONFLICT(key) DO NOTHING",[SEED_KEY]);
 });
 await seedDemoScenarios(db);
}

/** Preserve URI/TLS settings; local search_path survives transaction pooling without leaking into real queries. */
export async function openDemoDatabase(realDB,{url=process.env.DATABASE_URL,dataDir='.data/demo-postgres',pool:providedPool}={}){
 if(realDB.kind!=='postgres')return openDatabase({url:'',dataDir});
 await realDB.query('CREATE SCHEMA IF NOT EXISTS '+DEMO_SCHEMA);
 const pool=providedPool||new (await import('pg')).Pool({connectionString:url,max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:30000});
 async function transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');await client.query('SET LOCAL search_path TO '+DEMO_SCHEMA);const result=await fn(client);await client.query('COMMIT');return result;}catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}finally{client.release();}}
 return{kind:'postgres',schema:DEMO_SCHEMA,query:(sql,args=[])=>transaction(client=>client.query(sql,args)),transaction,close:()=>pool.end()};
}
export async function createDemoApp(realDB,options={}){
 const {demoDataDir,demoDatabaseURL,...appOptions}=options,db=await openDemoDatabase(realDB,{dataDir:demoDataDir||'.data/demo-postgres',url:demoDatabaseURL||process.env.DATABASE_URL});
 try{await migrate(db);await seed(db);await seedDemo(db);const app=createApp(db,{...appOptions,demoMode:true});app.locals.demoDatabase=db;await app.locals.ready;return app;}catch(e){await db.close();throw e;}
}
