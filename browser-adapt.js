/* ES5 shared viewport behavior, used by Safari, Android shells and older desktops. */
(function () {
  'use strict';
  var root = document.documentElement, viewport = window.visualViewport, baseline = window.innerHeight;
  function edited() { var el = document.activeElement; return el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName); }
  function update() {
    var height = viewport ? viewport.height : window.innerHeight;
    if (!edited()) baseline = Math.max(window.innerHeight, height);
    root.style.setProperty('--visual-height', Math.round(height) + 'px');
    root.classList.toggle('keyboard-open', !!edited() && baseline - height > 140);
    if (document.body) document.body.classList.toggle('dialog-scroll-locked', !!document.querySelector('dialog[open]'));
  }
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', function () { baseline = window.innerHeight; setTimeout(update, 250); });
  document.addEventListener('focusin', update); document.addEventListener('focusout', function () { setTimeout(update, 100); });
  if (viewport) { viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update); }
  if (window.MutationObserver) new MutationObserver(update).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
  if (window.AbortSignal && !AbortSignal.timeout) AbortSignal.timeout = function (ms) { var controller = new AbortController(); setTimeout(function () { controller.abort(); }, ms); return controller.signal; };
  var scroll = window.scrollTo;
  window.scrollTo = function (x, y) { if (x && typeof x === 'object' && x.behavior === 'instant') return scroll.call(window, {top: x.top || 0, left: x.left || 0, behavior: 'auto'}); return scroll.call(window, x, y); };
  // IE11 exposes data-* on HTML elements inconsistently across embedded modes.
  if (!('dataset' in document.documentElement)) Object.defineProperty(Element.prototype, 'dataset', {get: function () { var data = {}, attributes = this.attributes; for (var i = 0; i < attributes.length; i++) if (attributes[i].name.indexOf('data-') === 0) data[attributes[i].name.slice(5).replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })] = attributes[i].value; return data; }});
  update();
})();
