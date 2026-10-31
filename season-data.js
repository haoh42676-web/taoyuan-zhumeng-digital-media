/* Shared season records: server persistence and explicit local preview. */
(() => {
  'use strict';
  const server = window.PEACH_CONFIG?.mode === 'server';
  const prefix = server ? (window.PEACH_CONFIG.apiBase || '') : '';
  const key = 'taoxiang-independent:season:v2';
  const empty = () => ({intents: [], gifts: [], receivedGifts: [], activities: [], feedback: [], visits: []});
  let memory = empty(), unavailable = false, ready = !server;
  const clone = v => JSON.parse(JSON.stringify(v));
  const uuid = () => globalThis.crypto?.randomUUID?.() || 's' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const normalize = value => Object.fromEntries(Object.keys(empty()).map(k => [k, Array.isArray(value?.[k]) ? value[k].filter(x => x && typeof x === 'object' && typeof x.id === 'string') : []]));
  const event = name => window.dispatchEvent(new Event(name));

  function read() {
    if (!unavailable) try {
      const raw = localStorage.getItem(key);
      if (raw) memory = normalize(JSON.parse(raw));
      else {
        const old = JSON.parse(localStorage.getItem('peach-cloud-v1') || '{}');
        memory = normalize({...old, intents: old.my || []});
      }
    } catch { unavailable = true; }
    return clone(window.PeachRecordLabels?window.PeachRecordLabels.correct(memory):memory);
  }
  function write(value) {
    memory = normalize(value);
    if (!unavailable) try { localStorage.setItem(key, JSON.stringify(memory)); }
    catch { unavailable = true; event('season:storage'); }
    return clone(window.PeachRecordLabels?window.PeachRecordLabels.correct(memory):memory);
  }
  async function request(path, method = 'GET', body) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(prefix + '/api/cloud' + path, {
        method, credentials: 'same-origin', signal: controller.signal,
        headers: {'Content-Type': 'application/json', 'X-Peach-Request': '1'},
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({error: {message: '服务正在准备，请稍后重试。'}}));
      if (!response.ok) throw Object.assign(Error(payload.error?.message || '保存遇到问题，请重试。'), {status: response.status});
      return payload.data;
    } catch (error) {
      if (error.name === 'AbortError') throw Error('这次连接用时较长，请重试，填写内容已保留。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  const row = (kind, data) => ({...data, id: 'SIM-' + kind + '-' + uuid().slice(0, 12), simulation: false, version: 1, createdAt: new Date().toISOString()});
  function insert(collection, item) { const data = read(); data[collection] = [item, ...data[collection].filter(x => x.id !== item.id)]; write(data); return item; }
  function ensureReady() { if (server && !ready) throw Error('请先重新连接桃园，再保存这次操作。'); }

  const store = {
    server, uuid,
    get volatile() { return unavailable; },
    get connected() { return ready; },
    async init() {
      if (!server) return {data: clone(window.CLOUD_SEED), my: read()};
      const [data, my] = await Promise.all([request('/bootstrap'), request('/my')]);
      ready = true; memory = normalize(my);
      return {data, my: clone(memory)};
    },
    async refresh() {
      if (!server) return read();
      const my = await request('/my'); memory = normalize(my); ready = true; return clone(window.PeachRecordLabels?window.PeachRecordLabels.correct(memory):memory);
    },
    async intent(body, plans) {
      ensureReady();
      if (server) return request('/intents', 'POST', body);
      const saved = read(), prior = saved.intents.find(x => x.idempotencyKey === body.idempotencyKey);
      if (prior) return prior;
      const p = plans.find(x => x.id === body.planId);
      return insert('intents', row('I', {...body, planName: p.name, amount: p.price * body.quantity, treeId: 'SIM-ORCHARD-A', status: '意向已登记'}));
    },
    async gift(body) { ensureReady(); return server ? request('/gifts', 'POST', body) : insert('gifts', row('G', {...body, code: uuid().slice(0, 8).toUpperCase(), planId: 'gift', status: '待领取'})); },
    async giftPreview(id, code, supplied) {
      if (server) return request('/gifts/' + encodeURIComponent(id) + '?code=' + encodeURIComponent(code));
      const found = read().gifts.find(x => x.id === id && x.code === code);
      if (found) return found;
      if (supplied?.id === id && supplied.code === code && typeof supplied.message === 'string' && supplied.message.length <= 100 && typeof supplied.from === 'string' && typeof supplied.to === 'string' && supplied.from.length <= 18 && supplied.to.length <= 18) return {...supplied, simulation: false};
      throw Error('请核对领取链接与领取码。');
    },
    async claim(id, code, supplied) {
      ensureReady();
      if (server) return request('/gifts/' + encodeURIComponent(id) + '/claim', 'POST', {code});
      const gift = await store.giftPreview(id, code, supplied), data = read();
      data.gifts = data.gifts.map(x => x.id === id ? {...x, status: '已领取'} : x);
      const receipt = {...gift, id: 'SIM-R-' + id, giftId: id, status: '已领取', createdAt: new Date().toISOString()};
      delete receipt.code;
      data.receivedGifts = [receipt, ...data.receivedGifts.filter(x => x.giftId !== id)];
      write(data); return {id, status: '已领取', simulation: false};
    },
    async activity(body) {
      ensureReady();
      if (server) return request('/activities', 'POST', body);
      const data = read(), prior = data.activities.find(x => x.type === body.type && x.stageId === body.stageId);
      const item = {...row('A', body), id: prior?.id || 'SIM-A-' + uuid().slice(0, 12), version: (prior?.version || 0) + 1};
      return insert('activities', item);
    },
    async feedback(body) { ensureReady(); return server ? request('/feedback', 'POST', body) : insert('feedback', row('F', {...body, status: '待处理', reply: ''})); },
    async visit(body) { ensureReady(); return server ? request('/visits', 'POST', body) : insert('visits', row('V', {...body, status: '待安排'})); }
  };
  window.PeachSeasonData = store;
})();
