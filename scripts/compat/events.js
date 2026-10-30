/* Event constructors must exist before third-party DOM polyfills initialize. */
(function () {
  if (typeof window.Event !== 'function') {
    var proto = Object.getPrototypeOf(document.createEvent('Event'));
    window.Event = function (name, args) { args = args || {}; var event = document.createEvent('Event'); event.initEvent(name, !!args.bubbles, !!args.cancelable); return event; };
    window.Event.prototype = proto;
  }
  if (typeof window.CustomEvent !== 'function') {
    window.CustomEvent = function (name, args) { args = args || {}; var event = document.createEvent('CustomEvent'); event.initCustomEvent(name, !!args.bubbles, !!args.cancelable, args.detail); return event; };
    window.CustomEvent.prototype = window.Event.prototype;
  }
})();
