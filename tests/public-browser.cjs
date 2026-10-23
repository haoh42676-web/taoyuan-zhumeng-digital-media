/* Additional public-facing regressions, using the admin browser's isolated database. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
module.exports=async({db,p,v,adminGo,siteGo,close,ok})=>{
 await adminGo('cms/research_sets');
 await p.locator('[data-action="content-edit"][data-value="research_sets--consumer"]').click();
 const inputs=p.locator('[data-field="metrics"] .list-row').first().locator('input');
 await inputs.nth(1).fill('137');await inputs.nth(2).fill('243');await inputs.nth(3).fill('口感指标格式回归');
 await p.locator('#editor [data-action="content-publish"]').click();await p.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已发布'));await close();
 await siteGo('evidence');const row=v.locator('.data-table tbody tr').filter({hasText:'口感指标格式回归'});assert.match(await row.innerText(),/137 \/ 243/);assert.match(await row.innerText(),/56.4%/);
 ok('Published count-based research metric renders correct count, denominator and percentage');

 await siteGo('trace');
 const sample=(await db.query("SELECT published FROM content_items WHERE module='batches' LIMIT 1")).rows[0].published;
 const data={...sample,batchId:'QA-NEW-BATCH',status:'pending',stock:13,originName:'独立测试产地'};
 await db.query("INSERT INTO content_items(id,module,slug,title,draft,published,status) VALUES('batches--QA-NEW-BATCH','batches','QA-NEW-BATCH','浏览器新批次',$1,$1,'published')",[JSON.stringify(data)]);
 await v.locator('#batch-search').fill('QA-NEW-BATCH');await v.locator('[data-action="batch-search"]').click();await v.locator('#modal-title').filter({hasText:'QA-NEW-BATCH'}).waitFor();await v.keyboard.press('Escape');
 assert.equal(await v.locator('#batch-search').inputValue(),'QA-NEW-BATCH');assert.match(await v.locator('#secondary-view .fact-fields').innerText(),/13箱／盒/);
 data.stock=6;await db.query("UPDATE content_items SET draft=$1,published=$1 WHERE id='batches--QA-NEW-BATCH'",[JSON.stringify(data)]);
 const [file]=await Promise.all([v.waitForEvent('download'),v.locator('[data-action="export-batch"]').click()]);
 assert.equal(file.suggestedFilename(),'批次_QA-NEW-BATCH.json');const exported=JSON.parse(await fs.readFile(await file.path(),'utf8'));assert.equal(exported.data.id,'QA-NEW-BATCH');assert.equal(exported.data.availableQuantity,6);assert.match(await v.locator('#secondary-view .fact-fields').innerText(),/6箱／盒/);
 ok('Batch published after page load can be queried, selected and exported with refreshed availability');

 await adminGo('cms/tours');await p.locator('[data-action="content-edit"]').first().click();
 assert.equal(await p.locator('[name="inquiryEnabled"]').isChecked(),true);await p.locator('[name="inquiryEnabled"]').uncheck();await p.locator('#editor [data-action="content-publish"]').click();await p.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已发布'));await close();
 await siteGo('rural');assert.equal(await v.locator('[data-action="tour-form"]').isDisabled(),true);await v.locator('[data-action="tour-stop"]').first().click();assert.equal(await v.locator('#app-modal [data-action="tour-form"]').isDisabled(),true);await v.keyboard.press('Escape');
 await adminGo('cms/tours');await p.locator('[data-action="content-edit"]').first().click();await p.locator('[name="inquiryEnabled"]').check();await p.locator('#editor [data-action="content-publish"]').click();await p.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已发布'));await close();
 await siteGo('rural');await v.locator('[data-action="tour-form"]').click();await v.locator('[data-form="tour"] [name="date"]').fill('2099-10-18');await v.locator('[data-form="tour"] [name="name"]').fill('路线开关回归');await v.locator('[data-form="tour"] [name="region"]').fill('广东河源');await v.locator('[data-form="tour"] [name="consent"]').check();await v.locator('[data-form="tour"] [type="submit"]').click();await v.locator('#modal-title').filter({hasText:'已提交到项目后台'}).waitFor();
 assert.equal(await v.evaluate(()=>PeachAPI.snapshot().records.find(r=>r.kind==='tour').bookingConfirmed),false);await v.keyboard.press('Escape');
 ok('Route inquiry pause and reopening work through published CMS controls and both public entry points');
};
