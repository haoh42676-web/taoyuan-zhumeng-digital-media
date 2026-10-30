(() => {
  'use strict';
  const store = window.PeachSeasonData, V = window.PeachSeasonViews, api = window.DigitalAPI;
  const {e, icon, money, image, action, link, pill} = V;
  const main = document.querySelector('#season-app'), dialog = document.querySelector('#season-dialog'), body = document.querySelector('#dialog-body');
  const titles = {home:'桃园首页', garden:'四季桃园', plans:'认养一季', gift:'寄份心意', mine:'我的桃园', about:'关于这一季'};
  const params = new URLSearchParams(location.search);
  const state = {data: window.CLOUD_SEED, my: {intents:[], gifts:[], receivedGifts:[], feedback:[], visits:[], activities:[]}, mode:store.server ? 'server' : 'local', route:'home', stage:'care', planFilter:'all', mineTab:'overview', sampleId:params.get('sample') || '', lastGift:null, giftDraft:null, enrollment:null, error:''};
  let returnFocus, toastTimer, assistantMessages = [], assistantBusy = false, authTab = 'login';
  let activeAudio, speech, loading = false;
  const plan = id => V.plan(state, id);
  const rootURL = () => { const url = new URL(location.href); url.search = ''; url.hash = ''; return url; };
  const currentRecord = id => [...state.my.intents, ...state.data.intents, ...state.data.orders].find(x => x.id === id);

  function toast(text) {
    const target = document.querySelector('#toast'); target.textContent = text; target.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => target.classList.remove('show'), 3800);
  }
  function open(html, wide = false, label = '桃园云养') {
    if (!dialog.open) returnFocus = document.activeElement;
    stopAudio(); body.innerHTML = html; dialog.classList.toggle('wide', wide);
    document.querySelector('#dialog-label').textContent = label;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function close() { if (dialog.open) dialog.close(); }
  function stopAudio() { activeAudio?.pause(); activeAudio = null; if (speech) globalThis.speechSynthesis?.cancel(); speech = null; }
  dialog.addEventListener('close', () => { stopAudio(); body.querySelectorAll('video').forEach(v => v.pause()); returnFocus?.isConnected && returnFocus.focus({preventScroll:true}); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });

  function updateBanner() {
    const banner = document.querySelector('#connection-banner');
    banner.hidden = !state.error && !store.volatile;
    banner.querySelector('p').textContent = state.error || '当前记录暂存在本页。保存纪念卡，方便下次继续查看。';
    banner.querySelector('button').hidden = !state.error;
  }
  function render(focus = false) {
    const [requested, section] = location.hash.slice(1).split('/');
    if (['stories','shop','join'].includes(requested)) { location.replace('market.html' + location.search + '#' + requested); return; }
    state.route = Object.hasOwn(titles, requested) ? requested : 'home';
    if (state.route === 'mine') state.mineTab = ['overview','gifts','service'].includes(section) ? section : 'overview';
    if (state.route === 'garden' && state.data.stages.some(x => x.id === section)) state.stage = section;
    document.title = titles[state.route] + ' · 小桃满桃园云养';
    main.setAttribute('aria-busy', 'true'); main.innerHTML = V[state.route](state); main.setAttribute('aria-busy', 'false');
    document.querySelectorAll('[data-route]').forEach(node => { if (node.dataset.route === state.route) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
    updateBanner();
    if (focus) { window.scrollTo({top:0,behavior:'instant'}); main.focus({preventScroll:true}); }
  }
  async function refresh(renderNow = true) { state.my = await store.refresh(); if (renderNow) render(); }
  async function connect() {
    if (loading) return; loading = true;
    try { const result = await store.init(); state.data = result.data; state.my = result.my; state.error = ''; if (!dialog.open) render(); else updateBanner(); }
    catch (error) { state.error = error.message; updateBanner(); }
    finally { loading = false; }
  }
  function planDetail(id) {
    const p = plan(id), total = Object.values(p.cost).reduce((a,b) => a+b,0);
    open(`${pill(p.scene, 'pill-green')}<h2>${e(p.name)}</h2><p>${e(p.subtitle)}</p>${image(p.image, p.name, 'detail-photo')}<div class="quote-total"><span>${p.weight}斤精选鲜桃<small>每份 / 广东省内包装配送 / 模拟报价</small></span><strong>${money(p.price)}</strong></div><ul class="detail-rights">${p.rights.map(t => `<li>${icon('check')}${e(t)}</li>`).join('')}</ul><p>${e(p.delivery)}</p><details class="cost-disclosure"><summary>查看方案费用组成</summary><p class="form-help">经营情景测算 / 元每份</p><div class="detail-costs">${Object.entries(p.cost).map(([n,v]) => `<div>${e(n)}<b>${v}</b></div>`).join('')}<div>贡献余额<b>${p.margin}</b></div></div><p class="form-help">模拟成本合计${total}元，实际经营条款由企业确认后更新。</p></details><div class="button-row">${action('选择这一季', 'enroll', p.id, 'btn btn-primary')}${link('看看四季记录', '#garden', 'text-button')}</div>`, false, '方案与权益');
  }
  function enrollment(id, keep = false) {
    const p = plan(id);
    if (!keep || !state.enrollment || state.enrollment.planId !== id) state.enrollment = {planId:id,nickname:api?.user?.name || '', city:'广州', concern:'到手总价', quantity:1,idempotencyKey:store.uuid(),step:1};
    const d = state.enrollment;
    if (d.step === 2) {
      open(`<div class="wizard-steps"><span>1 选择与填写</span><i></i><span class="active">2 确认这一季</span><i></i><span>3 开启期待</span></div><h2>${e(d.nickname)}，把期待收好了。</h2><div class="wizard-summary">${image(p.image,p.name)}<div><b>${e(p.name)}</b><small>${p.weight}斤 × ${d.quantity}份</small></div><strong>${money(p.price*d.quantity)}</strong></div><dl class="confirm-list">${[['体验昵称',d.nickname],['所在城市',d.city],['最关注',d.concern],['预计收获','2027年7月成熟季']].map(([k,v]) => `<div><dt>${k}</dt><dd>${e(v)}</dd></div>`).join('')}</dl><div class="quote-total"><span>本次方案总价<small>含广东省内包装与配送</small></span><strong>${money(p.price*d.quantity)}</strong></div><p class="form-help">本次登记生成SIM模拟意向记录，可持续查看成长与服务进度。</p><form id="enroll-confirm" class="season-form"><p class="form-error" data-error role="alert" hidden></p><div class="button-row"><button type="submit" class="btn btn-primary">确认登记${icon('check')}</button>${action('返回修改', 'enroll-back', '', 'text-button', '')}</div></form>`, false, '认养一季 · 确认信息');
      return;
    }
    open(`<div class="wizard-steps"><span class="active">1 选择与填写</span><i></i><span>2 确认这一季</span><i></i><span>3 开启期待</span></div><h2>开始你的${e(p.name)}。</h2><div class="wizard-summary">${image(p.image,p.name)}<div><b>${e(p.scene)} · ${p.weight}斤 / 份</b><small>广东省内包装配送</small></div><strong>${money(p.price)}</strong></div><form id="enroll-form" class="season-form"><div class="form-two"><label>体验昵称<input name="nickname" maxlength="18" autocomplete="nickname" value="${e(d.nickname)}" placeholder="给这一季留个名字" required></label><label>所在城市<select name="city">${['广州','深圳','河源','东莞','惠州','佛山'].map(x=>`<option ${x===d.city?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="form-two"><label>方案份数<select name="quantity">${[1,2,3].map(x=>`<option value="${x}" ${x===d.quantity?'selected':''}>${x}份 · ${p.weight*x}斤</option>`).join('')}</select></label><label>你最关心的事<select name="concern">${['到手总价','产地来源','售后认定','到货安排','季节陪伴'].map(x=>`<option ${x===d.concern?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="quote-total"><span>这一季的方案总价<small>2027年7月计划 / 模拟报价</small></span><strong id="enroll-total">${money(p.price*d.quantity)}</strong></div><p class="form-error" data-error role="alert" hidden></p><button type="submit" class="btn btn-primary">下一步，核对信息${icon('arrow')}</button></form>`, false, '认养一季 · 选择与填写');
  }
  async function saveEnrollment() {
    const d = state.enrollment, {step,...payload} = d;
    const item = await store.intent(payload, state.data.plans); await refresh(false); state.sampleId = ''; state.enrollment = null;
    render();
    open(`<div class="success-icon">${icon('check')}</div><p class="eyebrow">这一季，从现在开始</p><h2>${e(item.nickname)}的期待，已经收好。</h2><p>${e(plan(item.planId).name)} · ${money(item.amount)} · ${item.quantity}份</p><div class="record-number">模拟记录编号：${e(item.id)}</div><p>接着去看四季成长，或者为这一季做一张纪念卡。</p><div class="button-row">${link('去看四季成长', '#garden', 'btn btn-primary')}${link('查看我的桃园', '#mine', 'btn btn-outline')}${action('生成纪念卡', 'certificate', item.id, 'text-button', 'down')}</div>`, false, '意向登记成功');
  }
  function task(id) {
    const stage = state.data.stages.find(x => x.id === id), prior = V.activity(state,'stage',id);
    const note = prior?.message || '';
    open(`${pill(stage.month,'pill-green')}<h2>${e(stage.name)}，一起参与。</h2><p>${e(stage.task)}</p>${image('assets/orchard/'+stage.image+'.webp',stage.name,'detail-photo')}<form id="stage-form" data-stage="${id}" class="season-form"><label>把这一刻，留在成长手记里<textarea name="message" maxlength="160" rows="3" placeholder="写下观察、期待，或想对果农说的话…">${e(note)}</textarea></label><p class="form-help">成长节点与留言会保存在我的桃园。</p><p class="form-error" data-error role="alert" hidden></p><button type="submit" class="btn btn-primary">${prior?'更新我的参与':'收藏这一站'}${icon('check')}</button></form>`, false, '四季参与');
  }
  function wish() {
    const prior = state.my.activities.find(x => x.type === 'wish');
    open(`${pill('写给2027年7月','pill-green')}<h2>给七月，写一句此刻的话。</h2><p>想和谁一起吃桃？想把山野的甜送给谁？</p><form id="wish-form" class="season-form"><label>我的七月愿望<textarea name="message" rows="4" maxlength="160" required placeholder="等七月，想和家人一起分享这箱桃。">${e(prior?.message || '')}</textarea></label><p class="form-error" data-error role="alert" hidden></p><button type="submit" class="btn btn-primary">保存我的愿望${icon('leaf')}</button></form>`,false,'写给七月的信');
  }
  function feedback(recordId = '') {
    const choices = state.my.intents;
    open(`${pill('成长、方案与收获服务')}<h2>有想了解的，和桃园聊聊。</h2><form id="feedback-form" class="season-form"><label>关联哪一份期待<select name="recordId"><option value="garden">桃园公共成长页</option>${choices.map(x=>`<option value="${e(x.id)}" ${recordId===x.id?'selected':''}>${e(x.nickname)}的${e(plan(x.planId).name)}</option>`).join('')}</select></label><label>问题类型<select name="kind">${['成长咨询','方案咨询','到货破损','重量核对','礼卡领取'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>具体情况<textarea name="message" maxlength="500" rows="4" placeholder="写清记录、时间和你关心的问题，方便果园跟进。" required></textarea></label><p class="form-help">保存后可在“我的桃园 → 服务与探园”查看回复。</p><p class="form-error" data-error role="alert" hidden></p><button type="submit" class="btn btn-primary">保存这条反馈${icon('arrow')}</button></form>`,false,'联系桃园');
  }
  function visit() {
    open(`${pill('2027年3—7月 / 1—4人同行','pill-green')}<h2>下一次，在桃树下见。</h2>${image('assets/orchard/orchard-path.webp','前期实拍：桃园小路','detail-photo')}<form id="visit-form" class="season-form"><div class="form-two"><label>期望探园日期<input type="date" name="date" min="2027-03-01" max="2027-07-31" required></label><label>同行人数<select name="people">${[1,2,3,4].map(n=>`<option value="${n}" ${n===2?'selected':''}>${n}人</option>`).join('')}</select></label></div><p class="form-help">本次保存模拟探园意向，果园确认接待安排后回写进度。</p><p class="form-error" data-error role="alert" hidden></p><button type="submit" class="btn btn-primary">留下探园意向${icon('calendar')}</button></form>`,false,'山野相见');
  }
  function samples() {
    open(`<p class="eyebrow">48位仿真用户 / 一家合作企业</p><h2>换个视角，认识这一季。</h2><p>选一位家庭、礼赠或社群用户，查看关联的方案与成长记录。</p><input id="sample-search" type="search" class="sample-search" aria-label="搜索仿真用户" placeholder="搜索昵称、城市或场景"><div id="sample-users">${sampleList('')}</div>`,true,'仿真用户体验');
  }
  function sampleList(q) {
    const rows = state.data.profiles.filter(x => [x.id,x.nickname,x.city,x.scene].join(' ').includes(q.trim()));
    return `<p class="form-help">${rows.length} / 48位</p><div class="sample-grid">${rows.map(x=>`<button type="button" class="sample-user" data-do="sample-pick" data-value="${e(x.id)}"><b>${e(x.nickname)}</b><small>${e(x.city)} · ${e(x.scene)}</small><span>${e(x.concerns.join(' · '))}</span></button>`).join('')}</div>`;
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('链接已复制，可以寄给重要的人。'); }
    catch { open(`<h2>复制这份期待</h2><p>长按或选中下方链接，复制给朋友。</p><textarea class="copy-link-field" readonly aria-label="领取链接">${e(text)}</textarea>`,false,'分享链接'); }
  }
  function giftLink(g) {
    const url = rootURL(); url.hash='gift'; url.searchParams.set('gift',g.id); url.searchParams.set('code',g.code);
    if (!store.server) url.searchParams.set('preview',JSON.stringify({id:g.id,code:g.code,from:g.from,to:g.to,message:g.message,status:g.status,simulation:true}));
    return url.href;
  }
  async function invitation() {
    const id=params.get('gift'), code=params.get('code'); if(!id || !code) return;
    let supplied; try { supplied=JSON.parse(params.get('preview') || 'null'); } catch {}
    try {
      const g=await store.giftPreview(id,code,supplied); state.invitation={...g,code};
      open(`${pill('一份来自'+g.from+'的桃园心意','pill-green')}<h2>亲爱的${e(g.to)}，<br>有份七月的期待寄给你。</h2><div class="claim-quote">${e(g.message)}</div><p class="claim-from">来自 ${e(g.from)} · 2027桃季模拟心意卡</p><form id="claim-form" class="season-form"><p class="form-error" data-error role="alert" hidden></p><button class="btn btn-primary" type="submit">收藏这份心意${icon('gift')}</button></form>`,false,'收到一份心意');
    } catch(error) { open(`<h2>找找这份心意。</h2><p>${e(error.message)}</p><p>请向赠送人核对完整链接，再回来继续领取。</p>${link('先看看桃园','#garden','btn btn-primary')}`,false,'心意卡领取'); }
  }
  function clearInvite() { const url = new URL(location.href); for(const k of ['gift','code','preview'])url.searchParams.delete(k); history.replaceState(null,'',url); }
  function loadImg(src) { return new Promise((resolve,reject)=>{const img=new Image(); img.onload=()=>resolve(img);img.onerror=reject;img.src=window.PeachCompat?.imageSource?window.PeachCompat.imageSource(src):src;}); }
  function drawWrapped(ctx, text, x, y, width, lineHeight, lines = 3) {
    let line='',n=0; for(const char of String(text)){ if((ctx.measureText(line+char).width>width || char==='\n') && line){ctx.fillText(line,x,y+n*lineHeight);line='';n++;if(n>=lines)return;} if(char!=='\n')line+=char; } if(n<lines)ctx.fillText(line,x,y+n*lineHeight);
  }
  async function card(id, gift = false) {
    const item=gift?state.my.gifts.find(x=>x.id===id):currentRecord(id); if(!item)throw Error('请先选择自己的季节记录。');
    open(`<p class="eyebrow">把这一季，认真收藏</p><h2>${gift?'寄给'+e(item.to)+'的心意':'属于'+e(item.nickname)+'的七月'}</h2><canvas class="card-canvas" id="season-card" width="1200" height="860" aria-label="${gift?'心意卡':'季节纪念卡'}预览"></canvas><div class="button-row">${action('保存卡片','download-card','','btn btn-primary','down')}${action('复制分享链接',gift?'gift-link':'garden-link',id,'btn btn-outline','copy')}</div>`,true,'季节纪念卡');
    const canvas=document.querySelector('#season-card'), c=canvas.getContext('2d'), url=gift?giftLink(item):new URL('#garden',rootURL()).href;
    if(gift){
      canvas.width=1000;canvas.height=1500;
      c.fillStyle='#faf7eb';c.fillRect(0,0,1000,1500);
      try{const scene=await loadImg('assets/season-art/peach-postcard.webp');if(!canvas.isConnected)return;c.drawImage(scene,0,0,1000,1500);}catch{}
      c.fillStyle='#214d38';c.font='25px Microsoft YaHei';c.fillText('桃 园 云 养',75,90);c.font='21px Georgia';c.fillText('2027 / SUMMER',715,90);
      c.strokeStyle='#c8ceb6';c.beginPath();c.moveTo(75,120);c.lineTo(925,120);c.stroke();
      c.font='35px Microsoft YaHei';drawWrapped(c,'TO · '+item.to,75,187,850,46,2);
      c.font='bold 55px Microsoft YaHei';c.fillText('等花开，也等与你分享。',75,320);
      c.font='30px Microsoft YaHei';c.fillStyle='#59704e';drawWrapped(c,item.message.replace(/\s+/g,' '),75,401,840,45,5);
      c.font='24px Microsoft YaHei';drawWrapped(c,'来自 '+item.from+' 的一份期待',75,647,840,34,1);
      if(typeof qrcode==='function'){
        const qr=qrcode(0,'M');qr.addData(url);qr.make();const n=qr.getModuleCount(),size=142,unit=size/(n+8);
        c.fillStyle='#fffdf4';c.fillRect(75,697,size,size);c.fillStyle='#214d38';
        for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))c.fillRect(75+(x+4)*unit,697+(y+4)*unit,Math.ceil(unit),Math.ceil(unit));
      }
      c.fillStyle='#59704e';c.font='19px Microsoft YaHei';c.fillText('扫码领取这份心意',240,742);c.font='16px Microsoft YaHei';c.fillText('模拟体验 / '+item.id,240,779);
      c.font='17px Microsoft YaHei';c.fillText('广东 · 连平上坪',75,1442);c.fillText('AI辅助邮笺插画',770,1442);
      canvas.dataset.ready='1';return;
    }
    c.fillStyle='#edf0dc';c.fillRect(0,0,1200,860);c.strokeStyle='#b6c6a0';c.lineWidth=2;c.strokeRect(24,24,1152,812);
    c.fillStyle='#214d38';c.font='24px Peach,Microsoft YaHei';c.fillText('小桃满 · 桃园云养',65,90);c.font='19px Georgia';c.fillText('2027 / A SEASON TO REMEMBER',720,88);
    c.strokeStyle='#c8d1b7';c.beginPath();c.moveTo(65,120);c.lineTo(1135,120);c.stroke();
    c.font='bold 57px Microsoft YaHei';drawWrapped(c,gift?'亲爱的'+item.to+'，\n把七月，寄给你。':item.nickname+'的\n七月期待，正在生长。',65,223,800,84,2);
    c.fillStyle='#7e906e';c.font='27px Microsoft YaHei';drawWrapped(c,gift?item.message:plan(item.planId).name+' · '+plan(item.planId).weight+'斤鲜桃权益\n等花开，等果熟，也等与你分享。',68,438,780,44,3);
    c.font='19px Microsoft YaHei';c.fillText('广东河源 · 连平上坪 · 2027桃季',68,665);c.font='16px Microsoft YaHei';c.fillText('模拟体验 / '+item.id,68,707);c.fillText('扫码一起看桃园，收藏这一季的变化。',68,785);
    try {const ip=await loadImg('assets/ip-season/'+(gift?'gift':'welcome')+'.webp');if(canvas.isConnected)c.drawImage(ip,875,425,240,280);}catch{}
    if (typeof qrcode === 'function') { const qr=qrcode(0,'M');qr.addData(url);qr.make();const n=qr.getModuleCount(),size=200,unit=size/(n+8),startX=925,startY=170;c.fillStyle='#fffef5';c.fillRect(startX,startY,size,size);c.fillStyle='#214d38';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))c.fillRect(startX+(x+4)*unit,startY+(y+4)*unit,Math.ceil(unit),Math.ceil(unit)); }
    canvas.dataset.ready='1';
  }
  async function guide() {
    open(`${pill('原创IP / 小桃满','pill-green')}<h2>这一季，我陪你看。</h2><div class="guide-dialog">${image('assets/ip-season/guide.webp','小桃满')}<p>你好呀！我是小桃满。我们的桃园在广东连平上坪。一起看山野蓄力，等三月花开、七月果熟。你可以先选一份喜欢的方案，也可以写下愿望，把这一季的期待寄给重要的人。</p></div><audio controls src="cloud/guide.mp3" class="guide-audio" aria-label="小桃满桃园导览"></audio><div class="button-row">${link('一起去看四季','#garden','btn btn-primary')}${action('问问小桃满','assistant','','text-button','chat')}</div>`,false,'桃园导览');
    activeAudio=body.querySelector('audio'); try{await activeAudio.play();}catch{}
  }
  function account() {
    if(api?.user){open(`<p class="eyebrow">我的账号</p><h2>你好，${e(api.user.name || api.user.account)}。</h2><p>云养记录、商城订单和共创任务，都可以从这里继续。</p><div class="account-options">${link('我的桃园','#mine','')}${link('我的商城订单','market.html?orders=1#shop','')}${link('成员共创空间','market.html#join','')}</div>${action('退出账号','logout','','btn btn-outline','')}`,false,'账号与服务');return;}
    const register=authTab==='register';
    open(`<p class="eyebrow">小桃满 · 一起认识桃乡</p><h2>${register?'创建你的桃乡账号。':'登录，接着走这一季。'}</h2><form id="account-form" class="season-form"><label>账号<input name="account" autocomplete="username" pattern="[a-zA-Z0-9_]{3,40}" minlength="3" maxlength="40" required placeholder="3—40位字母、数字或下划线" ${store.server?'':'value="test1"'}></label><label>密码<input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" minlength="${register?10:6}" maxlength="128" required placeholder="${register?'至少10位':'输入密码'}" ${store.server?'':'value="123456"'}></label><p class="form-error" data-error role="alert" hidden></p><button class="btn btn-primary" type="submit">${register?'注册并登录':'登录'}${icon('arrow')}</button></form>${store.server?action(register?'已有账号，去登录':'创建一个账号','auth-switch','','text-button',''):''}<p class="form-help">体验账号 test1 / 123456 · 顾客与运营后台分别登录</p>`,false,'桃乡账号');
  }
  function updateAccount() {document.querySelector('[data-account-name]').textContent=api?.user?.name || '登录';}
  function assistant() {
    const messages=assistantMessages.length?assistantMessages:[{role:'assistant',text:'嗨，我是小桃满！想比较方案、看看四季成长，还是给朋友寄份心意？把你关心的告诉我。'}];
    open(`<p class="eyebrow">你的桃园向导</p><h2>小桃满，听你说。</h2><div class="assistant-shortcuts">${['三档方案怎么选？','什么时候收到桃？','怎样寄心意卡？','怎样联系果园？'].map(x=>`<button type="button" data-do="ask-shortcut" data-value="${x}">${x}</button>`).join('')}</div><div class="assistant-messages" id="assistant-messages">${messages.map(x=>`<div class="assistant-message ${x.role}"><small>${x.role==='user'?'我':'小桃满 · 项目资料'}</small>${e(x.text)}</div>`).join('')}</div><form id="assistant-form" class="assistant-form"><label class="sr-only" for="assistant-input">想问小桃满的问题</label><input id="assistant-input" name="message" maxlength="500" placeholder="问问方案、成长或桃乡的事…" required><button class="btn btn-primary" type="submit" ${assistantBusy?'disabled':''}>发送${icon('arrow')}</button></form><div class="button-row">${link('比较方案','#plans','text-button')}${link('联系桃园','#mine/service','text-button')}${!api?.user?action('登录账号继续聊','account','','text-button','user'):''}</div>`,false,'问问小桃满');
    body.querySelector('#assistant-messages')?.scrollTo({top:100000});
  }
  function localAnswer(q) {
    if(/坏|缺重|售后|联系|反馈/.test(q))return '在“我的桃园 → 服务与探园”写下问题，选择关联记录和问题类型。果园的回复与进度会回到同一页面。商城订单请在商城的对应订单中提交反馈。';
    if(/礼|送|赠/.test(q))return '桃礼卡模拟方案为199元，含8斤礼盒与心意卡。在“寄份心意”填写称呼和祝福，生成领取链接寄给朋友；领取后，双方可在“我的桃园”继续看状态。';
    if(/时间|收到|什么时候|几月|配送|运费/.test(q))return '本季面向2027年7月成熟采摘期，成长页按六个物候节点展示计划。159元、199元、299元模拟方案均包含广东省内包装配送，批次安排随当年物候更新。';
    if(/方案|选择|价格|多少|认养|家庭/.test(q))return '家庭陪伴可看299元“认养一棵桃”：10斤鲜桃、成长档案与两张探园预约券；初次尝鲜可看159元“云养尝鲜箱”：5斤鲜桃；送礼可看199元“桃礼卡”：8斤礼盒与祝福领取。三档均为2027桃季模拟方案。';
    if(/成长|桃园|物候|记录/.test(q))return '打开“四季桃园”，从山野蓄力走到七月收获。每站可以看前期实拍、读成长情景、收藏节点，或者留下一句观察。我的桃园会保存你的参与与愿望。';
    if(/你好|嗨|在吗/.test(q))return '在呢！我是小桃满。你想先逛逛桃园，还是看看适合自己的那份季节方案？';
    return '可以从“认养一季”比较权益，在“四季桃园”看成长，或到“寄份心意”写张卡。也可以告诉我你关心的是价格、配送、成长还是礼赠，我陪你接着看。';
  }
  async function answer(q) {
    q=String(q||'').trim();if(!q)return;
    if(assistantBusy)return;assistantBusy=true;assistantMessages.push({role:'user',text:q});assistant();
    try {
      const seasonTopic=/云养|认养|方案|这一季|七月|成长|物候|礼卡|桃园|收获|运费|什么时候|收到|价格|售后|联系|反馈/.test(q);
      const response=api?.user && !seasonTopic?await api.chat(q):{answer:localAnswer(q)};
      assistantMessages.push({role:'assistant',text:response.answer || localAnswer(q)});
    } catch(error) {assistantMessages.push({role:'assistant',text:'这次连接用时较长。'+localAnswer(q)});}
    finally{assistantBusy=false;if(dialog.open&&body.querySelector('#assistant-form'))assistant();}
  }

  async function click(name,value,el) {
    if(name==='close'){close();return;}
    if(name==='menu'){const nav=document.querySelector('#main-nav');const openNow=nav.classList.toggle('open');el.setAttribute('aria-expanded',String(openNow));return;}
    if(name==='reconnect'){await connect();return;}
    if(name==='enroll'){enrollment(value);return;}
    if(name==='enroll-back'){state.enrollment.step=1;enrollment(state.enrollment.planId,true);return;}
    if(name==='plan-detail'){planDetail(value);return;}
    if(name==='compare'){open('<h2>三份期待，一眼看清。</h2>'+V.comparison(state),true,'方案比较');return;}
    if(name==='plan-filter'){state.planFilter=value;render();return;}
    if(name==='stage'){state.stage=value;if(state.route==='garden')location.hash='garden/'+value;else{const y=scrollY;render();scrollTo(0,y);}return;}
    if(name==='stage-task'){task(value);return;}
    if(name==='favorite'){await store.activity({type:'favorite',stageId:value,message:'',active:!V.activity(state,'favorite',value)});await refresh();toast(V.activity(state,'favorite',value)?'这一站，已收藏。':'已更新收藏。');return;}
    if(name==='stage-logs'){const logs=state.data.logs.filter(x=>x.stageId===value);open(`<h2>${e(state.data.stages.find(x=>x.id===value).name)} · 成长手记</h2><p>前期实拍 / 模拟管护情景</p><div class="log-list">${logs.map(x=>`<button type="button" data-do="log" data-value="${e(x.id)}"><span>${e(x.date)}</span><b>${e(x.title)}</b><small>${e(x.treeId)}</small>${icon('arrow')}</button>`).join('')}</div>`,false,'成长手记');return;}
    if(name==='log'){const x=state.data.logs.find(x=>x.id===value);if(x)open(`${pill(x.date+' / 季节情景','pill-green')}<h2>${e(x.title)}</h2>${image(x.image,x.title,'detail-photo')}<p>${e(x.body)}</p><p class="form-help">${e(x.imageLabel)} · ${e(x.recordLabel)}<br>树牌：${e(x.treeId)} / ${e(x.author)}</p><div class="button-row">${action('参与这一站','stage-task',x.stageId,'btn btn-primary')}${action('收藏这一站','favorite',x.stageId,'text-button','heart')}</div>`,false,'桃园手记');return;}
    if(name==='wish'){wish();return;}
    if(name==='feedback'){feedback(value);return;}
    if(name==='visit'){visit();return;}
    if(name==='sample'){samples();return;}
    if(name==='sample-pick'){state.sampleId=value;close();if(location.hash.startsWith('#mine'))render();else location.hash='mine';toast('已打开仿真用户的季节档案。');return;}
    if(name==='exit-sample'){state.sampleId='';const url=new URL(location.href);url.searchParams.delete('sample');history.replaceState(null,'',url);render();return;}
    if(name==='refresh'){await refresh();toast('桃园记录已更新。');return;}
    if(name==='certificate'){await card(value);return;}
    if(name==='gift-card'){await card(value,true);return;}
    if(name==='download-card'){const c=body.querySelector('#season-card');if(c?.dataset.ready!=='1')throw Error('卡片正在绘制，请稍候再保存。');const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='桃园云养_七月纪念.png';a.click();toast('纪念卡已生成。');return;}
    if(name==='gift-link'){const g=state.my.gifts.find(x=>x.id===value);if(!g)throw Error('请刷新我的心意卡后重试。');await copy(giftLink(g));return;}
    if(name==='garden-link'){await copy(new URL('#garden',rootURL()).href);return;}
    if(name==='guide'){await guide();return;}
    if(name==='film'){open('<h2>小桃满带你走进桃园。</h2><video class="media-player" controls playsinline preload="metadata" poster="assets/orchard/orchard-hills.webp" src="cloud/guide.mp4"></video><p class="form-help">前期桃园实拍 × 原创IP × AI辅助配音</p>',true,'一段桃园故事');return;}
    if(name==='account'){account();return;}
    if(name==='auth-switch'){authTab=authTab==='login'?'register':'login';account();return;}
    if(name==='logout'){await api.logout();updateAccount();close();toast('已退出账号。');return;}
    if(name==='assistant'){assistant();return;}
    if(name==='ask-shortcut'){await answer(value);return;}
    if(name==='privacy'){open('<h2>你的记录，用在这一季。</h2><p>云养登记使用昵称、所在城市与方案偏好；成长、礼卡、探园和反馈用于完成对应体验服务。</p><p>记录按本站访问身份保存。商城收货信息与成员任务按登录账号管理，后台按角色处理。</p><p>分享心意卡时，收礼称呼、赠送称呼与祝福随领取链接传递。请使用适合分享的文字。</p>',false,'隐私与记录');return;}
  }
  document.addEventListener('click',async event=>{
    const anchor=event.target.closest('a[href^="#"]');
    if(anchor&&/^#(home|garden|plans|gift|mine|about)(\/|$)/.test(anchor.getAttribute('href'))&&anchor.hash===location.hash){close();render(true);resumeRecords();}
    const button=event.target.closest('[data-do]');if(!button||button.disabled||button.dataset.busy)return;
    const name=button.dataset.do, value=button.dataset.value || '';
    const lock=['refresh','favorite','reconnect','gift-link','certificate','gift-card','logout','ask-shortcut'].includes(name);
    if(lock){button.dataset.busy='1';button.disabled=true;}
    try{await click(name,value,button);}catch(error){toast(error.message || '操作遇到问题，请稍后重试。');}
    finally{if(lock&&button.isConnected){delete button.dataset.busy;button.disabled=false;}}
  });
  document.addEventListener('input',event=>{
    const form=event.target.closest('form');
    if(form?.id==='enroll-form'&&state.enrollment){const fields=Object.fromEntries(new FormData(form));Object.assign(state.enrollment,fields,{quantity:Number(fields.quantity)});body.querySelector('#enroll-total').textContent=money(plan(state.enrollment.planId).price*Number(fields.quantity));}
    if(form?.id==='gift-form'){state.giftDraft=Object.fromEntries(new FormData(form));const d=state.giftDraft;document.querySelector('[data-gift-from]').textContent=d.from||'山风';document.querySelector('[data-gift-to]').textContent=d.to||'重要的人';document.querySelector('[data-gift-message]').textContent=d.message||'把广东山野的一季，\n变成送给你的心意。';document.querySelector('#gift-count').textContent=d.message.length;}
    if(event.target.id==='sample-search')document.querySelector('#sample-users').innerHTML=sampleList(event.target.value);
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(!['enroll-form','enroll-confirm','stage-form','wish-form','feedback-form','visit-form','gift-form','claim-form','account-form','assistant-form'].includes(form.id))return;
    event.preventDefault();if(form.dataset.busy||!form.reportValidity())return;
    const d=Object.fromEntries(new FormData(form)),button=form.querySelector('[type=submit]'),original=button.innerHTML;
    const errorNode=form.querySelector('[data-error]');if(errorNode)errorNode.hidden=true;
    form.dataset.busy='1';button.disabled=true;button.textContent='正在保存…';
    try{
      if(form.id==='enroll-form'){Object.assign(state.enrollment,d,{nickname:d.nickname.trim(),quantity:Number(d.quantity),step:2});if(!state.enrollment.nickname)throw Error('给这一季留个昵称吧。');enrollment(state.enrollment.planId,true);}
      if(form.id==='enroll-confirm')await saveEnrollment();
      if(form.id==='stage-form'){await store.activity({type:'stage',stageId:form.dataset.stage,message:d.message.trim(),active:true});await refresh(false);close();render();toast('这一站，已留在你的成长记录里。');}
      if(form.id==='wish-form'){await store.activity({type:'wish',stageId:'care',message:d.message.trim(),active:true});await refresh(false);close();render();toast('七月的愿望，已保存。');}
      if(form.id==='feedback-form'){await store.feedback(d);await refresh(false);close();location.hash='mine/service';render();toast('反馈已保存，可在这里查看回复。');}
      if(form.id==='visit-form'){await store.visit({date:d.date,people:Number(d.people)});await refresh(false);close();location.hash='mine/service';render();toast('探园意向已保存。');}
      if(form.id==='gift-form'){const g=await store.gift({from:d.from.trim(),to:d.to.trim(),message:d.message.trim()});await refresh(false);state.lastGift=g;render();document.querySelector('#gift-result')?.scrollIntoView({behavior:'smooth',block:'center'});toast('心意卡已生成，寄出这份期待吧。');}
      if(form.id==='claim-form'){const g=state.invitation;await store.claim(g.id,g.code,g);await refresh(false);clearInvite();close();location.hash='mine/gifts';render();toast('这份心意，已经收藏。');}
      if(form.id==='account-form'){await api.login(d.account,d.password,authTab==='register');updateAccount();close();toast('已登录，欢迎回来。');}
      if(form.id==='assistant-form'){await answer(d.message.trim());}
    }catch(error){const target=errorNode?.isConnected?errorNode:null;if(target){target.textContent=error.message;target.hidden=false;target.scrollIntoView({block:'nearest'});}else toast(error.message);}
    finally{if(form.isConnected){delete form.dataset.busy;button.disabled=false;button.innerHTML=original;}}
  });
  const resumeRecords=()=>{if(state.route==='mine'&&store.connected)refresh().catch(error=>{state.error=error.message;updateBanner();});};
  window.addEventListener('hashchange',()=>{close();document.querySelector('#main-nav').classList.remove('open');document.querySelector('[data-do=menu]').setAttribute('aria-expanded','false');render(true);resumeRecords();});
  window.addEventListener('focus',resumeRecords);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resumeRecords();});
  window.addEventListener('season:storage',updateBanner);
  window.addEventListener('storage',event=>{if(!store.server&&['taoxiang-independent:season:v2','peach-cloud-v1'].includes(event.key))refresh().catch(error=>toast(error.message));});
  document.querySelector('#main-nav').addEventListener('click',event=>{if(event.target.closest('a')){document.querySelector('#main-nav').classList.remove('open');document.querySelector('[data-do=menu]').setAttribute('aria-expanded','false');}});
  render();connect().then(invitation);
  api?.init().then(updateAccount).catch(()=>{});
})();
