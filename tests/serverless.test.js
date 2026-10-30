import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.js';
import {createDemoApp} from '../server/demo.js';

test('preprovisioned serverless apps do not migrate or seed on cold initialization',async()=>{
 let calls=0;
 const db={kind:'postgres',query:async()=>{calls++;throw new Error('cold startup must not issue SQL')},transaction:async()=>{calls++;throw new Error('cold startup must not start a transaction')}};
 const demo=await createDemoApp(db,{initialize:false,demoDatabaseURL:'postgresql://test:fake@localhost/unused'});
 try{const app=createApp(db,{initialize:false,demoApp:demo});await app.locals.ready;assert.equal(calls,0);}finally{await demo.locals.demoDatabase.close();}
});
