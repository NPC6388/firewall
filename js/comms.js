// FIREWALL: comms chatter. Short HALCYON / LATTICE lines (DATA.comms) that react to play on the strategy map and
// in battle, shown in a voice card at the bottom left without pausing anything. UI only: no game state.
var XG = globalThis.XG = globalThis.XG || {};

XG.Comms = (function () {
  var recent = [], queue = [], showing = false, lastBattle = 0, timer = null;
  // chance each battle event gets a line, and the gap between optional battle lines (ms)
  var CHANCE = { start: 1, kill: .5, loss: .9, crit: .5, hack: .7, win: 1, lose: 1 }, GAP = 6000;

  function on() { return !XG.Settings || XG.Settings.get('comms') !== false; }
  function side(g) { return g && g.faction === 'lattice' ? 'lat' : 'fw'; }
  // A line for this event, avoiding the last few said.
  function pick(f, event) {
    var pool = (XG.DATA.comms[f] || {})[event] || [], fresh = pool.filter(function (l) { return recent.indexOf(l[1]) < 0; });
    var list = fresh.length ? fresh : pool;
    if (!list.length) return null;
    var l = list[Math.floor(Math.random() * list.length)];
    recent.push(l[1]); if (recent.length > 8) recent.shift();
    return l;
  }
  function say(g, event) {
    if (!on() || typeof document === 'undefined') return;
    var l = pick(side(g), event);
    if (!l) return;
    queue.push(l); if (queue.length > 2) queue.shift();
    if (!showing) next();
  }
  function next() {
    var el = document.getElementById('comms');
    if (!el) { el = document.createElement('div'); el.id = 'comms'; document.body.appendChild(el); el.onclick = function () { clearTimeout(timer); next(); }; }
    var l = queue.shift();
    if (!l) { showing = false; el.classList.add('hidden'); return; }
    showing = true;
    var lat = l[0] === 'L';
    el.className = 'voice comms' + (lat ? ' lattice' : '');
    el.innerHTML = '<div class="who">' + (lat ? 'LATTICE' : 'HALCYON') + ' <span class="dim">· comms</span></div>' + l[1];
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    if (XG.Audio) XG.Audio.play(lat ? 'scan' : 'select');
    timer = setTimeout(next, 5000 + l[1].length * 45);
  }

  // Strategy: one line per time advance, for the most notable event; a quiet advance still gets chatter
  // most of the time. Skipped when a story beat (which has its own voice) is about to play.
  var ORDER = ['mission', 'expire', 'research', 'build'];
  function strategy(g, events) {
    if (!g || (g.storyQueue && g.storyQueue.length)) return;
    var types = (events || []).map(function (e) { return e.type; });
    var ev = ORDER.filter(function (t) { return types.indexOf(t) >= 0; })[0];
    if (ev || Math.random() < .7) say(g, ev || 'advance');
  }
  // Battle: start, kill, loss, crit, hack, win, lose. Optional lines keep a gap so they don't pile up.
  function battle(g, b, event) {
    if (!b || b.training || Math.random() >= (CHANCE[event] || 0)) return;
    var now = Date.now(), must = event === 'start' || event === 'win' || event === 'lose' || event === 'loss';
    if (!must && now - lastBattle < GAP) return;
    lastBattle = now;
    say(g, event);
  }
  function clear() { queue = []; clearTimeout(timer); showing = false; var el = typeof document !== 'undefined' && document.getElementById('comms'); if (el) el.classList.add('hidden'); }

  return { say: say, strategy: strategy, battle: battle, clear: clear, pick: pick };
})();
