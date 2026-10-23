import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

async function adapter({blocked=false,broken=false,server=false}={}){
  const source=await readFile(new URL('../digital-api.js',import.meta.url),'utf8');
  const seed=JSON.parse(await readFile(new URL('../assets/digital-public.json',import.meta.url),'utf8'));
  const state=new Map(broken?[['peach-digital-media-focused:v1','not-json']]:[]);
  const storage={getItem:k=>{if(blocked)throw Error('Storage disabled');return state.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('Storage disabled');state.set(k,v);},removeItem:k=>{if(blocked)throw Error('Storage disabled');state.delete(k);}};
  const window={PEACH_CONFIG:{mode:server?'server':'local'},addEventListener(){},dispatchEvent(){}};
  const fetch=async path=>({ok:true,status:200,json:async()=>String(path).includes('/customer/session')?{data:{user:null,csrf:''}}:String(path).includes('/api/digital/site')?{data:seed}:structuredClone(seed)});
  runInNewContext(source,{window,localStorage:storage,sessionStorage:storage,fetch,setTimeout,clearTimeout,AbortController,URL,Date,Math,JSON,Promise,Error,Map,Set,Object,Number,String,Array,console,crypto:{getRandomValues:array=>array.fill(7)}});
  return {api:window.DigitalAPI,seed};
}

test('independent review: static order flow survives disabled browser storage and missing modern optional APIs',async()=>{
  const {api}=await adapter({blocked:true});
  await api.init();await api.login('test1','123456');const site=await api.site(),p=site.products[0];
  const order=await api.createOrder({productId:p.id,productVersion:p.version,quantity:1,idempotencyKey:'mobile-review-key',recipient:{name:'sample',phone:'13800000000',region:'sample',address:'sample only'},note:''});
  assert.equal(order.simulation,true);assert.equal((await api.orders()).length,1);assert.equal(api.staticAdminRead().products.length,3);
  await api.cancelOrder(order.id);assert.equal((await api.order(order.id)).status,'cancelled');
  api.clearExperience();assert.equal((await api.orders()).length,0);await api.logout();assert.equal(api.user,null);
});

test('independent review: corrupted saved JSON recovers to public seed without crashing',async()=>{
  const {api}=await adapter({broken:true});await api.init();const site=await api.site();assert.equal(site.products.length,3);assert.ok(site.gallery.length>0);
});

test('independent review: server startup works without AbortSignal.timeout',async()=>{
  const {api}=await adapter({server:true});await api.init();const site=await api.site();assert.equal(site.products.length,3);assert.ok(site.gallery.length>0);
});
