import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {openDatabase,migrate} from '../server/db.js';
import {seed} from '../server/content.js';
import {createApp} from '../server/app.js';
let db,server,base;
class Visitor {
  cookies=new Map();
  async request(path,method='GET',body){
    const r=await fetch(base+'/api/cloud'+path,{method,headers:{'Content-Type':'application/json','X-Peach-Request':'1',Cookie:[...this.cookies].map(p=>p.join('=')).join('; ')},body:body===undefined?undefined:JSON.stringify(body)});
    for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');this.cookies.set(p.slice(0,i),p.slice(i+1));}
    return{status:r.status,...await r.json()};
  }
}
before(async()=>{
 db=await openDatabase({url:'',dataDir:'memory://'});await migrate(db);await seed(db);
 const app=createApp(db,{disableLimits:true,secret:'season-regression-2026'.repeat(3)});await app.locals.ready;
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await new Promise(r=>server.close(r));await db.close();});

test('participation updates one stable record and isolates each visitor',async()=>{
 const a=new Visitor(),b=new Visitor();await a.request('/my');await b.request('/my');
 const first=await a.request('/activities','POST',{type:'stage',stageId:'flower',message:'花开时带家人来',active:true});
 assert.equal(first.status,201);assert.equal(first.data.version,1);
 const second=await a.request('/activities','POST',{type:'stage',stageId:'flower',message:'改约周末赏花',active:true});
 assert.equal(second.data.id,first.data.id);assert.equal(second.data.version,2);
 assert.equal((await a.request('/my')).data.activities.length,1);
 assert.equal((await b.request('/my')).data.activities.length,0);
 assert.equal((await a.request('/activities','POST',{type:'wish',stageId:'care',message:'   '})).status,422);
 assert.equal((await a.request('/activities','POST',{type:'stage',stageId:'unknown',message:'x'})).status,422);
 const save={type:'favorite',stageId:'fruit',message:'',active:true};
 await a.request('/activities','POST',save);await a.request('/activities','POST',{...save,active:false});
 const fav=(await a.request('/my')).data.activities.find(x=>x.type==='favorite');assert.equal(fav.active,false);assert.equal(fav.version,2);
});

test('gift preview needs a code; receipt survives refresh and claim is idempotent',async()=>{
 const giver=new Visitor(),recipient=new Visitor(),third=new Visitor();await giver.request('/my');await recipient.request('/my');await third.request('/my');
 const {data:g}=await giver.request('/gifts','POST',{from:'小满',to:'远方的朋友',message:'七月把山野的甜寄给你。'});
 assert.equal((await recipient.request('/gifts/'+g.id+'?code=WRONG')).status,404);
 const preview=await recipient.request('/gifts/'+g.id+'?code='+g.code);
 assert.equal(preview.data.message,g.message);assert.equal(preview.data.code,undefined);
 const [one,two]=await Promise.all([recipient.request('/gifts/'+g.id+'/claim','POST',{code:g.code}),recipient.request('/gifts/'+g.id+'/claim','POST',{code:g.code})]);
 assert.equal(one.status,200);assert.equal(two.status,200);
 assert.equal((await third.request('/gifts/'+g.id+'/claim','POST',{code:g.code})).status,409);
 const mine=(await recipient.request('/my')).data;
 assert.equal(mine.receivedGifts.length,1);assert.equal(mine.receivedGifts[0].giftId,g.id);assert.equal(mine.receivedGifts[0].message,g.message);assert.equal(mine.receivedGifts[0].code,undefined);
 assert.equal((await giver.request('/my')).data.gifts[0].status,'已领取');
 assert.equal((await giver.request('/my')).data.receivedGifts.length,0);
});

const clientSource=await readFile(new URL('../season-data.js',import.meta.url),'utf8');
function client({values={},denied=false,server=false,fetcher}={}){
 const events=[],window={CLOUD_SEED:{plans:[{id:'tree',price:299,name:'认养一棵桃'}]},PEACH_CONFIG:server?{mode:'server'}:{mode:'static'},dispatchEvent:e=>events.push(e.type)};
 const localStorage={getItem:k=>{if(denied)throw Error('denied');return values[k]??null;},setItem:(k,v)=>{if(denied)throw Error('denied');values[k]=v;}};
 vm.runInNewContext(clientSource,{window,localStorage,Event,crypto:globalThis.crypto,setTimeout,clearTimeout,AbortController,fetch:fetcher});
 return{store:window.PeachSeasonData,events,values};
}
test('local experience migrates earlier records and keeps repeated intents stable',async()=>{
 const c=client({values:{'peach-cloud-v1':JSON.stringify({my:[{id:'SIM-OLD',planId:'tree'}]})}});assert.equal((await c.store.init()).my.intents[0].id,'SIM-OLD');
 const body={planId:'tree',quantity:2,idempotencyKey:'local-one',nickname:'小禾'};
 const one=await c.store.intent(body,[{id:'tree',name:'认养一棵桃',price:299}]);const two=await c.store.intent(body,[{id:'tree',price:299}]);
 assert.equal(one.id,two.id);assert.equal(one.amount,598);assert.equal((await c.store.refresh()).intents.length,2);
});
test('damaged or unavailable storage keeps current-page actions usable',async()=>{
 for(const options of [{values:{'taoxiang-independent:season:v2':'damaged-json'}},{denied:true}]){
  const {store}=client(options);assert.equal((await store.init()).my.intents.length,0);assert.equal(store.volatile,true);
  await store.activity({type:'wish',stageId:'care',message:'与家人分享',active:true});assert.equal((await store.refresh()).activities[0].message,'与家人分享');
 }
});
test('server errors remain visible to callers and preserve failed action input',async()=>{
 let fail=false;const {store,values}=client({server:true,fetcher:async url=>({ok:!fail,status:fail?503:200,json:async()=>fail?{error:{message:'测试连接中断'}}:{data:url.endsWith('/bootstrap')?{plans:[]}:{intents:[],gifts:[],receivedGifts:[],activities:[],feedback:[],visits:[]}}})});
 await store.init();fail=true;const payload={planId:'tree',quantity:1,idempotencyKey:'server-one',nickname:'小禾'};
 await assert.rejects(store.intent(payload,[]),/测试连接中断/);assert.equal(payload.nickname,'小禾');assert.deepEqual(values,{});
});
