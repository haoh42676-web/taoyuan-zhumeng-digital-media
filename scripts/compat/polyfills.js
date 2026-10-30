import './events.js';
import 'core-js/stable';
import 'whatwg-fetch';
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import 'url-polyfill';
import dialogPolyfill from 'dialog-polyfill';

// DOM APIs used by both the season experience and the existing operating tools.
const ep = Element.prototype;
if (!ep.matches) ep.matches = ep.msMatchesSelector || ep.webkitMatchesSelector;
if (!ep.closest) ep.closest = function (selector) { let el = this; while (el) { if (el.matches(selector)) return el; el = el.parentElement; } return null; };
for (const proto of [Element.prototype, DocumentFragment.prototype, Document.prototype]) {
  if (!proto.append) proto.append = function (...items) { for (const item of items) this.appendChild(typeof item === 'string' ? document.createTextNode(item) : item); };
  if (!proto.prepend) proto.prepend = function (...items) { const fragment = document.createDocumentFragment(); fragment.append(...items); this.insertBefore(fragment, this.firstChild); };
  if (!proto.replaceChildren) proto.replaceChildren = function (...items) { while (this.firstChild) this.removeChild(this.firstChild); this.append(...items); };
}
if (!ep.remove) ep.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
if (!ep.after) ep.after = function (...items) { if (!this.parentNode) return; const f = document.createDocumentFragment(); f.append(...items); this.parentNode.insertBefore(f, this.nextSibling); };
if (!('isConnected' in Node.prototype)) Object.defineProperty(Node.prototype, 'isConnected', {get() { return document.documentElement.contains(this); }});
if (typeof window.CustomEvent !== 'function') { window.CustomEvent = function (name, args = {}) { const event = document.createEvent('CustomEvent'); event.initCustomEvent(name, !!args.bubbles, !!args.cancelable, args.detail); return event; }; }
if (typeof window.Event !== 'function') { window.Event = function (name, args = {}) { const event = document.createEvent('Event'); event.initEvent(name, !!args.bubbles, !!args.cancelable); return event; }; }
if (!window.queueMicrotask) window.queueMicrotask = fn => Promise.resolve().then(fn);
if (!AbortSignal.timeout) AbortSignal.timeout = ms => { const controller = new AbortController(); setTimeout(() => controller.abort(), ms); return controller.signal; };
if (!window.ResizeObserver) window.ResizeObserver = class {
  constructor(fn) { this.fn = fn; this.items = []; this.listener = () => fn(this.items.map(target => ({target, contentRect: target.getBoundingClientRect()}))); window.addEventListener('resize', this.listener); }
  observe(target) { if (!this.items.includes(target)) this.items.push(target); this.listener(); }
  unobserve(target) { this.items = this.items.filter(x => x !== target); }
  disconnect() { window.removeEventListener('resize', this.listener); this.items = []; }
};

// IE exposes form submission but lacks the iterable FormData contract.
if (!FormData.prototype.entries) {
  const Native = window.FormData;
  function Compatible(form) {
    const fd = form ? new Native(form) : new Native(), values = [];
    if (form) for (const el of Array.from(form.elements)) {
      if (!el.name || el.disabled || /^(button|submit|reset|image)$/i.test(el.type) || (/^(checkbox|radio)$/i.test(el.type) && !el.checked)) continue;
      if (el.tagName === 'SELECT' && el.multiple) { for (const option of Array.from(el.options)) if (option.selected) values.push([el.name, option.value]); }
      else if (el.type === 'file') { for (const file of Array.from(el.files || [])) values.push([el.name, file]); }
      else values.push([el.name, el.value]);
    }
    const append = fd.append;
    fd.append = function (name, value, filename) { values.push([String(name), value]); return filename === undefined ? append.call(fd, name, value) : append.call(fd, name, value, filename); };
    fd.entries = () => values[Symbol.iterator](); fd[Symbol.iterator] = fd.entries;
    fd.get = name => (values.find(pair => pair[0] === name) || [null, null])[1];
    fd.getAll = name => values.filter(pair => pair[0] === name).map(pair => pair[1]);
    return fd;
  }
  Compatible.prototype = Native.prototype; window.FormData = Compatible;
}

