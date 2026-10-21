// FIREWALL: player settings (audio, animation speed, palette, tutorial progress). One localStorage key, separate from saves.
var XG = globalThis.XG = globalThis.XG || {};

XG.Settings = (function () {
  var KEY = 'firewall-settings-v1';
  var DEFAULTS = {
    master: .8, music: .5, sfx: .8, muted: false,
    speed: 1, shake: true, palette: 'default', hints: true,
    tutorial: { fw: false, lat: false }, tips: {}
  };
  var cur = load(), listeners = [];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    var s = clone(DEFAULTS);
    try {
      var raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
      if (raw) { var o = JSON.parse(raw); Object.keys(o).forEach(function (k) { if (k in s) s[k] = o[k]; }); }
    } catch (e) { /* private mode or bad JSON: defaults */ }
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* storage blocked */ } }
  function get(k) { return cur[k]; }
  function set(k, v) { cur[k] = v; save(); listeners.forEach(function (f) { f(k, v); }); }
  function onChange(f) { listeners.push(f); }
  function all() { return cur; }
  // Tutorials and tips remember what has been shown.
  function tipSeen(id) { return !!cur.tips[id]; }
  function markTip(id) { cur.tips[id] = 1; save(); }
  function resetTutorial() { cur.tutorial = { fw: false, lat: false }; cur.tips = {}; save(); }
  // localStorage is per-origin, so clear() in tests wipes settings too; that's fine.
  return { KEY: KEY, DEFAULTS: DEFAULTS, get: get, set: set, all: all, onChange: onChange, tipSeen: tipSeen, markTip: markTip, resetTutorial: resetTutorial, reload: function () { cur = load(); } };
})();
