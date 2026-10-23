/* Run against a local static server. Uses an isolated browser profile. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PEACH_BASE_URL||'http://127.0.0.1:8765/';
const output=process.env.PEACH_QA_OUTPUT||path.join(__dirname,'..','test-results');
const checks=[],errors=[];
const ok=message=>{checks.push(message);console.log('PASS',message);};
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.PEACH_BROWSER?{executablePath:process.env.PEACH_BROWSER}:{channel:'msedge'})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 const p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.message));
 p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const go=async route=>{if(await p.locator('dialog[open]').count())await p.keyboard.press('Escape');await p.goto(base+'#'+route);await p.waitForFunction(()=>!!window.TaoyuanApp);};
 const stable=async()=>p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
 const count=()=>p.evaluate(()=>PeachAPI.snapshot().records.length);
 const dialog=()=>p.locator('#app-modal[open]');
 const act=value=>p.locator('[data-action="'+value+'"]:visible').first().click();
 const close=async()=>{await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.body.classList.contains('is-locked'));};
 const download=async(action)=>{const [d]=await Promise.all([p.waitForEvent('download'),act(action)]);return fs.readFile(await d.path(),'utf8');};
 const routes=['home','evidence','consumer','trace','ip','operator','content','rural','service','competition','records','api'];
 for(const width of [1440,768,390,320]){
  await p.setViewportSize({width,height:900});
  for(const route of routes){
   await go(route);
   const layout=await p.evaluate(()=>({viewport:innerWidth,width:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth),orphans:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.matches('[data-route],[data-action],[data-theme-toggle],[data-fact],[data-scenario],[data-filter],[data-trace],[data-ip],[data-ops],[data-content],[data-record-filter],[data-slide],[data-home-group],[type="submit"],.menu-button,.modal-close')).map(b=>b.textContent)}));
   assert.ok(layout.width<=width+1,`${route} overflow at ${width}: ${layout.width}`);
   assert.deepEqual(layout.orphans,[],route+' has unhandled buttons');
   if(width===390&&['home','consumer','operator','api','ip'].includes(route)){await stable();await p.screenshot({path:path.join(output,route+'-390.png'),fullPage:true});}
  }
  ok('12 routes: no horizontal overflow or unbound buttons at '+width+'px');
 }
 await p.setViewportSize({width:1440,height:1000});
 await go('home');
 for(const key of ['buy','create','learn']){await p.locator('[data-home-group="'+key+'"]').click();assert.equal(await p.locator('.entry-card:visible').count(),3);}
 ok('Home groups expose all 9 entries, 3 at a time');
 await go('evidence');
 await p.locator('[data-fact="opc"]').click();
 const opc=await p.locator('.data-table').innerText();assert.match(opc,/126 \/ 437/);assert.match(opc,/28.8%/);assert.match(opc,/11 \/ 437/);assert.doesNotMatch(opc,/31.4%/);
 await p.locator('[data-action="question"]').first().click();assert.match(await dialog().innerText(),/179/);await close();
 const csv=await download('export-facts');assert.match(csv,/126/);assert.match(csv,/28.8/);
 await act('interview');assert.match(await dialog().innerText(),/口述/);await close();
 await p.locator('[data-fact="consumer"]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>TaoyuanApp.state.fact),'opc');
 ok('Evidence counts, denominators, details, CSV and keyboard switching');
 await go('consumer');
 for(const [scene,n] of [['family',2],['gift',2],['group',1]]){await p.locator('[data-scenario="'+scene+'"]').click();assert.equal(await p.locator('.product-card').count(),n);}
 await p.locator('[data-filter="all"]').click();assert.equal(await p.locator('.product-card').count(),5);
 for(const id of ['fresh-5','fresh-2','gift-12','gift-max','group-8']){await p.locator('.product-grid [data-action="product"][data-value="'+id+'"]').click();assert.match(await dialog().innerText(),/配送费/);await close();}
 await p.locator('[data-scenario="family"]').click();await act('consult');
 await p.locator('input[name="quantity"]').fill('2');assert.match(await p.locator('#quote-preview').innerText(),/130/);
 await p.locator('input[name="name"]').fill('演示访客');await p.locator('input[name="region"]').fill('广东深圳');await p.locator('input[name="consent"]').check();
 await p.locator('[data-form="consultation"] button[type="submit"]').evaluate(b=>{b.click();b.click();});
 await p.waitForFunction(()=>PeachAPI.snapshot().records.length===1);assert.equal(await count(),1);assert.match(await dialog().innerText(),/本地记录/);
 await close();await p.reload();assert.equal(await count(),1);
 const recordId=await p.evaluate(()=>PeachAPI.snapshot().records[0].id);
 await go('records');await act('record');await p.locator('select[name="status"]').selectOption('resolved');await p.locator('[data-form="record"] [type="submit"]').click();assert.match(await p.locator('.form-error:visible').innerText(),/5/);
 await p.locator('textarea[name="reply"]').fill('已说明需等待当季批次确认');await p.locator('[data-form="record"] [type="submit"]').click();await p.waitForFunction(()=>PeachAPI.snapshot().records[0].status==='resolved');await p.waitForFunction(()=>!document.querySelector('dialog').open);
 assert.match(await p.locator('.record-card').innerText(),/当季批次/);
 ok('Consultation saves once, survives refresh and accepts validated follow-up');
 await go('operator');await p.locator('.operator-nav [data-ops="review"]').click();await act('publish');await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('7'));assert.match(await p.locator('#toast').innerText(),/7/);
 await p.locator('.operator-nav [data-ops="content"]').click();await act('submit-review');await p.waitForFunction(()=>PeachAPI.snapshot().ops.draft?.status==='submitted');
 for(let i=0;i<7;i++){await p.locator('[data-review="'+i+'"]').check();await p.waitForFunction(n=>PeachAPI.snapshot().ops.checks[n],i);}
 await act('publish');await p.waitForFunction(()=>PeachAPI.snapshot().ops.publications.length===1);await close();
 await p.evaluate(async()=>{await PeachAPI.request('POST','/api/ops/publish');await PeachAPI.request('POST','/api/ops/publish');});assert.equal(await p.evaluate(()=>PeachAPI.snapshot().ops.publications.length),1);
 await p.reload();await p.locator('.operator-nav [data-ops="review"]').click();assert.equal(await p.locator('[data-review]:checked').count(),7);await act('publication');await act('copy-publication');await close();
 await p.locator('.operator-nav [data-ops="content"]').click();await p.locator('textarea[name="body"]').fill('这是新版内容，仍需确认批次、运费和发货安排。');await p.locator('[data-form="draft"] [type="submit"]').click();await p.waitForFunction(()=>PeachAPI.snapshot().ops.revision===2);assert.equal(await p.evaluate(()=>PeachAPI.snapshot().ops.checks.filter(Boolean).length),0);assert.equal(await p.evaluate(()=>PeachAPI.snapshot().ops.publications[0].revision),1);
 await p.locator('textarea[name="body"]').fill('这一批承诺48小时必达，请直接购买，无需确认发货情况。');await act('submit-review');await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('承诺'));
 ok('Review gates, persistent 7-item checks, idempotent publish and revision invalidation');
 await go('ip');
 for(const key of ['season','package','social','live','care','tour']){await p.locator('[data-ip="'+key+'"]').click();assert.ok((await p.locator('.voice-card').innerText()).length>10);}
 await act('copy-ip');assert.ok((await p.evaluate(()=>navigator.clipboard.readText())).length>20);
 await p.locator('.compact-details summary').click();await download('ip-guide');await download('download-ip');
 await go('content');
 for(const channel of ['video','live','group','card']){await p.locator('[data-action="compose"][data-value="season:'+channel+'"]').click();assert.ok((await p.locator('textarea[name="body"]').inputValue()).length>50);await act('copy-compose');await download('download-compose');await close();}
 await p.locator('[data-action="compose"]').first().click();await p.locator('[data-form="compose"] [type="submit"]').click();await p.waitForFunction(()=>TaoyuanApp.state.route==='operator');assert.match(await p.locator('[data-form="draft"] input[name="title"]').inputValue(),/桃林日记/);
 await go('content');await p.locator('#secondary-view summary').click();await download('metric-template');
 ok('IP series, clipboard, artwork downloads and four editable channel scripts');
 await go('trace');for(const key of ['origin','sort','ship','care']){await p.locator('[data-trace="'+key+'"]').click();assert.ok(await p.locator('.trace-detail').innerText());}
 await p.locator('#batch-search').fill('missing');await act('batch-search');await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('未找到'));
 await p.locator('#batch-search').fill('SP-2026-06');await act('batch-search');assert.match(await dialog().innerText(),/null/);await close();assert.match(await download('export-batch'),/"stock": null/);
 ok('All batch steps, explicit unknown-batch error and null-preserving export');
 await go('rural');for(let i=0;i<3;i++){await p.locator('.tour-stops [data-action="tour-stop"][data-value="'+i+'"]').click();assert.match(await dialog().innerText(),/未确认/);await close();}
 await act('tour-form');await p.locator('input[name="date"]').fill('2099-10-20');await p.locator('input[name="name"]').fill('演示游客');await p.locator('input[name="region"]').fill('河源市区');await p.locator('input[name="consent"]').check();await p.locator('[data-form="tour"] [type="submit"]').click();await p.waitForFunction(()=>PeachAPI.snapshot().records.some(r=>r.kind==='tour'));await close();
 await go('service');for(const summary of await p.locator('.faq-item summary').all())await summary.click();
 for(const key of ['wechat','douyin','xhs']){await p.locator('[data-action="social"][data-value="'+key+'"]').click();assert.equal(await p.locator('.social-qr').count(),1);await download('download-social');await close();}
 await act('claim-form');await p.locator('input[name="name"]').fill('演示收货人');await p.locator('input[name="region"]').fill('广东广州');await p.locator('textarea[name="note"]').fill('外箱完好，有两个果品出现挤压。');
 await p.locator('input[name="photos"]').setInputFiles({name:'问题照片.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=','base64')});assert.equal(await p.locator('.photo-preview img').count(),1);
 await p.locator('input[name="consent"]').check();await p.locator('[data-form="claim"] [type="submit"]').click();await p.waitForFunction(()=>PeachAPI.snapshot().records.some(r=>r.kind==='claim'));assert.deepEqual(await p.evaluate(()=>PeachAPI.snapshot().records.find(r=>r.kind==='claim').photoNames),['问题照片.png']);await close();
 ok('Route intent, all route nodes, FAQ, three QR downloads and photo-backed feedback metadata');
 await go('competition');for(let i=0;i<4;i++){await p.locator('[data-slide="'+i+'"]').click();await act('copy-slide');}await act('slide-next');assert.equal(await p.evaluate(()=>TaoyuanApp.state.slide),0);await p.locator('.view-head h2').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>TaoyuanApp.state.slide),1);
 await go('api');await p.locator('[data-form="api"] [type="submit"]').click();await p.waitForFunction(()=>document.querySelector('#api-status').textContent.startsWith('200'));assert.match(await p.locator('#api-output').innerText(),/"count": 137/);
 await p.locator('[data-api-select]').selectOption('8');await p.locator('textarea[name="payload"]').fill('not json');await p.locator('[data-form="api"] [type="submit"]').click();assert.match(await p.locator('.form-error:visible').innerText(),/JSON/);
 await p.locator('[data-api-select]').selectOption('6');await p.locator('input[name="path"]').fill('/api/records/'+recordId);await p.locator('[data-form="api"] [type="submit"]').click();await p.waitForFunction(()=>document.querySelector('#api-status').textContent.startsWith('200'));await act('copy-api');await download('api-doc');await act('api-list');assert.match(await dialog().innerText(),/\/api\/ops\/publish/);await close();
 const errorsAPI=await p.evaluate(async()=>{const errors=[];for(const [m,p,b] of [['POST','/api/consultations',{productId:'fresh-5',quantity:0,name:'x',region:'广东',consent:true}],['GET','/api/missing',{}],['POST','/api/consultations',null]]){try{await PeachAPI.request(m,p,b);}catch(e){errors.push(e.status);}}return errors;});assert.deepEqual(errorsAPI,[422,404,422]);
 ok('Presentation controls and API runner: success, validation, missing path, JSON and downloads');
 await go('records');assert.equal(await count(),3);const exported=JSON.parse(await download('export-records'));assert.equal(exported.records.length,3);assert.equal(exported.ops.publications.length,1);
 for(const key of ['consultation','claim','tour','all']){await p.locator('[data-record-filter="'+key+'"]').click();assert.equal(await p.locator('.record-card').count(),key==='all'?3:1);}
 await act('confirm-reset');await act('close');assert.equal(await count(),3);
 await p.setViewportSize({width:390,height:844});await go('home');await p.locator('.menu-button').click();assert.equal(await p.locator('.menu-button').getAttribute('aria-expanded'),'true');await p.locator('#top-nav [data-route="consumer"]').click();assert.equal(await p.locator('.menu-button').getAttribute('aria-expanded'),'false');
 await act('consult');await p.keyboard.press('Escape');assert.equal(await p.locator('body').evaluate(x=>x.classList.contains('is-locked')),false);
 await p.emulateMedia({reducedMotion:'reduce'});await go('operator');assert.equal(await p.locator('#secondary-view').evaluate(x=>getComputedStyle(x).animationName),'none');
 await p.emulateMedia({reducedMotion:'no-preference'});await p.setViewportSize({width:1440,height:1000});
 for(const r of ['home','consumer','operator','ip','evidence','api']){await go(r);await stable();await p.screenshot({path:path.join(output,r+'-1440.png'),fullPage:true});}
 ok('3 record types, export/cancel, mobile menu, Escape cleanup and reduced motion');
 const page2=await context.newPage();await page2.goto(base+'#records');await p.evaluate(()=>PeachAPI.request('PATCH','/api/records/'+PeachAPI.snapshot().records[0].id,{status:'processing',reply:'多标签同步检查'}));await page2.waitForFunction(()=>PeachAPI.snapshot().records[0].reply==='多标签同步检查');await page2.close();ok('Cross-tab record synchronization');
 await go('records');await act('confirm-reset');await act('reset');await p.waitForFunction(()=>PeachAPI.snapshot().records.length===0);assert.equal(await p.evaluate(()=>PeachAPI.snapshot().ops.publications.length),0);ok('Confirmed reset clears only local demo state');
 await go('home');await p.locator('#ai-chat-open').waitFor();await p.locator('#ai-chat-open').click();await p.locator('#chat-product').selectOption('fresh-5');await p.locator('#chat-message').fill('5斤家庭装多少钱？');await p.locator('#ai-chat-form [type="submit"]').click();await p.waitForFunction(()=>document.querySelector('.chat-message.assistant')?.textContent.includes('参考价不等于到手总价'));await p.locator('#ai-chat-close').click();ok('Static rule chat and recommendations run without a backend');
 assert.deepEqual(errors,[],'Unexpected browser errors');ok('No browser runtime errors or missing assets');
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify({passed:checks.length,checks,errors,date:new Date().toISOString()},null,2));await browser.close();
 console.log(JSON.stringify({passed:checks.length,errors,output}));
})().catch(e=>{console.error(e);process.exit(1);});
