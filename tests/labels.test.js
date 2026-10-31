import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../server/db.js';
import {seed} from '../server/content.js';
import {ensureCloudSchema} from '../server/cloud.js';
import {correctLabels,correctStoredLabels} from '../server/labels.js';
test('label corrections retain numeric amounts, record IDs and fulfillment states',()=>{
 const before={id:'SIM-P-001',amount:5456,status:'待确认',simulation:false,title:'模拟订单',rows:[{body:'模拟管护情景'}]};
 const after=correctLabels(before);assert.equal(after.title,'订单');assert.equal(after.rows[0].body,'成长管护安排');assert.equal(after.id,before.id);assert.equal(after.amount,5456);assert.equal(after.status,'待确认');assert.equal(before.title,'模拟订单');assert.deepEqual(correctLabels(after),after);
});
test('stored corrections are backed up transactionally, preserve money and run once',async()=>{
 const db=await openDatabase({url:'',dataDir:'memory://'});
 try{await migrate(db);await seed(db);await ensureCloudSchema(db);const old={id:'LABEL-LEGACY',simulation:true,amount:5456,status:'已关联模拟预订',paymentStatus:'待核对',title:'模拟管护情景'};
 await db.query("INSERT INTO cloud_items(id,kind,data) VALUES('LABEL-LEGACY','orders',$1)",[JSON.stringify(old)]);await correctStoredLabels(db);
 const row=(await db.query("SELECT data FROM cloud_items WHERE id='LABEL-LEGACY'")).rows[0].data;assert.equal(row.amount,5456);assert.equal(row.status,'已关联预订');assert.equal(row.paymentStatus,'待核对');assert.equal(row.simulation,false);assert.equal(row.title,'成长管护安排');
 const backup=(await db.query("SELECT value FROM app_meta WHERE key='record_labels_before_20261031_v4'")).rows[0].value;assert.deepEqual(backup.cloud_items.find(x=>x.id==='LABEL-LEGACY').data,old);await correctStoredLabels(db);assert.equal((await db.query("SELECT count(*) n FROM app_meta WHERE key='record_labels_before_20261031_v4'")).rows[0].n,1);
 }finally{await db.close();}
});
