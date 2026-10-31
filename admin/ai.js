'use strict';
window.PeachAIAdmin=(()=>{
 let copyRequest=0,result=null,selectedProducts=[],dashboardData=null,example=false,charts=[],resizeObserver;
 let chartLibraryPromise=null,mountVersion=0;
 const currency=n=>'¥'+Number(n||0).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
 const labels={home:'首页',consumer:'消费者端',ip:'小桃满IP',trace:'批次事实',service:'收货售后',evidence:'事实中心',operator:'协作运营',content:'内容工作室',rural:'农文旅',competition:'赛事讲解',records:'我的记录',api:'接口'};
 function dispose(){mountVersion++;charts.forEach(c=>c.dispose());charts=[];resizeObserver?.disconnect();}
 function chartLibrary(){
   if(window.echarts)return Promise.resolve(window.echarts);
   if(chartLibraryPromise)return chartLibraryPromise;
   chartLibraryPromise=new Promise((resolve,reject)=>{
     const script=document.createElement('script');
     script.src='/assets/vendor/echarts.min.js';script.async=true;
     script.dataset.chartLibrary='echarts';
     let finished=false;
     const finish=(error)=>{
       if(finished)return;finished=true;clearTimeout(timer);script.onload=null;script.onerror=null;
       if(error){script.remove();chartLibraryPromise=null;reject(error);}else resolve(window.echarts);
     };
     const timer=setTimeout(()=>finish(new Error('图表组件加载超时，请重新加载图表。')),20000);
     script.onload=()=>finish(window.echarts?null:new Error('图表组件未能初始化，请重新加载图表。'));
     script.onerror=()=>finish(new Error('图表组件暂未加载成功，请重新加载图表。'));
     document.head.append(script);
   });
   return chartLibraryPromise;
 }
 function chartMessage(message,retry=false){
   document.querySelectorAll('.ai-chart').forEach((el,index)=>{
     el.innerHTML='<p class="muted" role="status">'+esc(message)+'</p>'+(retry&&index===0?button('重新加载图表','ai-dashboard-retry'): '');
   });
 }
 function mount(){
   if(state.route!=='ai-dashboard'||!dashboardData||!document.getElementById('ai-sales-chart'))return Promise.resolve();
   if(window.echarts){draw();return Promise.resolve();}
   const ticket=++mountVersion,routeTicket=generation;
   chartMessage('图表组件正在加载，明细数据仍可查看。');
   return chartLibrary().then(()=>{
     if(ticket!==mountVersion||routeTicket!==generation||state.route!=='ai-dashboard'||!document.getElementById('ai-sales-chart'))return;
     draw();
   }).catch(error=>{
     if(ticket!==mountVersion||routeTicket!==generation||state.route!=='ai-dashboard'||!document.getElementById('ai-sales-chart'))return;
     chartMessage(error.message,true);
   });
 }
 function fillProduct(id){
   const p=selectedProducts.find(x=>x.id===id),f=document.querySelector('[data-form="ai-description"]');if(!p||!f)return;
   f.elements.weight.value=p.name.match(/\d+(?:[–—-]\d+)?斤/)?.[0]||'';
   f.elements.grade.value=/特大果/.test(p.name)?'特大果':/大果/.test(p.name)?'大果':'';
   f.elements.origin.value='';f.elements.scene.value=p.scene;f.elements.before.value=p.desc||'';f.elements.sourceRef.value=p.sourceRef||'已发布规格 '+p.id+'；产地与分级仍需按批次核验';invalidate();
 }
 function invalidate(){copyRequest++;result=null;const target=document.querySelector('#ai-copy-result');if(target){target.innerHTML='<div class="ai-result-placeholder"><img src="/assets/web/xiaotaoman.webp" alt=""><h3>先填事实，再整理表达。</h3><p>生成后在这里比较原文与新文案；不会自动上架。</p></div>';}}
 async function copyPage(){
   copyRequest++;selectedProducts=(await api('/catalog')).filter(p=>p.id!=='ip-card');result=null;
   return heading('AI商品描述生成器','输入规格后整理成商品表达。正式后台可使用项目AI主模型，六秒未完成或报错切换备用；演示后台只运行规则模板。')+
   '<div class="ai-mode-note"><b>公开规格整理 · 人工审核后发布</b><span>模型仅获得脱敏规格文案，不发送原始描述、档案、客户资料或密钥。未配置或调用失败使用本地模板；生成结果不会自动上架。</span></div><div class="ai-copy-layout"><section class="panel"><h2>商品事实</h2><form data-form="ai-description"><label>从已发布规格开始<select name="productId"><option value="">手动填写</option>'+selectedProducts.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select></label><div class="form-grid"><label>重量 / 包装规格 *<input name="weight" maxlength="60" required placeholder="例如：5斤 / 12个装"></label><label>等级 / 分级 *<input name="grade" maxlength="80" required placeholder="请填写实际分级"></label><label class="full">标注产地 *<input name="origin" maxlength="120" required placeholder="填写经核对的产地"></label><label class="full">使用场景<select name="scene"><option value="family">家庭分享</option><option value="gift">礼赠</option><option value="group">社群拼单</option></select></label><label class="full">原始描述<textarea name="before" rows="3" maxlength="3000" placeholder="可保留原商品说明，用于对比"></textarea></label><label class="full">事实依据 *<input name="sourceRef" maxlength="300" required placeholder="批次记录 / 商品规格 / 核验记录"></label></div><p class="form-error" role="alert" hidden></p><button type="submit" class="primary">生成商品文案 ↗</button></form></section><section class="panel" id="ai-copy-result"><div class="ai-result-placeholder"><img src="/assets/web/xiaotaoman.webp" alt=""><h3>把这一箱桃，说得更清楚。</h3><p>填写左侧信息，查看前后对比。</p></div></section></div>';
 }
 function resultHTML(){
  return '<div class="panel-top"><h2>前后对比</h2><span class="ai-tag">'+esc(result.label||'规则模板')+' · 待审核</span></div><div class="ai-before"><small>原始描述</small><p>'+esc(result.before||'尚未填写原文，可按事实字段对照。')+'</p></div><div class="ai-after"><small>整理后文案</small><h3>'+esc(result.title)+'</h3><p>'+esc(result.body)+'</p></div><ul class="ai-warnings">'+result.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><div class="heading-actions">'+button('复制文案','ai-copy-output')+button('保存为待审核草稿','ai-save-draft','','primary')+'</div><p class="ai-save-note">保存后前往“草稿与审核”，提交复核并完成发布流程。</p>';
 }
 function dashboardHTML(){
   const sandbox=location.pathname.startsWith('/demo/');const d=dashboardData,alerts=d.inventory.filter(b=>b.state==='low'||b.state==='empty'),prefix='';
   return heading('AI辅助运营 · 数据看板','销售、访客和批次余量使用不同口径，经营判断由运营人员确认。',button('刷新看板','ai-dashboard-mode','','primary'))+
   '<div class="ai-mode-note" role="status" data-dashboard-mode="'+(sandbox?'sandbox':'real')+'"><div><b>真实台账 · 按记录状态统计</b><span>'+(sandbox?'当前为隔离工作区，操作保存在本环境。':'销售按签收日统计；浏览量、预订与收款分别维护。')+'</span></div></div>'+
   '<form class="toolbar" data-form="ai-dates">'+dates()+'<button type="submit">查询日期</button><a href="#cms/ai_settings">管理规则与预警阈值 ↗</a></form><div class="stats">'+stat(prefix+'签收订单',number(d.sales.orders),'所选日期内完成签收')+stat(prefix+'签收订单净收款',currency(d.sales.netReceipts),'收款减退款 · 非净利润')+stat(prefix+'独立访客UV',number(d.audience.uv),'匿名浏览器估算')+stat(prefix+'库存预警批次',number(alerts.length),'仅检查已核验批次')+'</div>'+
   '<div class="ai-dashboard-grid"><section class="panel"><div class="panel-top"><h2>'+prefix+'销售趋势</h2><small>按签收日 / 元</small></div><div class="ai-chart" id="ai-sales-chart" role="img" aria-label="签收订单净收款趋势"></div><details class="ai-data-details"><summary>查看明细数据</summary>'+table(['日期','签收订单','净收款'],d.sales.daily.map(x=>[esc(x.date),number(x.orders),currency(x.netReceipts)]))+'</details></section>'+
   '<section class="panel"><div class="panel-top"><h2>'+prefix+'用户设备</h2><small>页面浏览次数PV</small></div><div class="ai-chart" id="ai-devices-chart" role="img" aria-label="访客设备分布"></div><p class="muted">PV '+number(d.audience.pv)+' · UV '+number(d.audience.uv)+' · 会话 '+number(d.audience.sessions)+'。同一访客可产生多次浏览。</p></section>'+
   '<section class="panel"><div class="panel-top"><h2>'+prefix+'页面偏好</h2><small>按PV排序</small></div><div class="ai-chart" id="ai-pages-chart" role="img" aria-label="页面浏览偏好"></div></section>'+
   '<section class="panel"><div class="panel-top"><h2>'+prefix+'签收订单地区</h2><small>省级聚合 / 订单数</small></div><div class="ai-chart" id="ai-regions-chart" role="img" aria-label="签收订单地区分布"></div></section></div>'+
   '<section class="panel ai-stock-panel"><div class="panel-top"><h2>'+prefix+'库存预警</h2><a href="#cms/batches">维护批次事实 ↗</a></div>'+table(['批次','总量（箱/盒）','可承接余量','预警阈值','状态'],d.inventory.map(b=>[esc(b.id),b.total==null?'未知':number(b.total),b.remaining==null?'待核验':number(b.remaining),number(b.threshold)+'箱/盒','<span class="ai-stock-state '+b.state+'">'+({unknown:'待核验，不按0计算',empty:'无可承接余量',low:'余量偏低',normal:'余量正常'}[b.state])+'</span>']))+'</section>'+
   '<section class="panel ai-notes"><h2>规则建议与数据口径</h2><p>'+(alerts.length?(example?'场景中有 ':sandbox?'隔离台账中有 ':'存在 ')+alerts.length+' 个批次触发库存阈值。'+(example||sandbox?'用于演示如何识别预警，库存按当批记录核对。':'请核对真实库存，再决定是否调整商品说明。'):'当前未发现已核验批次触发库存阈值；待核验批次仍需补齐资料。')+'</p>'+d.notes.map(n=>'<p>'+esc(n)+'</p>').join('')+(d.sales.undated?'<p>有 '+number(d.sales.undated)+' 笔签收订单缺少签收日，未计入销售趋势。</p>':'')+'</section>';
 }
 function draw(){
  dispose();if(state.route!=='ai-dashboard'||!dashboardData)return;
  const d=dashboardData,css=getComputedStyle(document.documentElement),tone=n=>css.getPropertyValue(n).trim(),text=tone('--text-2'),weight=Number(css.getPropertyValue('--weight-400'));
  const base={animation:!matchMedia('(prefers-reduced-motion: reduce)').matches,animationDuration:450,color:[tone('--accent'),tone('--peach'),tone('--mint'),tone('--sun')],textStyle:{fontFamily:'Peach UI, Microsoft YaHei, sans-serif',fontSize:13,fontWeight:weight,color:text},aria:{enabled:true},tooltip:{trigger:'item',renderMode:'richText'},grid:{left:62,right:24,top:24,bottom:38}};
  const emptyGraphic={type:'text',left:'center',top:'middle',style:{text:location.pathname.startsWith('/demo/')?'暂无记录\n可在隔离台账中继续演练':'暂无真实数据\n登记后自动显示',fontSize:16,lineHeight:28,fill:text,fontWeight:weight,textAlign:'center'}};
  const plot=(id,option,empty)=>{const el=document.getElementById(id);if(!el||!window.echarts)return;el.innerHTML='';const c=echarts.init(el,null,{renderer:'svg'});const axis=a=>a?{...a,axisLabel:{color:text,fontWeight:weight},nameTextStyle:{color:text,fontWeight:weight},axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:tone('--surface-3')}}}:a;c.setOption({...base,...option,xAxis:axis(option.xAxis),yAxis:axis(option.yAxis),legend:{...option.legend,textStyle:{color:text,fontWeight:weight}},tooltip:{...base.tooltip,...option.tooltip,backgroundColor:tone('--surface-3'),borderWidth:0,textStyle:{color:text,fontWeight:weight}},...(empty?{graphic:emptyGraphic}:{} )});charts.push(c);};
  plot('ai-sales-chart',{tooltip:{trigger:'axis',renderMode:'richText'},xAxis:{type:'category',data:d.sales.daily.map(x=>x.date.slice(5)),boundaryGap:false},yAxis:{type:'value',name:'元',splitLine:{lineStyle:{color:'#e4ebe1'}}},series:d.sales.orders?[{name:'签收订单净收款',type:'line',smooth:.25,data:d.sales.daily.map(x=>x.netReceipts),symbolSize:7,areaStyle:{color:tone('--accent-soft')},lineStyle:{width:3}}]:[]},!d.sales.orders);
  const pie=(id,list)=>plot(id,{legend:{bottom:0,type:'scroll'},series:list.length?[{type:'pie',radius:['43%','68%'],center:['50%','44%'],label:{formatter:'{b}\n{d}%'},data:list}]:[]},!list.length);
  pie('ai-devices-chart',d.audience.devices);pie('ai-regions-chart',d.audience.regions);
  const pages=[...d.audience.pages].filter(x=>x.value>0).sort((a,b)=>a.value-b.value).slice(-6);
  plot('ai-pages-chart',{grid:{left:95,right:26,top:15,bottom:28},xAxis:{type:'value',minInterval:1},yAxis:{type:'category',data:pages.map(x=>labels[x.name]||x.name)},series:pages.length?[{name:'页面浏览PV',type:'bar',barWidth:19,itemStyle:{borderRadius:[0,7,7,0]},data:pages.map(x=>x.value)}]:[]},!pages.length);
  resizeObserver=new ResizeObserver(()=>charts.forEach(c=>c.resize()));document.querySelectorAll('.ai-chart').forEach(el=>resizeObserver.observe(el));
 }
 async function page(route){
   dispose();if(route==='ai-copy'){if(!canEdit())return heading('此账号没有文案编辑权限','请联系管理员分配内容编辑权限。');return copyPage();}
   const ticket=generation,d=await api('/admin/ai/dashboard?'+rangeQuery());if(ticket!==generation)return '';dashboardData=d;example=false;return dashboardHTML();
 }
 async function submit(form){
   if(form.dataset.form==='ai-dates'){state.start=form.elements.start.value;state.end=form.elements.end.value;await load();return true;}
   if(form.dataset.form!=='ai-description')return false;
   const values=Object.fromEntries(new FormData(form));delete values.productId;const request=++copyRequest,next=await api('/admin/ai/descriptions',{method:'POST',body:values});if(request!==copyRequest||!form.isConnected||state.route!=='ai-copy')return true;result=next;
   document.querySelector('#ai-copy-result').innerHTML=resultHTML();return true;
 }
 async function action(name,value,el){
   if(name==='ai-dashboard-mode'){await load();return true;}
   if(name==='ai-dashboard-retry'){await mount();return true;}
   if(name==='ai-copy-output'){if(!result)throw Error('请先生成文案');await navigator.clipboard.writeText(result.title+'\n'+result.body);el.dataset.copyPending='1';notice('文案已复制，发布前请核验。');return true;}
   if(name==='ai-save-draft'){
     if(!result)throw Error('字段已变化，请重新生成文案');
     const d=await api('/admin/drafts',{method:'POST',body:{title:result.title,body:result.body,sourceRefs:[result.sourceRef,'模板规则生成；事实待人工复核']}});result=null;
     document.querySelector('#ai-copy-result .heading-actions').innerHTML='<a class="primary" href="#drafts">前往草稿与审核 ↗</a>';notice('已存入待审核草稿 '+d.id+'，尚未发布。');return true;
   }return false;
 }
 document.addEventListener('input',e=>{if(e.target.closest('[data-form="ai-description"]'))invalidate();});
 document.addEventListener('change',e=>{if(e.target.matches('[data-form="ai-description"] [name="productId"]'))fillProduct(e.target.value);else if(e.target.closest('[data-form="ai-description"]'))invalidate();});
 window.addEventListener('hashchange',dispose);
 window.addEventListener('peach:themechange',()=>{if(state.route==='ai-dashboard')mount();});
 return {page,mount,submit,action,dispose};
})();