const create = document.createElement.bind(document);
function register(node) { if (node.tagName === 'DIALOG' && !node.showModal) dialogPolyfill.registerDialog(node); return node; }
document.createElement = function (name, options) { return register(create(name, options)); };
Array.from(document.querySelectorAll('dialog')).forEach(register);
function details() {
  for (const node of Array.from(document.querySelectorAll('details'))) if (!('open' in node)) Object.defineProperty(node, 'open', {get() { return this.hasAttribute('open'); }, set(value) { if (value) this.setAttribute('open', ''); else this.removeAttribute('open'); }});
}
document.addEventListener('click', event => { const summary = event.target.closest('summary'); if (summary && !event.defaultPrevented && summary.parentElement.tagName === 'DETAILS') { event.preventDefault(); summary.parentElement.open = !summary.parentElement.open; } });
details();

// Keep source selectors readable while resolving the direct-child :scope subset.
const query = ep.querySelector, queryAll = ep.querySelectorAll;
function scoped(node, selector) { return Array.from(node.children).filter(child => child.matches(selector.slice(7))); }
ep.querySelector = function (selector) { return selector.indexOf(':scope>') === 0 ? scoped(this, selector)[0] || null : query.call(this, selector); };
ep.querySelectorAll = function (selector) { return selector.indexOf(':scope>') === 0 ? scoped(this, selector) : queryAll.call(this, selector); };

// Safari and embedded browsers may expose only the numeric scrolling contract.
const nativeScroll = window.scrollTo.bind(window);
window.scrollTo = function (x, y) { if (typeof x === 'object') return nativeScroll(x.left || 0, x.top || 0); return nativeScroll(x, y); };
const nativeIntoView = ep.scrollIntoView;
ep.scrollIntoView = function (options) { return nativeIntoView.call(this, typeof options === 'object' ? options.block !== 'end' : options); };

// Convert bundled WebP images for the IE renderer, including off-DOM canvas images.
function imageSource(src) { const match = String(src).match(/(?:^|\/)(assets\/[^?#]+\.webp)(?:[?#].*)?$/i); return match ? window.PeachCompat.base + 'assets/compat/images/' + match[1].replace(/\.webp$/i, '.png') : src; }
window.PeachCompat.imageSource = imageSource;
const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
if (descriptor && descriptor.set) try { Object.defineProperty(HTMLImageElement.prototype, 'src', {get: descriptor.get, set(value) { descriptor.set.call(this, imageSource(value)); }, configurable: true}); } catch {}
function images() { for (const img of Array.from(document.images)) { const src = img.getAttribute('src'), next = imageSource(src); if (src && next !== src) img.setAttribute('src', next); } details(); }
images(); new MutationObserver(images).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['src']});

if (!navigator.clipboard) Object.defineProperty(navigator, 'clipboard', {value: {writeText(text) { return new Promise((resolve, reject) => { const el = create('textarea'); el.value = text; el.style.cssText = 'position:fixed;left:0;top:0;opacity:0'; (document.querySelector('dialog[open]') || document.body).appendChild(el); el.select(); try { if (!document.execCommand('copy')) throw Error('请选中链接后复制'); resolve(); } catch (error) { reject(error); } finally { el.remove(); } }); }}});
if (navigator.msSaveOrOpenBlob) {
  document.addEventListener('click', event => {
    const a = event.target.closest('a[download]'); if (!a) return;
    if (/^data:/.test(a.href)) { event.preventDefault(); const parts = a.href.split(','), bytes = atob(parts[1]), data = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) data[i] = bytes.charCodeAt(i); navigator.msSaveOrOpenBlob(new Blob([data], {type: parts[0].slice(5).split(';')[0]}), a.download); }
    else if (/^blob:/.test(a.href)) { event.preventDefault(); fetch(a.href).then(r => r.blob()).then(blob => navigator.msSaveOrOpenBlob(blob, a.download)); }
  }, true);
  // Card downloads click a detached anchor, so forward that case to the same handler.
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download') && !this.isConnected) { document.body.appendChild(this); try { click.call(this); } finally { this.remove(); } } else click.call(this); };
}
window.PeachCompat.polyfillsReady = true;
