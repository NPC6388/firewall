// FIREWALL: onboarding. A coach panel that walks through the first battle on each side (steps complete as you play),
// and one-time tips the first time each strategy tab is opened. Progress lives in XG.Settings.
var XG = globalThis.XG = globalThis.XG || {};

XG.Tutorial = (function () {
  var S = XG.Settings, $ = function (id) { return document.getElementById(id); };
  var run = null; // { side: 'fw' | 'lat', b, step, start: {id: [x, y]}, turn, shots, api }

  // Each step: text (HTML) and done(run, b, unit, mode) -> true when the player has done it.
  var STEPS = {
    fw: [
      { t: '<b>Welcome to the field.</b> Your squad is on the left. Click an operative (or press Tab), then click a <span class="cy">blue</span> tile to move there for 1 AP. <span class="warn">Amber</span> tiles are a dash and cost both AP.',
        done: function (r, b) { return moved(r, b); } },
      { t: '<b>Take cover.</b> Hover a tile: shield icons show cover on each side (filled = full, hollow = half). End your moves next to crates, racks or walls facing the enemy.',
        done: function (r, b) { return humans(b).some(function (u) { return u.alive && nextToCover(b, u); }); } },
      { t: '<b>Find the Lattice.</b> Hostiles hide in the fog until one of your units sees them. A <b>?</b> above one means it has not noticed you yet. Advance carefully, cover to cover.',
        done: function (r, b) { return b.units.some(function (u) { return u.alive && u.side !== b.human && !u.isStatic && b.visible[u.y * XG.Tac.W + u.x]; }); } },
      { t: '<b>Aim.</b> Click a hostile to aim at it. The panel on the right shows the hit chance and every modifier behind it: cover, angle, range.',
        done: function (r, b, u, mode) { return mode === 'shoot' || r.shots > 0; } },
      { t: '<b>Fire.</b> Click the target again, or press <b>1</b> or <b>Space</b>, to shoot. A unit with no shot can take <b>Overwatch</b> instead (<b>Y</b> puts everyone on overwatch).',
        done: function (r, b) { return r.shots > 0 || humans(b).some(function (u) { return u.overwatch; }); } },
      { t: '<b>End the turn.</b> When everyone has acted, press <b>End Turn</b> (Enter). The Lattice moves next.',
        done: function (r, b) { return b.turn > r.turn; } },
      { t: '<b>You have the basics.</b> Green odds mean the target is flanked (+25% crit). Hackers can stun drones, scientists heal and scan. Clear every hostile to win. Press <b>?</b> any time for the glossary.',
        done: null }
    ],
    lat: [
      { t: '<b>You are the Lattice.</b> Click one of your machines (or press Tab), then a <span class="cy">highlighted</span> tile to move. The objective is at the top: purge the defenders, or hold out until the turn limit.',
        done: function (r, b) { return moved(r, b); } },
      { t: '<b>Locate the enemy.</b> Earth\'s units hide in fog like anything else. Spread out and close in from more than one side: flanked targets are easier to hit.',
        done: function (r, b) { return b.units.some(function (u) { return u.alive && u.side !== b.human && b.visible[u.y * XG.Tac.W + u.x]; }); } },
      { t: '<b>Attack.</b> Click a target to aim; the right panel breaks down the odds. Click again or press <b>1</b> to fire. Harmonics\' <b>Data Spike</b> ignores cover and never misses.',
        done: function (r) { return r.shots > 0; } },
      { t: '<b>End the turn</b> (Enter). Earth answers on its turn.',
        done: function (r, b) { return b.turn > r.turn; } },
      { t: '<b>Proceed.</b> Use cover, gang up on one target at a time, and keep units on overwatch to punish movement. Press <b>?</b> for the glossary.',
        done: null }
    ]
  };
  function humans(b) { return b.units.filter(function (u) { return u.side === b.human && !u.isStatic; }); }
  function moved(r, b) { return humans(b).some(function (u) { var p = r.start[u.id]; return p && (p[0] !== u.x || p[1] !== u.y); }); }
  function nextToCover(b, u) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (o) { var t = XG.Tac.tile(b, u.x + o[0], u.y + o[1]); return t === XG.Tac.LOW || t === XG.Tac.HIGH; });
  }

  // ---------------------------------------------------------- battle coach
  function battleStart(g, b, api) {
    hide(); run = null;
    var side = b.human === 'enemy' ? 'lat' : 'fw', T = S.get('tutorial');
    if (!S.get('hints') || T[side]) return;
    run = { side: side, b: b, step: 0, start: {}, turn: b.turn, shots: 0, api: api };
    humans(b).forEach(function (u) { run.start[u.id] = [u.x, u.y]; });
    show();
  }
  function battleUpdate(b, unit, mode) {
    if (!run || run.b !== b) return;
    var st = STEPS[run.side][run.step];
    if (st.done && st.done(run, b, unit, mode)) {
      run.step++; run.turn = b.turn;
      if (XG.Audio) XG.Audio.play('select');
      show();
    }
    if (b.outcome) finish(run.step >= STEPS[run.side].length - 2);
  }
  function event(e, b) {
    if (!run || run.b !== b) return;
    if (e.t === 'shot') { var u = XG.Tac.unitById(b, e.from); if (u && u.side === b.human) run.shots++; }
  }
  // done = false (battle ended early): keep the tutorial for the next battle.
  function finish(done) {
    if (!run) return;
    if (done !== false) { var T = S.get('tutorial'); T[run.side] = true; S.set('tutorial', T); }
    run = null; hide();
  }
  function show() {
    if (!run) return;
    var list = STEPS[run.side], st = list[run.step], el = $('coach');
    if (!el) { el = document.createElement('div'); el.id = 'coach'; el.className = 'coach'; document.querySelector('.canvas-wrap').appendChild(el); }
    el.innerHTML = '<div class="coach-h"><span>TRAINING ' + (run.step + 1) + '/' + list.length + '</span><button id="coach-skip" title="Turn the tutorial off">Skip tutorial</button></div>' +
      '<div class="coach-t">' + st.t + '</div>' + (st.done ? '' : '<div class="coach-a"><button class="primary" id="coach-ok">Got it</button></div>');
    el.classList.remove('hidden'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    $('coach-skip').onclick = function () { finish(true); };
    if (!st.done) $('coach-ok').onclick = function () { finish(true); };
  }
  function hide() { var el = $('coach'); if (el) el.classList.add('hidden'); }

  // ---------------------------------------------------------- strategy tips
  var TIPS = {
    fw: {
      command: 'This is the <b>Command</b> view. The red <b>Convergence</b> bar is the clock: at 100% Earth falls. Press <b>Advance time</b> to run days until something happens, then deploy to missions as they appear on the right.',
      research: '<b>Research</b> unlocks gear, abilities and the story. Keep a project running at all times; an idle lab is wasted days.',
      engineering: '<b>Engineering</b>: click an empty slot to build. Labs need power, so put a generator down early. You can cancel a build for a full refund.',
      barracks: 'The <b>Barracks</b>: wounded operatives heal over days and sit out missions. Recruit more when you can afford it; losing a veteran hurts.',
      archive: 'The <b>Archive</b> keeps every story beat and your record. The field manual and glossary are here too, and behind the <b>?</b> button.'
    },
    lat: {
      network: 'Your <b>Network</b>. Magenta is your goal: Convergence. Blue is Earth\'s <b>Detection</b>: keep it low. Seed regions to raise infection, and breach systems when targets appear.',
      protocols: '<b>Protocols</b> are your research: new units, mods and abilities. Keep one compiling.',
      array: '<b>The Array</b> is your base. Foundries give bandwidth (more units), Choirs speed Convergence, Signal Masks slow Detection.',
      forces: '<b>Forces</b>: compile drones, Wardens and Harmonics here. You need bandwidth for each unit.',
      archive: 'The <b>Archive</b> keeps the story and your record. Press <b>?</b> any time for the glossary.'
    }
  };
  function stratTip(faction, tab) {
    var side = faction === 'lattice' ? 'lat' : 'fw', id = side + ':' + tab, text = TIPS[side][tab];
    if (!text || !S.get('hints') || S.tipSeen(id)) return '';
    return '<div class="tip"><span class="tip-i">TIP</span><span class="tip-t">' + text + '</span><button data-action="tip-ok" data-arg="' + id + '">Got it</button></div>';
  }

  return { battleStart: battleStart, battleUpdate: battleUpdate, event: event, finish: finish, stratTip: stratTip, STEPS: STEPS, TIPS: TIPS, state: function () { return run && { side: run.side, step: run.step, shots: run.shots }; } };
})();
