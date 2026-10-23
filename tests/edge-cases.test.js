import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate,one} from '../server/db.js';
import {seed} from '../server/content.js';
import {saveWorkflow} from '../server/workflow.js';
import {WORKFLOWS} from '../server/workflow-schema.js';
import {createBackup,restoreBackup} from '../server/backup.js';
import {range} from '../server/analytics.js';

let db,customer,serial=0;
const admin={id:'edge-admin',role:'admin',name:'检查管理员'},operator={id:'edge-operator',role:'operator',name:'检查运营'},editor={id:'edge-editor',role:'editor',name:'检查执行人'};
const defaults=kind=>Object.fromEntries(WORKFLOWS[kind].fields.map(f=>[f.key,f.type==='number'?null:f.type==='checkbox'?false:f.type==='select'?Object.keys(f.options)[0]:'']));
const create=(kind,data,user=admin)=>saveWorkflow(db,user,kind,null,{data:{...defaults(kind),...data}});
const update=(item,data,user=admin,target=db)=>saveWorkflow(target,user,item.kind,item.id,{version:item.version,data:{...item.data,...data}});
const rejects=(promise,status)=>assert.rejects(promise,e=>e.status===status);

before(async()=>{
 db=await openDatabase({url:'',dataDir:'memory://'});await migrate(db);await seed(db);
 for(const u of [admin,operator,editor])await db.query('INSERT INTO users(id,email,name,role,password_hash,must_change_password) VALUES($1,$2,$3,$4,$5,false)',[u.id,u.id+'@test.local',u.name,u.role,'not-used-by-direct-tests']);
 const sample=await one(db,"SELECT * FROM content_items WHERE module='batches' LIMIT 1"),data={...sample.published,batchId:'EDGE-REAL',productId:'fresh-5',status:'verified',stock:100};
 await db.query("INSERT INTO content_items(id,module,slug,title,draft,published,status) VALUES('batches--EDGE-REAL','batches','EDGE-REAL','检查批次',$1,$1,'published')",[JSON.stringify(data)]);
 customer=await create('customers',{name:'独立检查客户',sourceRef:'仅测试库来源'});
});
after(async()=>{await db.close();});

async function confirmedOrder(){let item=await create('orders',{title:'边界订单'+(++serial),customerId:customer.id,productId:'fresh-5',batchId:'EDGE-REAL',externalOrderNo:'EDGE-'+serial,sourceRef:'仅测试库收款凭据',quantity:1,unitPrice:65,shippingCharged:0,receivedAmount:65,refundAmount:0,shippingRegion:'测试地区'});return update(item,{status:'confirmed'});}
async function submittedTask(){let item=await create('tasks',{title:'边界协作任务',assigneeId:editor.id,reviewerId:operator.id,requirements:'保留真实事实和人工审核',factSource:'独立测试材料',agreedFee:20});item=await update(item,{trainingStatus:'completed',trainingRef:'实际培训测试凭据',status:'assigned'});return update(item,{status:'submitted',deliverableType:'external',deliverableId:'测试交付物编号',minutes:30,reworks:0},editor);}

test('marketing authorization always needs evidence even before a marketing action is scheduled',async()=>{
 await rejects(create('customers',{name:'授权检查',sourceRef:'测试来源',marketingConsent:true,contactPurpose:'service'}),422);
});
test('known experiment counts are checked even when another denominator is still unknown',async()=>{
 await rejects(create('experiments',{title:'分母检查',hypothesis:'同口径观察',variantA:'A',variantB:'B',sourceRef:'测试口径',visitorsA:null,consultationsA:2,buyersA:3}),422);
});
test('completed experiments cannot claim observations from a future period',async()=>{
 await rejects(create('experiments',{title:'未来日期检查',hypothesis:'同口径观察',variantA:'A',variantB:'B',sourceRef:'测试口径',startDate:'2099-01-01',endDate:'2099-01-02',visitorsA:10,visitorsB:10,consultationsA:2,consultationsB:2,buyersA:1,buyersB:1,status:'completed',choice:'adjust',conclusion:'测试结论'}),422);
});
test('confirmed orders cannot erase original receipts when cancelling',async()=>{
 const item=await confirmedOrder();await rejects(update(item,{status:'cancelled',receivedAmount:0,refundAmount:0,note:'改成零不能代替实际退款'}),422);
});
test('cancellation preserves confirmed product and batch snapshots',async()=>{
 const item=await confirmedOrder(),cancelled=await update(item,{status:'cancelled',refundAmount:65,note:'原渠道全额退款凭据'});
 assert.deepEqual(cancelled.data.productSnapshot,item.data.productSnapshot);assert.deepEqual(cancelled.data.batchSnapshot,item.data.batchSnapshot);
});
test('task return requires the designated reviewer as acceptance does',async()=>{
 const item=await submittedTask();await rejects(update(item,{status:'rework',reviewNote:'非指定审核人退回'},admin),403);
 const returned=await update(item,{status:'rework',reviewNote:'指定运营要求补充来源'},operator);assert.equal(returned.data.status,'rework');
});
test('accepted task settlement remains writable after the original executor is deactivated',async()=>{
 let item=await submittedTask();item=await update(item,{status:'accepted',reviewNote:'已检查交付和来源'},operator);
 await db.query('UPDATE users SET active=false WHERE id=$1',[editor.id]);
 try{const paid=await update(item,{paidFee:20,paymentRef:'外部结算测试凭据'});assert.equal(paid.data.paidFee,20);}finally{await db.query('UPDATE users SET active=true WHERE id=$1',[editor.id]);}
});
test('business backup restores into an instance with different accounts and permits historical settlement',async()=>{
 let item=await submittedTask();item=await update(item,{status:'accepted',reviewNote:'独立测试验收'},operator);
 const buffer=await createBackup(db),other=await openDatabase({url:'',dataDir:'memory://'}),newAdmin={id:'new-local-admin',name:'新实例管理员',role:'admin'};
 try{await migrate(other);await other.query('INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5)',[newAdmin.id,'new@instance.local',newAdmin.name,'admin','unused']);
  await restoreBackup(other,buffer);assert.ok(Number((await one(other,'SELECT count(*) n FROM workflow_items')).n)>0);assert.equal((await one(other,'SELECT created_by FROM workflow_items WHERE id=$1',[item.id])).created_by,null);
  const paid=await update(item,{paidFee:20,paymentRef:'迁移后补充的实际结算凭据'},newAdmin,other);assert.equal(paid.data.paidFee,20);
 }finally{await other.close();}
});
test('default analytics range uses the same UTC+8 calendar as daily reporting',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-18T17:00:00Z')});
 try{assert.deepEqual({start:range({}).start,end:range({}).end},{start:'2026-10-13',end:'2026-10-19'});}finally{t.mock.timers.reset();}
});
