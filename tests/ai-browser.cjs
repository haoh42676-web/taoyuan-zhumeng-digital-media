/* Runs in an isolated in-memory database; screenshots contain test questions only. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const {openDatabase,migrate}=await import('../server/db.js'),{seed}=await import('../server/content.js'),{createApp}=await import('../server/app.js'),{passwordHash}=await import('../server/auth.js');
 const db=await openDatabase({url:'',dataDir:'memory://'});await migrate(db);await seed(db);await db.query("INSERT INTO users(id,email,name,role,password_hash,must_change_password) VALUES('AI-QA','ai-qa@test.local','界面验收管理员','admin',$1,false)",[await passwordHash('AiBrowserTest2026!')]);
 const server=createApp(db,{secret:'ai-browser-only-secret-'.repeat(3),disableLimits:true}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const out=path.join(__dirname,'..','AI功能说明与截图');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const v=await context.newPage(),a=await context.newPage();const errors=[],checks=[];let external=[];
 for(const p of [v,a]){p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!(r.status()===401&&r.url().endsWith('/api/auth/me')))errors.push(r.status()+' '+r.url());});p.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});}
 const ok=x=>{checks.push(x);console.log('PASS '+x);};
 const route=async hash=>{await a.goto(base+'/admin/#'+hash);await a.locator('#main-content[data-route="'+hash+'"] .page-heading').waitFor();assert.doesNotMatch(await a.locator('#main-content').innerText(),/暂时无法读取/);};
 try{
  await v.goto(base);await v.locator('#ai-chat-open').waitFor();await v.locator('.recommendation-card').first().waitFor();assert.equal(await v.evaluate(()=>localStorage.getItem('peach-digital-media-recommendations:v1')),null);
  await v.locator('#recommend-scene').selectOption('gift');await v.waitForFunction(()=>document.querySelector('.recommendation-card h3')?.textContent.includes('礼盒'));
  await v.locator('#recommend-consent').check();await v.locator('.recommendation-card button').first().click();await v.locator('#app-modal[open]').waitFor();await v.keyboard.press('Escape');assert.equal(await v.evaluate(()=>JSON.parse(localStorage.getItem('peach-digital-media-recommendations:v1')).history.length),1);
  await v.locator('#recommend-clear').click();assert.equal(await v.evaluate(()=>localStorage.getItem('peach-digital-media-recommendations:v1')),null);
  ok('Recommendation scene, opt-in browsing, 30-day local preference storage and deletion');
  await v.locator('#ai-recommendations').screenshot({path:path.join(out,'05_首页推荐_实际运行.png')});
  await v.locator('#ai-chat-open').click();await v.locator('#chat-account-open').click();await v.locator('#customer-login [name="account"]').fill('test1');await v.locator('#customer-login [name="password"]').fill('123456');await v.locator('#customer-login [type="submit"]').click();await v.locator('#ai-chat[open]').waitFor();await v.locator('#chat-product').selectOption('fresh-5');
  await v.locator('#ai-chat').evaluate(el=>{const n=document.createElement('p');n.textContent='实际运行演示 · 测试提问，非真实顾客会话';n.style='margin:0;padding:6px 20px;background:#f5e6c9;color:#765526;font-size:12px';el.querySelector('.chat-heading').after(n);});
  const cases=[['01_客服_产品规格.png','5斤家庭装多少钱，规格是什么？','参考价不等于到手总价'],['02_客服_发货运费.png','广东能包邮吗？什么时候发货？','48小时'],['03_客服_物流查询.png','我的订单物流到哪里了？','未接入快递实时轨迹'],['04_客服_破损售后.png','收到桃子有破损怎么办？','不等于已确认赔付']];
  for(const [file,q,expected]of cases){
   await v.locator('#ai-chat-clear').click();await v.locator('#chat-message').fill(q);await v.locator('#ai-chat-form [type="submit"]').click();await v.waitForFunction(()=>document.querySelectorAll('.chat-message.assistant').length===1&&!document.querySelector('[data-streaming]'));assert.match(await v.locator('.chat-message.assistant').last().innerText(),new RegExp(expected));await v.locator('#ai-chat').screenshot({path:path.join(out,file)});
  }
  await v.locator('#ai-chat-close').click();ok('Four genuine system-response screenshots with provenance and no fabricated customer conversations');
  await a.goto(base+'/admin/');await a.locator('#login-form [name="email"]').fill('ai-qa@test.local');await a.locator('#login-form [name="password"]').fill('AiBrowserTest2026!');await a.locator('#login-form [type="submit"]').click();await a.locator('#main-content[data-route="overview"]').waitFor();
  await route('ai-copy');await a.locator('[name="productId"]').selectOption('fresh-5');await a.locator('[name="origin"]').fill('广东省河源市连平县上坪镇（演示输入，待核验）');await a.locator('[name="sourceRef"]').fill('隔离验收输入；非真实批次核验');await a.locator('[data-form="ai-description"] [type="submit"]').click();await a.locator('.ai-after').waitFor();assert.match(await a.locator('.ai-after').innerText(),/5斤/);assert.match(await a.locator('.ai-before').innerText(),/单果约/);
  await a.screenshot({path:path.join(out,'06_文案生成_前后对比.png'),fullPage:true});
  await a.locator('[name="grade"]').fill('演示大果');assert.equal(await a.locator('[data-action="ai-save-draft"]').count(),0);await a.locator('[data-form="ai-description"] [type="submit"]').click();await a.locator('[data-action="ai-save-draft"]').click();await a.locator('#ai-copy-result a[href="#drafts"]').waitFor();
  const saved=(await db.query('SELECT * FROM drafts')).rows;assert.equal(saved.length,1);assert.equal(saved[0].status,'draft');assert.equal((await db.query('SELECT * FROM publications')).rows.length,0);
  ok('Description generation, before/after, stale-input invalidation and draft-only save');
  await route('ai-dashboard');await a.locator('#ai-sales-chart svg').waitFor();assert.match(await a.locator('.ai-mode-note').innerText(),/模拟数据，非实际经营业绩/);assert.match(await a.locator('.stats').innerText(),/1,560/);await a.locator('[data-action=ai-dashboard-mode]').click();assert.match(await a.locator('.ai-mode-note').innerText(),/真实记录/);assert.match(await a.locator('#ai-sales-chart').innerText(),/暂无真实数据/);
  await a.waitForFunction(()=>!document.querySelector('#notice').classList.contains('show'));await a.screenshot({path:path.join(out,'07_数据看板_真实空态.png'),fullPage:true});
  await a.locator('[data-action="ai-dashboard-mode"]').click();await a.locator('.ai-demo-banner').waitFor();assert.match(await a.locator('.stats').innerText(),/1,560/);await a.waitForTimeout(650);await a.screenshot({path:path.join(out,'08_数据看板_明确标注示例.png'),fullPage:true});
  await a.locator('[data-action="ai-dashboard-mode"]').click();assert.equal((await db.query("SELECT * FROM workflow_items WHERE kind='orders'")).rows.length,0);
  ok('Local ECharts render, truthful empty state and clearly separated nonpersistent sample charts');
  for(const width of [1440,768,390,320]){
   await v.setViewportSize({width,height:900});await v.goto(base);await v.locator('#ai-chat-open').waitFor();await v.locator('.recommendation-card').first().waitFor();
   assert.ok(await v.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'front overflow '+width);
   await v.locator('#ai-chat-open').click();assert.ok(await v.locator('#ai-chat').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await v.keyboard.press('Escape');
   await a.setViewportSize({width,height:900});
   for(const hash of ['ai-copy','ai-dashboard','cms/ai_settings']){await route(hash);assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),hash+' overflow '+width);}
  }
  ok('Four widths: front recommendations, chat and three new admin pages without overflow');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);ok('No external AI requests, remote chart dependency, missing resources or browser errors');
  await fs.writeFile(path.join(out,'验收结果.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,externalRequests:external,screenshots:8,note:'隔离测试数据库；未读写用户数据库或线上Neon。'},null,2));console.log('OUTPUT '+out);
 }catch(e){await a.screenshot({path:path.join(out,'failure-admin.png'),fullPage:true}).catch(()=>{});await v.screenshot({path:path.join(out,'failure-front.png'),fullPage:true}).catch(()=>{});console.error('BROWSER ERRORS',errors);throw e;}
 finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>setTimeout(r,100));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

