import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../admin/ai.js',import.meta.url),'utf8');
const fixture=(orders=0,start='2026-10-17',end='2026-10-23')=>({range:{start,end,timeZone:'Asia/Shanghai'},sales:{orders,netReceipts:orders*91,customers:orders,daily:[{date:end,orders,netReceipts:orders*91}],undated:0},audience:{pv:991,uv:771,sessions:881,devices:[{name:'真实设备标识',value:991}],pages:[{name:'home',value:991}],regions:orders?[{name:'真实地区标识',value:orders}]:[]},inventory:[],notes:['真实记录口径']});
function harness(data,{sandbox=false}={}){
 const requests=[],options=new Map(),tables=[],main={innerHTML:''},nodes=Object.fromEntries(['sales','devices','pages','regions'].map(k=>['ai-'+k+'-chart',{id:'ai-'+k+'-chart'}]));
 const context={window:{addEventListener(){},echarts:true},document:{addEventListener(){},querySelector:s=>s==='#main-content'?main:null,querySelectorAll:()=>Object.values(nodes),getElementById:id=>nodes[id]},location:{pathname:sandbox?'/demo/admin/':'/admin/'},state:{route:''},generation:1,api:async path=>{requests.push(path);return data;},rangeQuery:()=>'',canEdit:()=>true,esc:v=>String(v??''),heading:(title,intro,action)=>'<h1>'+title+'</h1>'+intro+(action||''),button:(title,action)=>'<button data-action="'+action+'">'+title+'</button>',stat:(label,value,note)=>label+':'+value+' '+note,number:v=>Number(v).toLocaleString('zh-CN'),table:(headers,rows)=>{tables.push({headers,rows});return rows.map(r=>r.join('|')).join(';');},dates:()=>'',getComputedStyle:()=>({getPropertyValue:()=>''}),matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}disconnect(){}},echarts:{init:node=>({setOption:opts=>options.set(node.id,opts),dispose(){},resize(){}})}};
 vm.createContext(context);vm.runInContext(source,context);return{ui:context.window.PeachAIAdmin,context,requests,options,tables,main};
}

test('empty sales retain recorded audience data and never manufacture revenue',async()=>{
 const data=fixture(),before=JSON.stringify(data),h=harness(data),html=await h.ui.page('ai-dashboard');
 assert.match(html,/data-dashboard-mode="real"/);assert.match(html,/真实台账/);assert.match(html,/991/);assert.doesNotMatch(html,/1,560|模拟|合成/);
 h.context.state.route='ai-dashboard';await h.ui.mount();assert.equal(h.options.get('ai-sales-chart').series.length,0);assert.match(h.options.get('ai-sales-chart').graphic.style.text,/暂无真实数据/);assert.equal(JSON.stringify(data),before);
});
test('completed sales and graphs use the exact API ledger values',async()=>{
 const h=harness(fixture(1)),html=await h.ui.page('ai-dashboard');assert.match(html,/91.00/);assert.match(html,/刷新看板/);h.context.state.route='ai-dashboard';await h.ui.mount();assert.deepEqual(Array.from(h.options.get('ai-sales-chart').series[0].data),[91]);assert.deepEqual(h.requests,['/admin/ai/dashboard?']);
});
test('isolated workspace states its storage scope without mislabelling the ledger',async()=>{
 const h=harness(fixture(1),{sandbox:true}),html=await h.ui.page('ai-dashboard');assert.match(html,/data-dashboard-mode="sandbox"/);assert.match(html,/隔离工作区/);assert.doesNotMatch(html,/模拟|合成|非实际经营业绩/);h.context.state.route='ai-dashboard';await h.ui.mount();assert.equal(h.options.get('ai-sales-chart').series[0].data[0],91);
});
test('inventory and audience charts retain source counts independently of sales',async()=>{
 const data=fixture();data.inventory=[{id:'A',total:10,remaining:2,state:'low',status:'verified',threshold:3}];const h=harness(data),html=await h.ui.page('ai-dashboard');assert.match(html,/1 个批次触发库存阈值/);h.context.state.route='ai-dashboard';await h.ui.mount();assert.equal(h.options.get('ai-devices-chart').series[0].data[0].value,991);assert.equal(h.options.get('ai-regions-chart').series.length,0);
});
