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
      { t: '<b>Take cover.</b> Hover a tile: shield icons show cover on each side (filled = full, half-filled = half). End your moves next to crates, racks or walls facing the enemy.',
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
  function steps() { return run.side === 'train' ? TRAIN_STEPS : STEPS[run.side]; }
  function battleStart(g, b, api) {
    hide(); run = null;
    if (b.training) { run = { side: 'train', b: b, step: 0, start: {}, turn: b.turn, shots: 0, api: api }; show(); return; }
    var side = b.human === 'enemy' ? 'lat' : 'fw', T = S.get('tutorial');
    if (!S.get('hints') || T[side]) return;
    run = { side: side, b: b, step: 0, start: {}, turn: b.turn, shots: 0, api: api };
    humans(b).forEach(function (u) { run.start[u.id] = [u.x, u.y]; });
    show();
  }
  function battleUpdate(b, unit, mode, aim) {
    if (!run || run.b !== b) return;
    var list = steps(), st = list[run.step];
    if (typeof st.done === 'function' && st.done(run, b, unit, mode, aim)) {
      run.step++; run.nudge = null; run.turn = b.turn; st = list[run.step];
      if (XG.Audio) XG.Audio.play('select');
    }
    if (run.side === 'train' && unit && unit.ap <= 0 && b.side === b.human && !b.outcome) XG.Tac.refillAP(b, unit);
    if (b.outcome) { if (run.side === 'train') { run = null; hide(); return; } finish(run.step >= list.length - 2); return; }
    show();
  }
  function event(e, b) {
    if (!run || run.b !== b) return;
    if (e.t === 'shot') { var u = XG.Tac.unitById(b, e.from); if (u && u.side === b.human) run.shots++; }
  }
  // done = false (battle ended early): keep the tutorial for the next battle.
  function finish(done) {
    if (!run) return;
    if (run.side === 'train') { var b = run.b; run = null; hide(); XG.Tac.abort(b); return; } // ends the range; TacUI shows the result
    if (done !== false) { var T = S.get('tutorial'); T[run.side] = true; S.set('tutorial', T); }
    run = null; hide();
  }
  function show() {
    if (!run) return;
    var list = steps(), st = list[run.step], el = $('coach'), train = run.side === 'train';
    var text = typeof st.t === 'function' ? st.t(run, run.b) : st.t, key = run.side + run.step;
    if (!el) { el = document.createElement('div'); el.id = 'coach'; el.className = 'coach'; document.querySelector('.canvas-wrap').appendChild(el); }
    var btn = st.done === 'next' ? '<button class="primary coach-go" id="coach-next">Next ▸' + (train ? ' <span class="dim">Space</span>' : '') + '</button>' : !st.done ? '<button class="primary" id="coach-ok">' + (st.finish || 'Got it') + (train ? ' <span class="dim">Space</span>' : '') + '</button>' : '';
    el.innerHTML = '<div class="coach-h"><span>' + (train ? 'COMBAT TRAINING ' : 'TRAINING ') + (run.step + 1) + '/' + list.length + '</span><button id="coach-skip" title="' + (train ? 'Leave the range' : 'Turn the tutorial off') + '">' +
      (train ? 'Leave' : 'Skip tutorial') + '</button></div><div class="coach-t">' + text + '</div>' + (run.nudge ? '<div class="coach-nudge warn">' + run.nudge + '</div>' : '') + (btn ? '<div class="coach-a">' + btn + '</div>' : '');
    el.classList.remove('hidden');
    if (el.getAttribute('data-step') !== key) { el.setAttribute('data-step', key); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    $('coach-skip').onclick = function () { finish(true); };
    if ($('coach-ok')) $('coach-ok').onclick = function () { finish(true); };
    if ($('coach-next')) $('coach-next').onclick = function () { run.step++; run.nudge = null; run.turn = run.b.turn; if (XG.Audio) XG.Audio.play('select'); battleUpdate(run.b, null, null, null); };
  }
  // Space in combat training presses the coach's button (Next / Finish) when there is one; otherwise it fires as usual.
  function advance() {
    if (!run || run.side !== 'train') return false;
    var btn = $('coach-next') || $('coach-ok');
    if (!btn || $('coach').classList.contains('hidden')) return false;
    btn.click(); return true;
  }
  function hide() { var el = $('coach'); if (el) el.classList.add('hidden'); }


  // ---------------------------------------------------------- combat training (title screen / help)
  // A guided range: Tac.createTraining builds the map (trooper at 3,8; target drone at 13,8 behind a crate on its
  // west side; gunner drone at 17,12; tall cover at 10,12-13; crates at 9,4 and 12,5 for the angle and flank spots). Step text can be a function so numbers stay live.
  function T(b) {
    var tr = b.units.filter(function (u) { return u.side === 'player' && u.alive; })[0];
    var tg = b.units.filter(function (u) { return u.dummy === 'passive'; })[0], gn = b.units.filter(function (u) { return u.dummy === 'gunner'; })[0];
    return { tr: tr, tg: tg, gn: gn, hi: tr && tg && tg.alive ? XG.Tac.hitInfo(b, tr, tg) : null, gi: tr && gn && gn.alive ? XG.Tac.hitInfo(b, gn, tr) : null };
  }
  // A marked tile never leaves you in the open: real cover must face the Gunner Drone.
  function covered(k) { return k.gi && k.gi.ok && k.gi.cover > 0; }
  // Among those, the best cover against the Gunner wins (the north-side lessons stay north of the target).
  function gunnerCover(k) { return k.gi.cover; }
  function partsLine(hi) {
    if (!hi || !hi.ok) return '<span class="dim">no line of fire from here</span>';
    return hi.parts.map(function (p, i) { return i ? (p[1] > 0 ? '+' : '−') + Math.abs(p[1]) + ' ' + p[0].toLowerCase() : p[0] + ' ' + p[1]; }).join(' ') + ' = <b>' + hi.chance + '%</b>';
  }
  function angleLine(hi) {
    if (!hi || !hi.ok) return '';
    if (!hi.cover) return 'The shot is <b class="good">flanked</b>: no cover counts, +25% crit.';
    return 'Angle <b>' + hi.coverAngle + '°</b> off the crate\'s facing: cover ' + (hi.cover < hi.coverBase ? '<b class="warn">−' + hi.cover + ' of ' + hi.coverBase + '</b> (fading)' : '<b>−' + hi.cover + '</b> (full value)') + '.';
  }
  var TRAIN_STEPS = [
    { t: function () { return '<b>Welcome to the range.</b> One trooper, two training drones. The <b>Target Drone</b> stands behind a crate; the <b>Gunner Drone</b> (bottom right) shoots back but can\'t hurt you much. You\'ll learn how cover works and where your hit chance comes from.'; }, done: 'next' },
    { t: function () { return '<b>Cover protects one side.</b> The crate is on the target\'s <b>west</b> side, so it only helps against shots from the west. Crates and barriers are <b>half cover (−20)</b>; walls and racks are <b>full cover (−40)</b>. Hover any floor tile to see its shield icons: filled = full, half-filled = half. A shield turns <span class="warn">yellow</span> when it only covers you at an angle, and fades out when no enemy you can see is on that side.'; }, done: 'next', show: 'cover' },
    { t: function () { return '<b>Aim.</b> Press <b>1</b> to arm Shoot, or click the Target Drone. The yellow ring is the aimed target; <b>Tab</b> cycles targets.'; },
      done: function (r, b, u, mode, aim) { var k = T(b); return mode === 'shoot' && k.tg && aim === k.tg.id; }, arm: true },
    { t: function (r, b) { var k = T(b); return '<b>Where the number comes from.</b> ' + partsLine(k.hi) + '.<br>' + angleLine(k.hi) + ' The same list is on the right under the target. Every modifier simply adds up, then the total is kept between 5% and 95%.'; }, done: 'next', show: 'angle', arm: true },
    { t: function (r, b) { var k = T(b); return '<b>Change the angle.</b> Press <b>Esc</b>, then move your trooper to the <b class="good">marked tile</b> to the north, behind a crate so the Gunner can\'t catch you in the open. The cones on the target show the rule: inside <span class="good">30°</span> the crate counts in full, up to <span class="warn">63°</span> it fades toward half, past that you\'re flanking.<br>Now: ' + angleLine(k.hi) + ' ' + (k.hi && k.hi.ok ? 'Hit chance ' + k.hi.chance + '%.' : ''); },
      done: function (r, b) { var k = T(b); return k.hi && k.hi.ok && k.hi.cover > 0 && k.hi.cover < k.hi.coverBase; }, show: 'angle',
      goal: { ok: function (k) { return k.tr.y < k.tg.y && k.hi && k.hi.ok && k.hi.cover > 0 && k.hi.cover <= k.hi.coverBase * .75 && covered(k); }, score: gunnerCover } }, // a fade you can see
    { t: function (r, b) { var k = T(b); return '<b>Flank it.</b> Keep circling north and east to the <b class="good">marked tile</b>: no cover sits between you and the target, and a crate still shields you from the Gunner. Never end a move in the open if you can help it. The move preview shows <span class="good">green</span> odds for flanked shots.<br>Now: ' + angleLine(k.hi) + ' ' + (k.hi && k.hi.ok ? partsLine(k.hi) : ''); },
      done: function (r, b) { var k = T(b); return k.hi && k.hi.ok && k.hi.cover === 0; }, show: 'angle',
      goal: { ok: function (k) { return k.tr.y < k.tg.y && k.hi && k.hi.ok && k.hi.cover === 0 && covered(k); }, score: gunnerCover } },
    { t: function (r, b) { var k = T(b); return '<b>Other modifiers.</b> Within 3 tiles: <b>+close range</b> (rifle +10). Past 10 tiles: <b>−3% per tile</b>. A <b>hunkered</b> target: −25. A target <b>marked</b> by a scientist\'s scan: +15. <b>Overwatch</b> shots: −15. Some targets have <b>defense</b> (drones −10).<br>Your shot now: ' + partsLine(k.hi) + (k.hi && k.hi.ok ? ' · distance ' + k.hi.d.toFixed(1) : ''); }, done: 'next' },
    { t: function () { return '<b>Take the shot.</b> Press <b>1</b> to aim at the Target Drone, then <b>1</b> again to fire.'; }, done: function (r) { return r.shots > 0; }, arm: true, fire: true },
    { t: function (r, b) { var k = T(b), g = k.gi; return '<b>Cover works for you too.</b> The Gunner Drone shoots on its turn. Its chance to hit you right now: ' + (g && g.ok ? '<b>' + g.chance + '%</b>' + (g.cover ? ' (your cover −' + g.cover + ')' : ' <span class="bad">(you\'re in the open)</span>') : '<span class="dim">it has no shot at you</span>') + '.<br>Move to the <b class="good">marked tile</b>: behind the <b>tall cover</b> near the bottom middle, on the side away from the gunner, so full cover (−40) faces it.'; },
      done: function (r, b) { var k = T(b); return k.gi && k.gi.ok && k.gi.cover >= 40; }, show: 'defense',
      goal: { ok: function (k) { return k.tr.x === 9 && k.gi && k.gi.ok && k.gi.cover >= 40; } } }, // behind the tall cover at 10,12-13
    { t: function (r, b) { var k = T(b), g = k.gi; return '<b>Good: full cover facing it.</b> Its chance on you is down to <b>' + (g && g.ok ? g.chance : '—') + '%</b>. End the turn (<b>Enter</b>) and watch it try.'; },
      done: function (r, b) { return b.turn > r.turn; }, show: 'defense', endTurn: true },
    { t: function () { return '<b>That\'s the whole rule.</b> Hit chance = aim − cover (by angle) − defense − hunker + close range + scan mark − overwatch − long range, kept between 5% and 95%. Move cover to cover, flank what you can\'t outshoot, and check the breakdown before you fire. Press <b>?</b> in any battle for the glossary.'; }, done: null, finish: 'Finish training' }
  ];
  var trainExit = null;
  function startTraining(exit) {
    trainExit = exit;
    var g = XG.State.newGame(4242), s = g.soldiers.filter(function (x) { return x.cls === 'trooper'; })[0];
    var b = XG.Tac.createTraining(g, [s]);
    XG.TacUI.startWith(g, b, function () { var T2 = S.get('tutorial'); T2.combat = true; S.set('tutorial', T2); if (trainExit) trainExit(); });
  }
  // The tile a movement lesson points at: the nearest reachable tile that passes the step's test (goal.score, if
  // given, breaks ties first). Falls back to the whole map if nothing passes within this turn's move. Cached per step and position.
  var goalCache = {};
  function goalTile(b, st, k) {
    var key = run.step + ':' + k.tr.x + ',' + k.tr.y + ':' + k.tr.ap;
    if (goalCache.key === key) return goalCache.tile;
    var Tc = XG.Tac, tr = k.tr, ox = tr.x, oy = tr.y, r = Tc.reach(b, tr, 99), lim = Tc.moveRange(tr), best = null, bestIn = null;
    for (var i = 0; i < r.d.length; i++) {
      if (r.d[i] <= 0) continue;
      tr.x = i % Tc.W; tr.y = (i - tr.x) / Tc.W;
      var kk = T(b);
      if (st.goal.ok(kk)) {
        var c = { x: tr.x, y: tr.y, d: r.d[i], s: st.goal.score ? st.goal.score(kk) : 0 };
        var better = function (o) { return !o || c.s > o.s || (c.s === o.s && c.d < o.d); };
        if (r.d[i] <= lim && better(bestIn)) bestIn = c;
        if (!best || c.d < best.d) best = c;
      }
    }
    tr.x = ox; tr.y = oy;
    goalCache = { key: key, tile: bestIn || best };
    return goalCache.tile;
  }
  // Combat training is guided: each step only allows what it teaches. kind: 'move' (x, y), 'arm' (ability id),
  // 'fire' (ability id, target), 'end' (end turn), or anything else (overwatch all, overclock), which is never allowed.
  // A refused input re-pops the coach with a one-line nudge. Outside training everything is allowed.
  function allow(kind, b, a1, a2) {
    if (!run || run.side !== 'train' || run.b !== b) return true;
    var st = TRAIN_STEPS[run.step], k = T(b), ok = false, why;
    var waiting = st.done === 'next' ? 'Press <b>Space</b> for the next lesson.' : !st.done ? 'Press <b>Space</b> to finish.' : 'Follow the step above.';
    if (kind === 'move' && st.goal && k.tr) {
      var g = goalTile(b, st, k), ox = k.tr.x, oy = k.tr.y;
      k.tr.x = a1; k.tr.y = a2; ok = st.goal.ok(T(b)); k.tr.x = ox; k.tr.y = oy;
      if (!ok && g && g.d > XG.Tac.moveRange(k.tr)) ok = true; // marker out of reach this move: any step toward it is fine
      why = 'Move to the <b>marked tile</b>.';
    } else if (kind === 'arm') { ok = !!st.arm && a1 === 'shoot'; why = st.goal ? 'Move to the <b>marked tile</b> first.' : waiting; }
    else if (kind === 'fire') { ok = !!st.fire && a1 === 'shoot' && a2 === k.tg; why = st.fire ? 'Aim at the <b>Target Drone</b> (<b>Tab</b> switches targets).' : waiting; }
    else if (kind === 'end') { ok = !!st.endTurn; why = st.goal ? 'Move to the <b>marked tile</b> first.' : waiting; }
    else why = 'Not in this lesson. ' + waiting;
    if (!ok) { run.nudge = why; if (XG.Audio) XG.Audio.play('click'); var el = $('coach'); if (el) el.setAttribute('data-step', ''); show(); }
    return ok;
  }
  // Pulsing tile marker plus a curved arrow from the trooper, like a coach's sketch on the map.
  function drawGoal(c, b, st, k, now, TS) {
    var g = goalTile(b, st, k);
    if (!g) return;
    var gx = g.x * TS + TS / 2, gy = g.y * TS + TS / 2, ax = k.tr.x * TS + TS / 2, ay = k.tr.y * TS + TS / 2;
    var pulse = XG.Gfx && XG.Gfx.REDUCED ? .75 : .55 + .35 * Math.sin(now / 180);
    c.fillStyle = 'rgba(125,255,155,' + (pulse * .22) + ')'; c.fillRect(g.x * TS + 2, g.y * TS + 2, TS - 4, TS - 4);
    c.strokeStyle = 'rgba(125,255,155,' + pulse + ')'; c.lineWidth = 2.5; c.strokeRect(g.x * TS + 2, g.y * TS + 2, TS - 4, TS - 4);
    var dx = gx - ax, dy = gy - ay, len = Math.hypot(dx, dy);
    if (len > TS * .8) {
      // bend the arrow sideways a little, stop it short of the tile, and put a head on it
      var mx = (ax + gx) / 2 - dy * .18, my = (ay + gy) / 2 + dx * .18, ex = gx - (gx - mx) / Math.hypot(gx - mx, gy - my) * TS * .45, ey = gy - (gy - my) / Math.hypot(gx - mx, gy - my) * TS * .45;
      var sx = ax + (mx - ax) / Math.hypot(mx - ax, my - ay) * TS * .45, sy = ay + (my - ay) / Math.hypot(mx - ax, my - ay) * TS * .45;
      c.strokeStyle = 'rgba(125,255,155,.85)'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
      var ang = Math.atan2(ey - my, ex - mx), hl = 11;
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - hl * Math.cos(ang - .45), ey - hl * Math.sin(ang - .45));
      c.moveTo(ex, ey); c.lineTo(ex - hl * Math.cos(ang + .45), ey - hl * Math.sin(ang + .45)); c.stroke();
    }
    var lab = 'MOVE HERE', ly = g.y === 0 ? gy + TS * .5 + 14 : gy - TS * .5 - 6;
    c.font = 'bold 11px "Share Tech Mono", monospace'; c.textAlign = 'center';
    var w = c.measureText(lab).width + 10; c.fillStyle = 'rgba(0,0,0,.8)'; c.fillRect(gx - w / 2, ly - 12, w, 16);
    c.fillStyle = '#7dff9b'; c.fillText(lab, gx, ly);
  }
  // Teaching overlays drawn on the battle canvas: the target's cover cones, or your cover against the gunner.
  function overlay(c, b, now) {
    if (!run || run.side !== 'train' || run.b !== b) return;
    var st = TRAIN_STEPS[run.step], k = T(b), TS = 40, cen = function (u) { return [u.x * TS + TS / 2, u.y * TS + TS / 2]; };
    if (!st.show || !k.tr) return;
    c.save();
    if ((st.show === 'cover' || st.show === 'angle') && k.tg && k.tg.alive) {
      var o = cen(k.tg), axis = Math.PI; // the crate is west of the target
      if (st.show === 'cover') {
        c.strokeStyle = 'rgba(255,209,102,' + (.5 + .4 * Math.sin(now / 200)) + ')'; c.lineWidth = 2; c.strokeRect(12 * TS + 2, 8 * TS + 2, TS - 4, TS - 4);
      }
      var cone = function (a0, a1, col) { c.fillStyle = col; c.beginPath(); c.moveTo(o[0], o[1]); c.arc(o[0], o[1], 6.5 * TS, axis + a0, axis + a1); c.closePath(); c.fill(); };
      var d30 = Math.PI / 6, d63 = Math.atan(2);
      cone(-d30, d30, 'rgba(125,255,155,.10)'); cone(d30, d63, 'rgba(255,209,102,.10)'); cone(-d63, -d30, 'rgba(255,209,102,.10)');
      c.fillStyle = 'rgba(125,255,155,.9)'; c.font = 'bold 11px "Share Tech Mono", monospace'; c.textAlign = 'center';
      c.fillText('full cover', o[0] - 4.2 * TS, o[1] + 4); c.fillStyle = 'rgba(255,209,102,.9)';
      c.fillText('fading', o[0] - 3.6 * TS, o[1] - 2.4 * TS); c.fillText('fading', o[0] - 3.6 * TS, o[1] + 2.6 * TS);
      c.fillStyle = 'rgba(255,107,133,.85)'; c.fillText('flanked', o[0] - 1.2 * TS, o[1] - 3.6 * TS); c.fillText('flanked', o[0] - 1.2 * TS, o[1] + 3.8 * TS);
      if (st.show === 'angle') { // the line of the shot
        var a = cen(k.tr);
        c.strokeStyle = k.hi && k.hi.ok ? (k.hi.cover === 0 ? '#7dff9b' : k.hi.cover < k.hi.coverBase ? '#ffd166' : '#4fd1ff') : '#7d8ea5';
        c.setLineDash([6, 6]); c.lineDashOffset = -now / 40; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(o[0], o[1]); c.stroke(); c.setLineDash([]);
        if (k.hi && k.hi.ok) { var mx = (a[0] + o[0]) / 2, my = (a[1] + o[1]) / 2, lab = k.hi.chance + '%' + (k.hi.cover ? ' · cover −' + k.hi.cover : ' · flanked');
          c.font = 'bold 12px "Share Tech Mono", monospace'; var w = c.measureText(lab).width + 10; c.fillStyle = 'rgba(0,0,0,.8)'; c.fillRect(mx - w / 2, my - 18, w, 16); c.fillStyle = c.strokeStyle; c.fillText(lab, mx, my - 6); }
      }
    }
    if (st.goal && k.tr.ap > 0 && b.side === b.human) drawGoal(c, b, st, k, now, TS);
    if (st.show === 'defense' && k.gn && k.gn.alive) {
      var g0 = cen(k.gn), t0 = cen(k.tr);
      c.strokeStyle = k.gi && k.gi.ok ? (k.gi.cover >= 40 ? '#4fd1ff' : '#ff6b85') : '#7d8ea5';
      c.setLineDash([6, 6]); c.lineDashOffset = now / 40; c.lineWidth = 1.5; c.beginPath(); c.moveTo(g0[0], g0[1]); c.lineTo(t0[0], t0[1]); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(79,209,255,' + (.5 + .4 * Math.sin(now / 200)) + ')'; c.lineWidth = 2; c.strokeRect(10 * TS + 2, 12 * TS + 2, TS - 4, TS * 2 - 4);
      if (k.gi && k.gi.ok) { var lab2 = 'gunner: ' + k.gi.chance + '% on you'; c.font = 'bold 12px "Share Tech Mono", monospace'; c.textAlign = 'center';
        var w2 = c.measureText(lab2).width + 10; c.fillStyle = 'rgba(0,0,0,.8)'; c.fillRect(t0[0] - w2 / 2, t0[1] + 24, w2, 16); c.fillStyle = c.strokeStyle; c.fillText(lab2, t0[0], t0[1] + 36); }
    }
    c.restore();
  }

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

  return { startTraining: startTraining, overlay: overlay, battleStart: battleStart, battleUpdate: battleUpdate, advance: advance, allow: allow, event: event, finish: finish, stratTip: stratTip, STEPS: STEPS,
    goal: function () { var st = run && run.side === 'train' && TRAIN_STEPS[run.step], k = st && st.goal && T(run.b); return k && k.tr ? goalTile(run.b, st, k) : null; }, TIPS: TIPS, state: function () { return run && { side: run.side, step: run.step, shots: run.shots }; } };
})();
