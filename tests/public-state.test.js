import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {MODULES,validateContent} from '../server/modules.js';

const appCode=await readFile(new URL('../app.js',import.meta.url),'utf8');
const onlineCode=await readFile(new URL('../front-cms.js',import.meta.url),'utf8');
const adminCode=await readFile(new URL('../admin/admin.js',import.meta.url),'utf8');

test('published research metrics support option-based and cited counts in every dataset',()=>{
 const consumer=validateContent('research_sets',{name:'消费者',n:243,source:'独立回归资料',metrics:[['C14',137,243,'关注口感']]});
 const groups={consumer,opc:{n:437,metrics:[['B02',['A','B'],'在校学生']]},farmer:{n:206,metrics:[['Q02',['A'],null,'自有果园']]}};
 const survey={consumer:[],opc:[{question:'B02',option:'A',count:300,denominator:437},{question:'B02',option:'B',count:51,denominator:437}],farmer:[{question:'Q02',option:'A',count:159,denominator:206}]};
 const context=vm.createContext({groups,survey});vm.runInContext(appCode.match(/^function factRows\(key\).*$/m)[0]+'\nglobalThis.rows=Object.keys(groups).map(factRows);',context);
 const [c,o,f]=JSON.parse(JSON.stringify(context.rows)).map(x=>x[0]);
 assert.deepEqual(c,{question:'C14',label:'关注口感',count:137,n:243,percent:'56.4'});
 assert.equal(o.count,351);assert.equal(o.percent,'80.3');assert.equal(f.count,159);assert.equal(f.label,'自有果园');assert.equal(f.percent,'77.18');
});

function runtime({batches=[{id:'OLD',batchId:'OLD',status:'example',stock:10}],tours=[],request=async()=>{}}={}){
 const cms={batches,tours,research_sets:[],settings:[],pages:[],slides:[],publications:[]},state={},downloads=[],messages=[],modals=[],events=[];
 const context=vm.createContext({window:{},document:{querySelector:()=>({value:'NEW'}),addEventListener:()=>{},dispatchEvent:event=>events.push(event.type)},location:{search:''},URLSearchParams,CustomEvent:class{constructor(type){this.type=type;}},traceData:{}});
 vm.runInContext(onlineCode,context);
 const renderers={api:()=>''},esc=v=>String(v??'');
 context.window.PeachEnhance({api:{mode:'server',cms,request},state,groups:{},survey:{},renderers,shell:(...parts)=>parts.join('\n'),btn:(label,action,value='',extra='')=>`<button data-action="${action}" ${extra}>${label}</button>`,link:()=>'',esc,media:esc,empty:()=>'',openModal:html=>modals.push(html),toast:message=>messages.push(message),download:(name,body)=>downloads.push({name,body})});
 return {cms,state,downloads,messages,modals,events,renderers,online:context.window.PeachOnline};
}

test('a newly published batch remains selected in its page and export, including current availability',async()=>{
 const paths=[];let stock=12;
 const rt=runtime({request:async(method,path)=>{paths.push(path);return{data:{id:'NEW',batchId:'NEW',status:'verified',stock,availableQuantity:stock-2}};}});
 await rt.online.action('batch-search');assert.equal(rt.state.batchId,'NEW');assert.match(rt.renderers.trace(),/NEW/);assert.match(rt.renderers.trace(),/10箱／盒/);
 stock=11;await rt.online.action('export-batch');assert.deepEqual(paths,['/api/batches/NEW','/api/batches/NEW']);assert.equal(rt.downloads[0].name,'批次_NEW.json');
 assert.equal(JSON.parse(rt.downloads[0].body).data.availableQuantity,9);assert.equal(rt.cms.batches.length,2);assert.match(rt.renderers.trace(),/9箱／盒/);
});

test('querying a revised batch replaces its cached facts instead of duplicating them',async()=>{
 const rt=runtime({batches:[{id:'NEW',batchId:'NEW',status:'pending',stock:20}],request:async()=>({data:{id:'NEW',batchId:'NEW',status:'verified',stock:8,availableQuantity:6}})});
 await rt.online.action('batch-search');assert.equal(rt.cms.batches.length,1);assert.equal(rt.cms.batches[0].stock,8);assert.match(rt.renderers.trace(),/6箱／盒/);
});

test('a paused route disables both entry buttons and rejects direct form actions',async()=>{
 const rt=runtime({tours:[{id:'route',name:'测试路线',description:'测试',stops:[['果园','待核实']],conditions:'测试条件',openDates:[],capacity:null,inquiryEnabled:false,bookingAvailable:false}]});
 assert.match(rt.renderers.rural(),/暂停收集路线咨询意向/);assert.match(rt.renderers.rural(),/data-action="tour-form" disabled/);
 assert.equal(await rt.online.action('tour-form'),true);assert.match(rt.messages[0],/暂停/);
 await rt.online.action('tour-stop','0');assert.match(rt.modals[0],/data-action="tour-form" disabled/);
});

test('legacy routes may collect inquiries while clearly awaiting reception verification',async()=>{
 const rt=runtime({tours:[{id:'legacy',name:'原路线',description:'测试',stops:[],conditions:'待确认',openDates:[],capacity:null,bookingAvailable:false}]});
 const html=rt.renderers.rural();assert.match(html,/接待条件尚待核实/);assert.doesNotMatch(html,/data-action="tour-form" disabled/);assert.equal(await rt.online.action('tour-form'),false);
});

test('admin forms respect checkbox defaults without overriding an explicit pause',()=>{
 const field=MODULES.tours.fields.find(f=>f.key==='inquiryEnabled');assert.ok(field);
 const context=vm.createContext({state:{},esc:v=>String(v??'')});
 vm.runInContext(adminCode.match(/^function blankData\(def\).*$/m)[0]+'\n'+adminCode.match(/^function fieldHtml\(f,value\).*$/m)[0],context);
 assert.equal(context.blankData(MODULES.tours).inquiryEnabled,true);assert.match(context.fieldHtml(field,undefined),/checked/);assert.doesNotMatch(context.fieldHtml(field,false),/checked/);
});
