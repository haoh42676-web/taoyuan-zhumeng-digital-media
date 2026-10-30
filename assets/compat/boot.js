/* ES5 entry: select local compatibility assets before application scripts run. */
(function () {
  'use strict';
  var scripts = document.getElementsByTagName('script'), self = scripts[scripts.length - 1];
  for (var i = 0; i < scripts.length; i++) if (scripts[i].getAttribute('data-peach-boot')) self = scripts[i];
  var base = self.src.replace(/assets\/compat\/boot\.js(?:\?.*)?$/, '');
  var page = self.getAttribute('data-peach-boot');
  var legacy = !!document.documentMode || !window.fetch || !window.Promise || !Object.fromEntries || !Object.hasOwn || !String.prototype.replaceAll || !window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal || /(?:^|[?&])compat=legacy(?:&|$)/.test(location.search);
  window.PeachCompat = {legacy: legacy, base: base, page: page};
  document.documentElement.setAttribute('data-compat', legacy ? 'legacy' : 'modern');
  if (legacy) {
    document.documentElement.className += ' legacy-browser';
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'assets/compat/' + page + '.css';
    document.head.appendChild(css);
  }
  var sources = [], nodes = document.querySelectorAll('script[data-peach-src]');
  for (i = 0; i < nodes.length; i++) sources.push(nodes[i].getAttribute('data-peach-src'));
  function load(src, next) {
    var script = document.createElement('script'); script.src = src; script.async = false;
    script.onload = next;
    script.onerror = function () {
      var target = document.getElementById('compat-status');
      if (!target) { target = document.createElement('p'); target.id = 'compat-status'; target.setAttribute('role', 'alert'); document.body.appendChild(target); }
      target.innerHTML = '页面资源加载中断，<a href="' + location.href.replace(/"/g, '%22') + '">重新加载继续</a>。';
    };
    document.head.appendChild(script);
  }
  function next() {
    var src = sources.shift();
    if (!src) { document.documentElement.setAttribute('data-app-loaded', 'true'); return; }
    load(legacy ? base + 'assets/compat/js/' + src.replace(/^\//, '') : base + src.replace(/^\//, ''), next);
  }
  function start() { load(base + (legacy ? 'assets/compat/js/browser-adapt.js' : 'browser-adapt.js'), next); }
  if (legacy) load(base + 'assets/compat/polyfills.js', start); else start();
})();
