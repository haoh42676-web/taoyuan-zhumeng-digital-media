import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {runInNewContext} from 'node:vm';
import {sendPublicAsset} from '../server/public-assets.js';

test('public scripts compress and revalidate without caching private configuration',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'peach-public-')),file=join(dir,'test.js'),source='const peach="public character guidance";\n'.repeat(150);
 try{
  await writeFile(file,source);const result={headers:{},body:null,status:200};const response={set(k,v){result.headers[k]=v;return this;},vary(k){result.headers.Vary=k;return this;},type(t){result.type=t;return this;},status(v){result.status=v;return this;},send(v){result.body=v;return this;},end(){return this;}};
  await sendPublicAsset({headers:{'accept-encoding':'gzip, br'}},response,file);assert.equal(result.headers['Content-Encoding'],'gzip');assert.equal(gunzipSync(result.body).toString(),source);assert.ok(result.body.length<Buffer.byteLength(source)/2);assert.match(result.headers['Cache-Control'],/must-revalidate/);
  result.body=null;await sendPublicAsset({headers:{'if-none-match':result.headers.ETag}},response,file);assert.equal(result.status,304);assert.equal(result.body,null);
  const app=await readFile(new URL('../server/app.js',import.meta.url),'utf8');assert.match(app,/runtime-config[\s\S]*?no-store/);assert.match(app,/publicFiles\.has/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

async function remote(fetcher){
 const source=await readFile(new URL('../remote-api.js',import.meta.url),'utf8'),window={PEACH_CONFIG:{mode:'server'},dispatchEvent(){}};
 const context={window,location:{search:''},URLSearchParams,AbortSignal,crypto:{randomUUID:()=> 'test-idempotency-key'},fetch:fetcher,setTimeout:fn=>{fn();return 1;},CustomEvent:class{},productData:[],scenarioData:{},traceData:{},ipData:{}};
 window.addEventListener=()=>{};window.PeachSurveyData={};runInNewContext(source,context);
 await window.PeachAPI.ready.catch(()=>{});return window.PeachAPI;
}
test('read startup retries once on unavailable service and failed writes remain single attempts',async()=>{
 let calls=[];const api=await remote(async(path,options)=>{calls.push({path,options});return{status:503,ok:false,body:{cancel:async()=>{}},json:async()=>({error:{message:'服务暂不可用'}})};});
 assert.equal(calls.length,2);calls=[];await assert.rejects(()=>api.request('POST','/api/consultations',{note:'模拟提交'}),/服务暂不可用/);assert.equal(calls.length,1);assert.equal(calls[0].options.headers['Idempotency-Key'],'test-idempotency-key');
});
