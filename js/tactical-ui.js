// FIREWALL: tactical screen. Canvas renderer, input, and the event-animation queue.
var XG = globalThis.XG = globalThis.XG || {};

XG.TacUI = (function () {
  var Tac = XG.Tac, D = XG.DATA, TS = 40, W = Tac.W, H = Tac.H;
  var $ = function (id) { return document.getElementById(id); };
  var st = null, cv, ctx, dpr = 1, bound = false;

  var DUR = { move: 85, shot: 260, dmg: 140, heal: 140, text: 110, death: 380, boom: 440, scan: 420, hack: 380, spawn: 280, pause: 1 };

  function start(g, mission, squad, onDone) { startWith(g, Tac.create(g, mission, squad), onDone); }
  // Runs any prepared battle (FIREWALL or Lattice controlled). b.human says which side the person plays.
  function startWith(g, b, onDone) {
    cv = $('tac-canvas'); ctx = cv.getContext('2d');
    st = {
      g: g, b: b, onDone: onDone, sel: null, mode: null, aim: null, hover: null,
      queue: [], cur: null, floaters: [], fx: [], parts: [], face: {}, faceDisp: {}, flash: {}, shake: null, lastNow: 0,
      displayPos: {}, displayHp: {}, dying: {}, hidden: {},
      reachCache: null, finished: false, lastLog: 0, dirty: true
    };
    $('tac-log').innerHTML = '';
    syncLog();
    st.sel = firstReady();
    XG.UI.show('screen-tactical');
    bindOnce();
    resize();
    if (b.side !== b.human) banner(lat() ? 'FIREWALL TURN' : 'LATTICE TURN', 'enemy');
    XG.Audio.scene(lat() ? 'battle-lat' : 'battle');
    if (XG.Tutorial) XG.Tutorial.battleStart(g, b, { hud: function () { hud(); } });
    hud();
    var loop = st.loop = {};
    requestAnimationFrame(function tick(now) { if (st && st.loop === loop) { frame(now); requestAnimationFrame(tick); } });
  }

  function bindOnce() {
    if (bound) return; bound = true;
    cv.addEventListener('mousemove', function (e) {
      if (!st) return;
      var t = tileFromEvent(e);
      if (!st.hover || t.x !== st.hover.x || t.y !== st.hover.y) { st.hover = t; hoverPanel(); }
    });
    cv.addEventListener('mouseleave', function () { if (st) { st.hover = null; hoverPanel(); } });
    cv.addEventListener('click', function (e) { click(tileFromEvent(e)); });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); cancel(); });
    window.addEventListener('resize', function () { if (st) resize(); });
    document.addEventListener('keydown', function (e) {
      if (!st || $('screen-tactical').classList.contains('hidden') || XG.UI.isModal()) return;
      if (e.key === 'Escape') cancel();
      else if (e.key === 'Tab') { e.preventDefault(); if (st.mode) cycleTarget(e.shiftKey ? -1 : 1); else cycle(); }
      else if (e.key === 'Enter') endTurn();
      else if (e.key === 'o' || e.key === 'O') overclock();
      else if (e.key === ' ') { e.preventDefault(); confirmArmed(); }
      else if (e.key === 'y' || e.key === 'Y') overwatchAll();
      else if (e.key === 'm' || e.key === 'M') XG.Settings.set('muted', !XG.Settings.get('muted'));
      else if (e.key === '?' || e.key === 'F1') { e.preventDefault(); XG.Help.open(); }
      else if (/^[1-9]$/.test(e.key)) { var u = selUnit(); if (u && u.abilities[+e.key - 1]) pickAbility(u.abilities[+e.key - 1]); }
    });
    $('tac-endturn').onclick = endTurn;
    $('tac-overclock').onclick = overclock;
    $('tac-owall').onclick = overwatchAll;
    // Esc closes the overwatch-all question (the battle key handler is paused while a modal is open)
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('owa-no') && XG.UI.isModal()) XG.UI.closeModal(); });
    $('tac-abort').onclick = function () {
      if (!canInput()) return;
      XG.UI.modal(lat() ? '<h1>Withdraw?</h1><p>Your units pull back into the network. The mission counts as lost.</p>' +
        '<div class="modal-actions"><button id="ab-no">Keep fighting</button><button class="danger" id="ab-yes">Withdraw</button></div>' :
        '<h1>Abort mission?</h1><p>The squad extracts. The mission counts as a failure: regional infection rises and Convergence +2%.' +
        (st.b.mission.kind !== 'purge' ? ' Story missions stay available for another attempt.' : '') + '</p>' +
        '<div class="modal-actions"><button id="ab-no">Stay and fight</button><button class="danger" id="ab-yes">Abort</button></div>');
      $('ab-no').onclick = XG.UI.closeModal;
      $('ab-yes').onclick = function () { XG.UI.closeModal(); Tac.abort(st.b); };
    };
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    cv.width = W * TS * dpr; cv.height = H * TS * dpr;
    var wrap = cv.parentElement, aw = wrap.clientWidth - 16;
    var ah = window.innerWidth <= 980 ? 1e9 : window.innerHeight - $('tac-top').offsetHeight - document.querySelector('.tac-bar').offsetHeight - 20;
    var sc = Math.min(aw / (W * TS), ah / (H * TS));
    cv.style.width = Math.floor(W * TS * sc) + 'px'; cv.style.height = Math.floor(H * TS * sc) + 'px';
  }
  function tileFromEvent(e) {
    var r = cv.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / r.width * W), y: Math.floor((e.clientY - r.top) / r.height * H) };
  }

  // ----------------------------------------------------------- helpers
  // HS(): the side the person controls ('player' = FIREWALL, 'enemy' = Lattice). lat(): playing the Lattice.
  function HS() { return st.b.human; }
  function lat() { return st.b.human === 'enemy'; }
  function selUnit() { var u = st.sel && Tac.unitById(st.b, st.sel); return u && u.alive && u.side === HS() ? u : null; }
  function squadUnits() { return st.b.units.filter(function (u) { return u.side === HS() && !u.isStatic && (u.alive || u.sid || u.deployed); }); }
  function firstReady() { var u = st.b.units.filter(function (x) { return x.alive && x.side === HS() && x.ap > 0; })[0]; return u ? u.id : null; }
  function canInput() { return st && !st.cur && !st.queue.length && st.b.side === st.b.human && !st.b.outcome; }
  function visibleUnit(u) { return u.side === HS() || st.b.visible[u.y * W + u.x]; }
  function unitAtVisible(x, y) {
    var u = Tac.unitAt(st.b, x, y);
    return u && visibleUnit(u) && !st.hidden[u.id] ? u : null;
  }
  function getReach(u) {
    if (!st.reachCache || st.reachCache.id !== u.id || st.reachCache.ap !== u.ap || st.reachCache.x !== u.x || st.reachCache.y !== u.y)
      st.reachCache = { id: u.id, ap: u.ap, x: u.x, y: u.y, r: Tac.reach(st.b, u, Tac.moveRange(u)) };
    return st.reachCache.r;
  }

  // ------------------------------------------------------------ input
  function click(t) {
    if (!canInput() || t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) return;
    var b = st.b, u = selUnit(), at = unitAtVisible(t.x, t.y), A = st.mode && D.abilities[st.mode];
    if (A) {
      if (A.target === 'enemy') {
        if (at && Tac.targets(b, u, st.mode).indexOf(at) >= 0) {
          if (st.aim === at.id) run(st.mode, at); else { st.aim = at.id; hoverPanel(); }
        } else cancel();
        return;
      }
      if (A.target === 'ally') {
        if (at && Tac.targets(b, u, st.mode).indexOf(at) >= 0) run(st.mode, at); else cancel();
        return;
      }
      if (A.target === 'tile') {
        if (Tac.tileOk(b, u, st.mode, t.x, t.y)) run(st.mode, t.x, t.y); else cancel();
        return;
      }
    }
    if (at && at.side === HS()) { select(at.id); return; }
    if (at && u && Tac.targets(b, u, 'shoot').indexOf(at) >= 0) { st.mode = 'shoot'; st.aim = at.id; hud(); return; }
    if (u && !at) {
      var r = getReach(u), d = r.d[t.y * W + t.x];
      if (d > 0) {
        var ev = Tac.act.move(b, u, t.x, t.y);
        if (ev) { enqueue(ev); hud(); }
      }
    }
  }
  function select(id) { if (id !== st.sel) XG.Audio.play('select'); st.sel = id; st.mode = null; st.aim = null; hud(); hoverPanel(); }
  function cancel() { if (st.mode) { st.mode = null; st.aim = null; hud(); hoverPanel(); } }
  function cycle() {
    var list = st.b.units.filter(function (u) { return u.alive && u.side === HS() && u.ap > 0; });
    if (!list.length) return;
    var i = list.map(function (u) { return u.id; }).indexOf(st.sel);
    select(list[(i + 1) % list.length].id);
  }
  // While an ability is armed, Tab / Shift+Tab steps through its valid targets instead of squadmates.
  // Enemies are ordered best odds first (same as the auto-aim), allies nearest first.
  function cycleTarget(dir) {
    var u = selUnit(); if (!canInput() || !u || !st.mode) return;
    var A = D.abilities[st.mode];
    if (A.target !== 'enemy' && A.target !== 'ally') return; // tile abilities: aim with the mouse
    var ts = Tac.targets(st.b, u, st.mode);
    if (!ts.length) return;
    ts.sort(A.target === 'enemy'
      ? function (a, c) { return Tac.hitInfo(st.b, u, c).chance - Tac.hitInfo(st.b, u, a).chance || a.id - c.id; }
      : function (a, c) { return Tac.dist(u.x, u.y, a.x, a.y) - Tac.dist(u.x, u.y, c.x, c.y) || a.id - c.id; });
    var i = ts.map(function (t) { return t.id; }).indexOf(st.aim);
    st.aim = ts[(i + dir + ts.length) % ts.length].id;
    hud(); hoverPanel();
  }

  function pickAbility(id) {
    var u = selUnit(); if (!canInput() || !u) return;
    var why = Tac.abilityBlock(st.b, u, id); if (why) return;
    var A = D.abilities[id];
    if (st.mode === id && confirmMode(u, id, A)) return;
    st.mode = id; st.aim = null;
    if (A.target === 'enemy') {
      var ts = Tac.targets(st.b, u, id).map(function (t) { return { t: t, c: Tac.hitInfo(st.b, u, t).chance }; }).sort(function (a, c) { return c.c - a.c; });
      if (ts.length) st.aim = ts[0].t.id;
    }
    if (A.target === 'ally' && id === 'shield' && Tac.targets(st.b, u, id).length === 1) { run(id, u); return; }
    hud(); hoverPanel();
  }
  // Second press of the same ability key/button fires it: at the aimed enemy, the hovered ally
  // (or the only one in reach), or the hovered tile. Returns false if there's nothing to fire at.
  function confirmMode(u, id, A) {
    var b = st.b, h = st.hover, ts;
    if (A.target === 'self') { run(id); return true; }
    if (A.target === 'enemy') {
      var t = st.aim && Tac.unitById(b, st.aim);
      if (t && Tac.targets(b, u, id).indexOf(t) >= 0) { run(id, t); return true; }
    } else if (A.target === 'ally') {
      ts = Tac.targets(b, u, id);
      var ta = st.aim && Tac.unitById(b, st.aim);
      if (ta && ts.indexOf(ta) >= 0) { run(id, ta); return true; }
      var ha = h && unitAtVisible(h.x, h.y);
      if (ha && ts.indexOf(ha) >= 0) { run(id, ha); return true; }
      if (ts.length === 1) { run(id, ts[0]); return true; }
    } else if (A.target === 'tile') {
      if (h && Tac.tileOk(b, u, id, h.x, h.y)) { run(id, h.x, h.y); return true; }
    }
    return false;
  }

  function run(id, a1, a2) {
    var u = selUnit(); if (!u) return;
    var ev = Tac.act[id](st.b, u, a1, a2);
    st.mode = null; st.aim = null;
    if (ev) enqueue(ev);
    hud();
  }
  // Space fires whatever ability is armed (same as pressing its key again).
  function confirmArmed() {
    var u = selUnit(); if (!canInput() || !u || !st.mode) return;
    confirmMode(u, st.mode, D.abilities[st.mode]);
  }
  // Overwatch all: every unit of yours with AP left that can take overwatch, after an "are you sure?".
  function overwatchAll() {
    if (!canInput()) return;
    var b = st.b, list = b.units.filter(function (u) { return u.alive && u.side === HS() && !u.isStatic && u.ap > 0 && !Tac.abilityBlock(b, u, 'overwatch'); });
    if (!list.length) { XG.UI.modal('<h1>Overwatch all</h1><p>No one can go on overwatch right now.</p><div class="modal-actions"><button class="primary" id="owa-no">OK</button></div>'); $('owa-no').onclick = XG.UI.closeModal; $('owa-no').focus(); return; }
    st.mode = null; st.aim = null; hud();
    XG.UI.modal('<h1>Overwatch all?</h1><p>Are you sure? <b>' + list.length + '</b> unit' + (list.length > 1 ? 's go' : ' goes') + ' on overwatch and end' + (list.length > 1 ? '' : 's') + ' the turn: ' +
      list.map(function (u) { return u.short || u.name; }).join(', ') + '.</p>' +
      '<div class="modal-actions"><button id="owa-no">Cancel (Esc)</button><button class="primary" id="owa-yes">Overwatch all (Space)</button></div>');
    $('owa-no').onclick = XG.UI.closeModal;
    $('owa-yes').onclick = function () {
      XG.UI.closeModal();
      list.forEach(function (u) { if (u.alive && u.ap > 0) { var ev = Tac.act.overwatch(st.b, u); if (ev) enqueue(ev); } });
      hud();
    };
    $('owa-yes').focus(); // Space / Enter press the focused button
  }
  function overclock() {
    var u = selUnit(); if (!canInput() || !u) return;
    var ev = Tac.act.overclock(st.b, u); if (ev) { enqueue(ev); hud(); }
  }
  function endTurn() {
    if (!canInput()) return;
    st.mode = null; st.aim = null;
    banner(lat() ? 'FIREWALL TURN' : 'LATTICE TURN', 'enemy');
    enqueue(Tac.endTurn(st.b));
    hud();
  }

  // ------------------------------------------------------- event queue
  function enqueue(evs) {
    evs.forEach(function (e) {
      if (e.t === 'move' && st.displayPos[e.id] === undefined) st.displayPos[e.id] = e.path[0];
      if ((e.t === 'dmg' || e.t === 'heal') && st.displayHp[e.id] === undefined) st.displayHp[e.id] = e.hpAfter + (e.t === 'dmg' ? e.amount : -e.amount);
      if (e.t === 'death') st.dying[e.id] = true;
      if (e.t === 'spawn') st.hidden[e.id] = true;
      st.queue.push(e);
    });
    st.reachCache = null;
  }
  function pathVisible(path) { return path.some(function (p) { return st.b.visible[p[1] * W + p[0]]; }); }

  function begin(e, now) {
    var sp = XG.Settings.get('speed') || 1, dur = (DUR[e.t] || 0) / sp, b = st.b, u = e.id && Tac.unitById(b, e.id);
    eventFx(e, now);
    if (e.t === 'move') {
      var shown = (u && u.side === HS()) || pathVisible(e.path);
      dur = shown ? DUR.move / sp * (e.path.length - 1) : 0;
      if (shown && u) stepSounds(u, e.path.length - 1, DUR.move / sp);
    } else if (e.t === 'shot' || e.t === 'hack') {
      var from = Tac.unitById(b, e.from), to = Tac.unitById(b, e.to);
      var seen = (from && from.side === HS()) || (to && to.side === HS()) || b.visible[e.fy * W + e.fx] || b.visible[e.ty * W + e.tx];
      if (!seen) dur = 0; else st.fx.push({ e: e, t0: now, dur: dur + 120 });
    } else if (e.t === 'dmg' || e.t === 'heal') {
      st.displayHp[e.id] = e.hpAfter;
      floater(e.x, e.y, (e.t === 'dmg' ? '-' : '+') + e.amount + (e.crit ? ' CRIT' : ''), e.t === 'heal' ? '#7dff9b' : e.crit ? '#ffd166' : '#ff6b85', now);
    } else if (e.t === 'text') floater(e.x, e.y, e.text, e.color, now);
    else if (e.t === 'boom' || e.t === 'scan') st.fx.push({ e: e, t0: now, dur: dur + 200 });
    else if (e.t === 'spawn') { delete st.hidden[e.id]; st.fx.push({ e: e, t0: now, dur: dur + 200 }); }
    else if (e.t === 'log') syncLog();
    else if (e.t === 'pause') dur = e.ms / sp;
    if (dur > 0) st.cur = { e: e, t0: now, end: now + dur };
    else finish(e);
  }
  function stepSounds(u, n, gap) {
    var hover = u.kind === 'drone' || u.kind === 'sentinel' || u.kind === 'harmonic';
    for (var i = 0; i < n; i++) setTimeout(function () { XG.Audio.play('step', { machine: u.machine, hover: hover }); }, i * gap);
  }
  function finish(e) {
    if (e.t === 'move') st.displayPos[e.id] = e.path[e.path.length - 1];
    if (e.t === 'death') delete st.dying[e.id];
    st.dirty = true;
  }
  function floater(x, y, text, color, now) {
    var stack = st.floaters.filter(function (f) { return f.x === x && f.y === y && now - f.t0 < 400; }).length;
    st.floaters.push({ x: x, y: y, text: text, color: color, t0: now + stack * 160 });
  }

  function pump(now) {
    if (st.cur) { if (now < st.cur.end) return; finish(st.cur.e); st.cur = null; }
    while (!st.cur && st.queue.length) begin(st.queue.shift(), now);
    if (st.cur || st.queue.length) return;
    st.displayPos = {}; st.displayHp = {};
    var b = st.b;
    if (b.outcome) { if (!st.finished) finishBattle(); return; }
    if (b.side !== b.human) {
      var ev = Tac.aiStep(b);
      if (ev.some(function (x) { return x.t !== 'log'; })) ev.push({ t: 'pause', ms: 160 });
      enqueue(ev);
      if (b.side === b.human && !b.outcome) {
        banner('YOUR TURN', 'player');
        if (!selUnit() || selUnit().ap <= 0) st.sel = firstReady();
        hud();
      }
      return;
    }
    if (st.dirty) {
      st.dirty = false;
      var u = selUnit();
      if (!u || u.ap <= 0) { var nx = firstReady(); if (nx && nx !== st.sel) st.sel = nx; }
      hud(); hoverPanel();
    }
  }

  function finishBattle() {
    st.finished = true;
    syncLog(); hud();
    var b = st.b, o = b.outcome;
    var won = lat() ? XG.Lat.latticeWon(b.mission.lkind, o) : o === 'win';
    XG.Audio.play(won ? 'victory' : 'defeat');
    setTimeout(function () {
      var head = lat()
        ? (XG.Lat.latticeWon(b.mission.lkind, o) ? '<h1 class="good">' + (b.mission.lkind === 'breach' ? 'SYSTEM BREACHED' : b.mission.lkind === 'strike' ? 'SAFEHOUSE HARMONIZED' : b.mission.lkind === 'uplink' ? 'UPLINK HOLDS' : 'CELL HOLDS') + '</h1>'
          : o === 'abort' ? '<h1 class="warn">WITHDRAWN</h1>' : '<h1 class="bad">FORCES LOST</h1>')
        : o === 'win' ? '<h1 class="good">OBJECTIVE COMPLETE</h1>' : o === 'abort' ? '<h1 class="warn">EXTRACTION</h1>' : '<h1 class="bad">SQUAD LOST</h1>';
      XG.UI.modal(head + '<p>' + b.mission.name + ' · turn ' + b.turn + '</p><div class="modal-actions"><button class="primary" id="tac-done">Debrief ▸</button></div>');
      $('tac-done').onclick = function () { XG.UI.closeModal(); var cb = st.onDone, res = Tac.result(b); st = null; cb(res); };
    }, 650);
  }

  var bannerEl = null;
  function banner(text, cls) {
    var el = $('tac-top').querySelector('.turn-banner');
    if (el) { el.textContent = text; el.className = 'turn-banner ' + cls; }
    var mine = cls === 'player';
    XG.Audio.play(mine ? 'turn-player' : 'turn-enemy');
    bannerEl = { text: text, cls: cls, t0: performance.now(), color: lat() ? (mine ? '#ff3df2' : '#4fd1ff') : (mine ? '#4fd1ff' : '#ff2a55') };
  }

  // -------------------------------------------------------------- HUD
  function hud() {
    if (!st) return;
    var b = st.b, u = selUnit();
    var obj = lat()
      ? { raid: 'Wipe the squad or hold until turn ' + b.turnLimit + ' ends', strike: 'Destroy the FIREWALL squad', breach: 'Purge the security software', uplink: 'Keep the Uplink Core alive' }[b.mission.lkind]
      : { purge: 'Eliminate all hostiles', relay: 'Destroy the Relay and all hostiles', uplink: 'Destroy the Uplink Core or Sever it (' + b.sever + '/3)' }[b.mission.kind];
    var left = b.units.filter(function (x) { return x.alive && x.side !== HS() && visibleUnit(x); }).length;
    var mine = b.side === b.human;
    XG.Audio.intensity(left ? 1 : .15);
    if (XG.Tutorial) XG.Tutorial.battleUpdate(b, u, st.mode);
    $('tac-top').innerHTML = '<b>' + b.mission.name + '</b><span class="dim">' + b.mission.city + '</span><span class="obj">◎ ' + obj + '</span>' +
      '<span class="dim">Turn ' + b.turn + (b.turnLimit ? '/' + b.turnLimit : '') + ' · ' + left + ' hostile(s) in sight</span>' +
      '<span class="turn-banner ' + (mine ? 'player' : 'enemy') + '">' + (b.outcome ? 'BATTLE OVER' : mine ? 'YOUR TURN' : lat() ? 'FIREWALL TURN' : 'LATTICE TURN') + '</span>';

    $('tac-squad').innerHTML = squadUnits().map(function (x) {
      var pips = '';
      for (var i = 0; i < x.maxHp; i++) pips += '<i class="' + (i < x.hp ? '' : 'e') + '"></i>';
      for (var j = 0; j < x.shield; j++) pips += '<i class="s"></i>';
      var cls = !x.alive ? 'dead' : x.ap <= 0 ? 'spent' : '';
      var tag = !x.alive ? (lat() ? 'LOST' : 'KIA') : x.override ? '<span class="good">OVERRIDE ' + x.override + '</span>' : (x.overwatch ? 'OW · ' : '') + (x.hunker ? 'HNK · ' : '') + x.ap + ' AP';
      return '<div class="sq ' + cls + (x.id === st.sel ? ' on' : '') + '" data-unit="' + x.id + '"><canvas class="sq-ico" data-ico="' + x.id + '"></canvas><div class="n">' + (x.short || x.name) + '</div>' +
        '<div class="dim">' + tag + '</div><div class="pips">' + pips + '</div></div>';
    }).join('');
    $('tac-squad').querySelectorAll('[data-ico]').forEach(function (cv) { XG.Gfx.icon(cv, Tac.unitById(st.b, +cv.getAttribute('data-ico'))); });
    $('tac-squad').querySelectorAll('[data-unit]').forEach(function (el) {
      el.onclick = function () { var x = Tac.unitById(st.b, +el.getAttribute('data-unit')); if (x && x.alive && canInput()) select(x.id); };
    });

    var ab = '';
    if (u) u.abilities.forEach(function (id, i) {
      var A = D.abilities[id], why = Tac.abilityBlock(b, u, id), extra = '';
      if (A.charges) extra = ' (' + (u.charges[id] || 0) + ')';
      var name = id === 'grenade' && b.emp ? 'EMP Grenade' : A.name;
      ab += '<button data-ab="' + id + '" class="' + (st.mode === id ? 'on' : '') + '"' + (why || !canInput() ? ' disabled' : '') + ' title="' + A.desc + (why ? ' — ' + why : '') + '"><span class="key">' + (i + 1) + '</span>' + name + extra + '</button>';
    });
    if (st.mode) ab += '<span class="dim">' + modeHint() + '</span>';
    $('tac-abilities').innerHTML = ab;
    $('tac-abilities').querySelectorAll('[data-ab]').forEach(function (el) { el.onclick = function () { pickAbility(el.getAttribute('data-ab')); }; });

    var oc = $('tac-overclock');
    oc.classList.toggle('hidden', lat() || !(b.overclock > 0 || XG.Strat.has(st.g, 'halcyon')));
    oc.textContent = 'Overclock (' + b.overclock + ')';
    oc.disabled = !canInput() || !u || !u.sid || b.overclock <= 0 || u.overclocked;
    $('tac-endturn').disabled = !canInput();
    $('tac-owall').disabled = !canInput();
    $('tac-abort').disabled = !canInput();
    infoPanel(u);
  }
  function modeHint() {
    var A = D.abilities[st.mode];
    var u = selUnit(), k = u ? u.abilities.indexOf(st.mode) + 1 : 0;
    if (A.target === 'self') return 'Press ' + k + ' again or Space to confirm. Esc cancels.';
    if (A.target === 'enemy') return 'Tab cycles targets. Click the target again, or press ' + k + ' or Space, to fire. Esc cancels.';
    if (A.target === 'ally') return 'Click an ally, or Tab to one and press ' + k + ' or Space. Esc cancels.';
    return 'Click a tile, or hover one and press ' + k + ' or Space (range ' + A.range + '). Esc cancels.';
  }
  function infoPanel(u) {
    if (!u) { $('tac-info').innerHTML = '<span class="dim">' + (st.b.side !== st.b.human ? (lat() ? 'FIREWALL is moving…' : 'The Lattice is moving…') : 'No unit selected.') + '</span>'; return; }
    var st2 = [];
    if (u.overwatch) st2.push('Overwatch'); if (u.hunker) st2.push('Hunkered'); if (u.shield) st2.push('Aegis ' + u.shield);
    if (u.override) st2.push('<span class="good">Override: ' + u.override + ' turn(s) left</span>');
    var cds = Object.keys(u.cooldowns).filter(function (k) { return u.cooldowns[k] > 0; }).map(function (k) { return D.abilities[k] ? D.abilities[k].name + ' ' + u.cooldowns[k] : ''; });
    $('tac-info').innerHTML = '<h3 style="color:' + u.color + '">' + (u.deployed ? u.short : u.name) + '</h3>' +
      ((D.classes[u.kind] || u.origSide || u.short) ? '<div class="dim">' + (u.rank ? u.rank + ' ' : '') + (D.classes[u.kind] ? D.classes[u.kind].name : D.enemies[u.kind].name + (u.origSide ? ' (hijacked)' : '')) + '</div>' : '') +
      '<div>HP ' + u.hp + '/' + u.maxHp + (u.armor ? ' · armor ' + u.armor : '') + ' · AP ' + u.ap + '</div>' +
      '<div>Aim ' + u.aim + ' · move ' + u.mobility + ' · dmg ' + u.dmg[0] + '–' + u.dmg[1] + (u.hackSkill ? ' · hack ' + u.hackSkill : '') + '</div>' +
      (u.abilities.indexOf('grenade') >= 0 || u.abilities.indexOf('medkit') >= 0 ? '<div class="dim">' + (u.abilities.indexOf('grenade') >= 0 ? 'Grenades ' + u.charges.grenade + ' ' : '') + (u.abilities.indexOf('medkit') >= 0 ? 'Medkits ' + u.charges.medkit : '') + '</div>' : '') +
      (cds.length ? '<div class="dim">Cooldown: ' + cds.join(', ') + '</div>' : '') +
      (st2.length ? '<div class="violet">' + st2.join(' · ') + '</div>' : '');
  }
  function coverLabel(hi) {
    if (!hi.cover) return '<span class="warn">FLANKED / exposed</span>';
    var kind = hi.coverBase >= 40 ? 'full cover' : 'half cover';
    return hi.cover < hi.coverBase ? kind + ' at ' + hi.coverAngle + '° (−' + hi.cover + ' of ' + hi.coverBase + ')' : kind + ' (−' + hi.cover + ')';
  }
  // The modifiers behind a hit chance, one per line.
  function breakdown(hi) {
    if (!hi.parts) return '';
    return '<table class="odds">' + hi.parts.map(function (p, i) {
      return '<tr><td>' + p[0] + '</td><td class="' + (i === 0 ? '' : p[1] > 0 ? 'good' : 'bad') + '">' + (i === 0 ? '' : p[1] > 0 ? '+' : '') + p[1] + '</td></tr>';
    }).join('') + '<tr class="tot"><td>Hit chance</td><td>' + hi.chance + '%</td></tr>' +
      (hi.flankCrit ? '<tr><td colspan="2" class="good">Flanked: +25 crit</td></tr>' : '') + '</table>';
  }
  function hoverPanel() {
    if (!st) return;
    var b = st.b, h = st.hover, u = selUnit(), html = '';
    var focus = st.aim ? Tac.unitById(b, st.aim) : h ? unitAtVisible(h.x, h.y) : null;
    if (focus && focus.alive) {
      html = '<b style="color:' + focus.color + '">' + focus.name + '</b><div>HP ' + focus.hp + '/' + focus.maxHp + (focus.armor ? ' · armor ' + focus.armor : '') + (focus.shield ? ' · shield ' + focus.shield : '') + '</div>';
      if (focus.side !== b.human) {
        var E = D.enemies[focus.kind] || D.classes[focus.kind] || D.software[focus.kind];
        html += (focus.rank ? '<div class="dim">' + focus.rank + ' ' + E.name + '</div>' : '') + '<div class="dim">' + E.blurb + '</div>';
        if (focus.stunned) html += '<div class="good">Stunned (' + focus.stunned + ')</div>';
        if (focus.marked) html += '<div class="good">Marked by scan (+15 aim)</div>';
        if (focus.side === 'enemy' && !focus.alerted) html += '<div class="dim">Unaware of the squad.</div>';
        if (u) {
          var hi = Tac.hitInfo(b, u, focus);
          html += hi.ok ? '<div>' + (u.short || u.name) + ': <b>' + hi.chance + '%</b> to hit · ' + hi.crit + '% crit · ' + coverLabel(hi) + ' · ' + hi.d.toFixed(1) + ' tiles</div>' + breakdown(hi)
            : '<div class="dim">No line of fire from ' + (u.short || u.name) + '.</div>';
          if (u.hackSkill && focus.hackDef !== null && focus.hackDef !== undefined && !focus.isStatic)
            html += '<div class="good">Hack chance ' + Math.max(10, Math.min(90, u.hackSkill - focus.hackDef)) + '%' + (b.grammar ? ' (override)' : ' (stun)') + '</div>';
          if (focus.kind === 'core' && u.hackSkill) html += '<div class="good">Sever chance ' + Math.min(90, u.hackSkill + 10) + '% when adjacent</div>';
        }
      }
    } else if (h && h.x >= 0 && h.x < W && h.y >= 0 && h.y < H) {
      var t = Tac.tile(b, h.x, h.y);
      html = '<b>' + ['Floor', 'Wall', 'Low cover', 'High cover'][t] + '</b>' + (b.visible[h.y * W + h.x] ? '' : ' <span class="dim">(not in sight)</span>');
      if (t === 0) {
        var sides = [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']].map(function (o) {
          var c = Tac.tile(b, h.x + o[0], h.y + o[1]); return c === 1 || c === 3 ? o[2] + ' full' : c === 2 ? o[2] + ' half' : null;
        }).filter(Boolean);
        html += '<div class="dim">Cover here: ' + (sides.length ? sides.join(', ') : 'none') + '</div>';
        if (u && !st.mode && canInput() && getReach(u).d[h.y * W + h.x] > 0) {
          var o = moveOdds(u, h.x, h.y);
          if (o.list.length) html += '<div>' + (o.dash ? '<span class="warn">' + o.why + ': no shot after this move</span><br>' : '') + 'Odds from here:' +
            o.list.map(function (it) {
              return '<br>· ' + it.e.name + ': ' + (it.hi.ok ? '<b>' + it.hi.chance + '%</b> (' + coverLabel(it.hi) + ')' : '<span class="dim">no line of fire</span>');
            }).join('') + '</div>';
        }
      }
    } else html = '<span class="dim">Hover a tile or hostile for details.</span>';
    $('tac-hover').innerHTML = html;
  }
  function syncLog() {
    if (!st) return;
    var el = $('tac-log'), b = st.b;
    for (; st.lastLog < b.log.length; st.lastLog++) {
      var l = b.log[st.lastLog], d = document.createElement('div');
      d.className = l.cls; d.textContent = l.msg; el.appendChild(d);
    }
    el.scrollTop = el.scrollHeight;
  }

  // ------------------------------------------------------------ render
  function frame(now) {
    pump(now);
    if (st) draw(now);
  }

  function center(x, y) { return [x * TS + TS / 2, y * TS + TS / 2]; }
  function unitPos(u, now) {
    if (st.cur && st.cur.e.t === 'move' && st.cur.e.id === u.id) {
      var p = st.cur.e.path, k = Math.min(1, (now - st.cur.t0) / (st.cur.end - st.cur.t0)) * (p.length - 1);
      var i = Math.min(p.length - 2, Math.floor(k)), f = k - i;
      faceTo(u.id, Math.atan2(p[i + 1][1] - p[i][1], p[i + 1][0] - p[i][0]));
      return [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f];
    }
    var d = st.displayPos[u.id];
    return d ? [d[0], d[1]] : [u.x, u.y];
  }

  function draw(now) {
    var b = st.b, G = XG.Gfx;
    var dt = Math.min(50, now - (st.lastNow || now)); st.lastNow = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070d16'; ctx.fillRect(0, 0, W * TS, H * TS);
    var sh = shakeOffset(now); ctx.translate(sh[0], sh[1]);
    ctx.drawImage(G.terrain(b, dpr).canvas, 0, 0, W * TS, H * TS);
    G.ambient(ctx, b, now);
    // light pools under visible units
    var pools = [];
    b.units.forEach(function (x) {
      if (!x.alive || st.hidden[x.id]) return;
      var p = unitPos(x, now);
      if (x.side !== HS() && !b.visible[Math.round(p[1]) * W + Math.round(p[0])]) return;
      pools.push({ x: p[0] * TS + TS / 2, y: p[1] * TS + TS / 2, r: x.isStatic ? 72 : 50, rgb: G.rgbOf(x.color), a: x.isStatic ? .22 : .12 });
    });
    G.lights(ctx, pools);
    // active scans
    b.scans.forEach(function (s) {
      var c = center(s.x, s.y);
      ctx.strokeStyle = 'rgba(255,209,102,.35)'; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -now / 60; ctx.beginPath(); ctx.arc(c[0], c[1], s.r * TS, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    });
    G.fog(ctx, b);
    G.motes(ctx, b, now);

    var u = selUnit(), idle = canInput();
    // movement range + path preview
    if (u && idle && !st.mode && u.ap > 0) {
      var r = getReach(u);
      for (var i = 0; i < r.d.length; i++) {
        if (r.d[i] <= 0) continue;
        ctx.fillStyle = r.d[i] <= u.mobility && u.ap >= 1 ? 'rgba(79,209,255,.14)' : 'rgba(255,209,102,.06)';
        ctx.fillRect((i % W) * TS + 1, Math.floor(i / W) * TS + 1, TS - 2, TS - 2);
      }
      var h = st.hover;
      if (h && h.x >= 0 && h.x < W && h.y >= 0 && h.y < H && r.d[h.y * W + h.x] > 0) {
        var p = Tac.pathTo(r, h.x, h.y), dash = p.length > u.mobility;
        ctx.strokeStyle = dash ? '#ffd166' : '#4fd1ff'; ctx.lineWidth = 2; ctx.beginPath();
        var c0 = center(u.x, u.y); ctx.moveTo(c0[0], c0[1]);
        p.forEach(function (q) { var c = center(q[0], q[1]); ctx.lineTo(c[0], c[1]); }); ctx.stroke(); ctx.lineWidth = 1;
        drawCoverShields(h.x, h.y);
        drawMoveOdds(u, h.x, h.y);
      }
    }
    // ability target previews
    if (u && st.mode && idle) drawModePreview(u, now);

    // units
    b.units.forEach(function (x) {
      if (st.hidden[x.id]) return;
      if (!x.alive && !st.dying[x.id] && !(st.cur && st.cur.e.t === 'death' && st.cur.e.id === x.id)) return;
      var pos = unitPos(x, now);
      var moving = st.cur && st.cur.e.t === 'move' && st.cur.e.id === x.id;
      var seen = x.side === HS() || b.visible[Math.round(pos[1]) * W + Math.round(pos[0])] || (moving && pathVisible(st.cur.e.path));
      if (!seen) return;
      var alpha = 1;
      if (st.cur && st.cur.e.t === 'death' && st.cur.e.id === x.id) alpha = 1 - (now - st.cur.t0) / (st.cur.end - st.cur.t0);
      drawUnit(x, pos, alpha, now);
    });

    // fx and particles
    st.fx = st.fx.filter(function (f) { return now - f.t0 < f.dur; });
    st.fx.forEach(function (f) { drawFx(f, now); });
    st.parts = G.particles(ctx, st.parts, now, dt);
    // floaters: pop in, drift up, fade
    st.floaters = st.floaters.filter(function (f) { return now - f.t0 < 1100; });
    ctx.textAlign = 'center';
    st.floaters.forEach(function (f) {
      var k = (now - f.t0) / 1100; if (k < 0) return;
      var c = center(f.x, f.y), big = /CRIT/.test(f.text), pop = k < .12 ? .6 + k / .12 * .6 : k < .2 ? 1.2 - (k - .12) / .08 * .2 : 1;
      ctx.save(); ctx.translate(c[0], c[1] - 24 - k * 28); ctx.scale(pop, pop);
      ctx.font = 'bold ' + (big ? 17 : 13) + 'px "Share Tech Mono", monospace';
      ctx.globalAlpha = 1 - k * k; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0); ctx.restore();
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.vignette(ctx, W * TS, H * TS);
    if (bannerEl && now - bannerEl.t0 < 1300) G.banner(ctx, bannerEl.text, bannerEl.color, (now - bannerEl.t0) / 1300, W * TS, H * TS, now);
  }
  function shake(mag, now) { if (!XG.Gfx.REDUCED && XG.Settings.get('shake')) st.shake = { t0: now, mag: Math.max(mag, st.shake && now - st.shake.t0 < 300 ? st.shake.mag : 0) }; }
  function shakeOffset(now) {
    if (!st.shake) return [0, 0];
    var k = (now - st.shake.t0) / 380; if (k >= 1) { st.shake = null; return [0, 0]; }
    var m = st.shake.mag * (1 - k) * (1 - k);
    return [Math.sin(now / 17) * m, Math.cos(now / 23) * m];
  }

  // Hit odds against every known hostile if the unit stood on (x, y). Cached per tile/state.
  function moveOdds(u, x, y) {
    var b = st.b, key = [u.id, u.ap, x, y, b.turn, b.log.length].join(',');
    if (st.oddsCache && st.oddsCache.key === key) return st.oddsCache;
    var r = getReach(u), dash = r.d[y * W + x] > u.mobility || u.ap < 2;
    var ox = u.x, oy = u.y, list = [];
    u.x = x; u.y = y;
    b.units.forEach(function (e) {
      if (!e.alive || e.side === HS() || st.hidden[e.id] || !b.visible[e.y * W + e.x]) return;
      list.push({ e: e, hi: Tac.hitInfo(b, u, e) });
    });
    u.x = ox; u.y = oy;
    var best = list.reduce(function (m, o) { return o.hi.ok && o.hi.chance > m ? o.hi.chance : m; }, 0);
    st.oddsCache = { key: key, list: list, dash: dash, best: best, why: u.ap < 2 ? 'last AP' : 'DASH' };
    return st.oddsCache;
  }
  function drawMoveOdds(u, x, y) {
    var o = moveOdds(u, x, y);
    if (!o.list.length) return;
    ctx.textAlign = 'center';
    o.list.forEach(function (it) {
      var c = center(it.e.x, it.e.y), txt = it.hi.ok ? it.hi.chance + '%' : '–';
      ctx.font = 'bold 12px "Share Tech Mono", monospace';
      var w = ctx.measureText(txt).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(c[0] - w / 2, c[1] - 38, w, 15);
      ctx.fillStyle = !it.hi.ok ? '#7d8ea5' : o.dash ? 'rgba(255,209,102,.5)' : it.hi.cover === 0 ? XG.Gfx.pal().flank : '#ffd166';
      ctx.fillText(txt, c[0], c[1] - 26);
      if (it.hi.ok && !o.dash) {
        var s = center(x, y);
        ctx.strokeStyle = 'rgba(255,209,102,.18)'; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.setLineDash([]);
      }
    });
    // summary tag under the cursor tile
    var cc = center(x, y), tag = o.dash ? o.why + ' · no shot' : o.best ? 'best ' + o.best + '%' : 'no shot';
    ctx.font = 'bold 11px "Share Tech Mono", monospace';
    var tw = ctx.measureText(tag).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(cc[0] - tw / 2, cc[1] + 21, tw, 14);
    ctx.fillStyle = o.dash ? '#ffd166' : o.best ? '#7dff9b' : '#7d8ea5';
    ctx.fillText(tag, cc[0], cc[1] + 32);
  }

  function drawCoverShields(x, y) {
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (o) {
      var t = Tac.tile(st.b, x + o[0], y + o[1]);
      if (t === 0) return;
      var full = t === Tac.WALL || t === Tac.HIGH, c = center(x, y), sx = c[0] + o[0] * 14, sy = c[1] + o[1] * 14;
      ctx.beginPath(); ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy - 5); ctx.lineTo(sx + 5, sy); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 5, sy); ctx.closePath();
      ctx.fillStyle = full ? '#4fd1ff' : 'rgba(79,209,255,.15)'; ctx.strokeStyle = '#4fd1ff'; ctx.fill(); ctx.stroke();
    });
  }

  function drawModePreview(u, now) {
    var b = st.b, A = D.abilities[st.mode], pulse = .5 + .5 * Math.sin(now / 180);
    if (A.target === 'self') { // armed, waiting for the second press / Space
      var cs = center(u.x, u.y);
      ctx.strokeStyle = 'rgba(255,209,102,' + (.45 + pulse * .45) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cs[0], cs[1], 24 + pulse * 3, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      ctx.font = 'bold 11px "Share Tech Mono", monospace'; ctx.textAlign = 'center';
      var lab = A.name + ' · Space', lw = ctx.measureText(lab).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(cs[0] - lw / 2, cs[1] + 26, lw, 15); ctx.fillStyle = '#ffd166'; ctx.fillText(lab, cs[0], cs[1] + 37);
      return;
    }
    if (A.target === 'enemy' || A.target === 'ally') {
      Tac.targets(b, u, st.mode).forEach(function (t) {
        var c = center(t.x, t.y), aimed = st.aim === t.id;
        ctx.strokeStyle = A.target === 'ally' ? (aimed ? '#7dff9b' : 'rgba(125,255,155,' + (.35 + pulse * .4) + ')') : aimed ? '#ffd166' : 'rgba(255,209,102,' + (.35 + pulse * .4) + ')';
        ctx.lineWidth = aimed ? 2.5 : 1.5; ctx.beginPath(); ctx.arc(c[0], c[1], 18, 0, 7); ctx.stroke();
        if (A.target === 'enemy') {
          var ch = st.mode === 'hack' ? Math.max(10, Math.min(90, u.hackSkill - t.hackDef)) : st.mode === 'sever' ? Math.min(90, u.hackSkill + 10) : Tac.hitInfo(b, u, t).chance;
          ctx.font = 'bold ' + (aimed ? 15 : 12) + 'px "Share Tech Mono", monospace'; ctx.textAlign = 'center';
          ctx.fillStyle = '#000'; ctx.fillRect(c[0] - 18, c[1] - 36, 36, 15);
          ctx.fillStyle = '#ffd166'; ctx.fillText(ch + '%', c[0], c[1] - 24);
          if (aimed) {
            var s = center(u.x, u.y); ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.setLineDash([]);
          }
        }
        ctx.lineWidth = 1;
      });
    } else if (A.target === 'tile') {
      var c0 = center(u.x, u.y);
      ctx.strokeStyle = 'rgba(255,209,102,.25)'; ctx.beginPath(); ctx.arc(c0[0], c0[1], A.range * TS, 0, 7); ctx.stroke();
      var h = st.hover; if (!h) return;
      var ok = Tac.tileOk(b, u, st.mode, h.x, h.y), c = center(h.x, h.y);
      if (st.mode === 'grenade') {
        ctx.fillStyle = ok ? (b.emp ? 'rgba(79,209,255,.25)' : 'rgba(255,123,58,.28)') : 'rgba(255,42,85,.15)';
        ctx.fillRect((h.x - 1) * TS, (h.y - 1) * TS, TS * 3, TS * 3);
      } else {
        ctx.strokeStyle = ok ? '#ffd166' : '#ff2a55'; ctx.beginPath(); ctx.arc(c[0], c[1], 5 * TS, 0, 7); ctx.stroke();
      }
    }
  }

  function drawUnit(x, pos, alpha, now) {
    var c = [pos[0] * TS + TS / 2, pos[1] * TS + TS / 2];
    if (x.id === st.sel && x.alive) {
      ctx.strokeStyle = '#4fd1ff'; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -now / 40; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c[0], c[1], 21, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    }
    var fl = st.flash[x.id] ? 1 - (now - st.flash[x.id]) / 260 : 0;
    if (fl <= 0) delete st.flash[x.id];
    var kick = fl > 0 ? fl * 3 : 0, ang = facing(x, now);
    XG.Gfx.unit(ctx, x, c[0] - Math.cos(ang) * kick, c[1] - Math.sin(ang) * kick, {
      facing: ang, now: now, alpha: alpha, flash: Math.max(0, fl), human: HS(), myTurn: st.b.side === HS(),
      hp: st.displayHp[x.id] !== undefined ? st.displayHp[x.id] : x.hp
    });
  }
  // Facing: set by moves and shots, eased toward the target angle every frame.
  function faceTo(id, ang) { st.face[id] = ang; }
  function facing(x, now) {
    var want = st.face[x.id] !== undefined ? st.face[x.id] : x.side === 'player' ? 0 : Math.PI, cur = st.faceDisp[x.id];
    if (cur === undefined) cur = want;
    var d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
    cur += d * Math.min(1, .25);
    st.faceDisp[x.id] = cur;
    return cur;
  }

  var SHOT_RGB = { bullet: '255,233,168', lattice: '255,61,110', pulse: '199,146,255', spike: '255,61,242' };
  function drawFx(f, now) {
    var e = f.e, G = XG.Gfx, k = Math.min(1, (now - f.t0) / (f.dur - 120 > 0 ? f.dur - 120 : f.dur));
    var fade = 1 - Math.max(0, (now - f.t0 - (f.dur - 120)) / 120);
    if (e.t === 'shot') {
      var a = center(e.fx, e.fy), z = center(e.tx, e.ty), ang = Math.atan2(z[1] - a[1], z[0] - a[0]);
      if (!e.hit) { // the miss sails past the target and keeps going a little
        var side = (e.id || e.from) % 2 ? 1 : -1;
        z = [z[0] + Math.cos(ang) * 30 - Math.sin(ang) * 14 * side, z[1] + Math.sin(ang) * 30 + Math.cos(ang) * 14 * side];
      }
      var rgb = SHOT_RGB[e.kind] || SHOT_RGB.bullet, m0 = [a[0] + Math.cos(ang) * 16, a[1] + Math.sin(ang) * 16];
      if (!f.fired) { f.fired = true; G.FX.muzzle(st.parts, m0[0], m0[1], ang, rgb, now); }
      ctx.save(); ctx.globalAlpha = fade;
      if (e.kind === 'spike') { if (k > .15) G.bolt(ctx, m0[0], m0[1], z[0], z[1], rgb, 2.5, Math.floor(now / 50)); }
      else {
        var head = Math.min(1, k * 1.25), tail = Math.max(0, k * 1.25 - (e.kind === 'pulse' ? .55 : .3));
        G.tracer(ctx, m0[0], m0[1], z[0], z[1], tail, head, rgb, e.kind === 'pulse' ? 3.5 : e.kind === 'lattice' ? 2.5 : 2);
      }
      ctx.restore();
      if (!f.landed && k >= .8) {
        f.landed = true;
        var tgt = Tac.unitById(st.b, e.to);
        var mach = !tgt || !!(tgt.machine || tgt.isStatic);
        if (e.hit) { G.FX.impact(st.parts, z[0], z[1], ang, rgb, mach, now); XG.Audio.play('hit', { machine: mach }); }
        else { G.FX.ricochet(st.parts, z[0], z[1], now); XG.Audio.play('miss'); }
      }
    } else if (e.t === 'hack') {
      var h0 = center(e.fx, e.fy), h1 = center(e.tx, e.ty);
      ctx.save(); ctx.globalAlpha = fade; ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(125,255,155,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(h0[0], h0[1]); ctx.lineTo(h1[0], h1[1]); ctx.stroke();
      ctx.font = '11px "Share Tech Mono", monospace'; ctx.textAlign = 'center';
      for (var j = 0; j < 12; j++) {
        var q = k * 1.6 - j * .06; if (q < 0 || q > 1) continue;
        ctx.fillStyle = 'rgba(125,255,155,' + (1 - j / 14) + ')';
        ctx.fillText(G.hash(j, Math.floor(now / 70), 5) < .5 ? '0' : '1', h0[0] + (h1[0] - h0[0]) * q, h0[1] + (h1[1] - h0[1]) * q + Math.sin(q * 12 + j) * 4);
      }
      ctx.restore();
      if (!f.landed && k >= .9) { f.landed = true; G.FX.stun(st.parts, h1[0], h1[1], now); }
    } else if (e.t === 'boom') {
      var c = center(e.x, e.y);
      if (e.kind === 'emp' && k < .8) { // arcs crawling over the blast area
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k;
        for (var n = 0; n < 5; n++) {
          var aa = G.hash(n, Math.floor(now / 60), 7) * 6.28, rr = TS * 1.4 * G.hash(n, Math.floor(now / 60), 8);
          G.bolt(ctx, c[0], c[1], c[0] + Math.cos(aa) * rr, c[1] + Math.sin(aa) * rr, '120,220,255', 1.2, n + Math.floor(now / 60));
        }
        ctx.restore();
      }
    } else if (e.t === 'scan') {
      var c2 = center(e.x, e.y);
      G.sweep(ctx, c2[0], c2[1], e.r * TS, k);
    } else if (e.t === 'spawn') {
      var c3 = center(e.x, e.y);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k;
      var bg = ctx.createLinearGradient(0, c3[1] - 200, 0, c3[1]);
      bg.addColorStop(0, 'rgba(255,42,85,0)'); bg.addColorStop(1, 'rgba(255,42,85,.7)');
      ctx.fillStyle = bg; ctx.fillRect(c3[0] - 8 * (1 - k) - 2, c3[1] - 200, 16 * (1 - k) + 4, 200);
      ctx.strokeStyle = '#ff2a55'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c3[0], c3[1], (1 - k) * TS * 1.2 + 6, 0, 7); ctx.stroke();
      ctx.restore(); ctx.lineWidth = 1;
    }
  }
  // Particles and shake for events as they start playing (only for things the person can see).
  // Particles, shake and sound for events as they start playing (only for things the person can see).
  function eventFx(e, now) {
    var b = st.b, G = XG.Gfx, A = XG.Audio, L = st.parts, u = e.id && Tac.unitById(b, e.id);
    var seen = function (x, y) { return b.visible[y * W + x]; };
    XG.Tutorial.event(e, b);
    if (e.t === 'dmg') {
      st.flash[e.id] = now;
      if (e.crit) { shake(3, now); A.play('crit'); }
    } else if (e.t === 'heal') { var hc = center(e.x, e.y); G.FX.heal(L, hc[0], hc[1], now); A.play('heal'); }
    else if (e.t === 'death' && u && (u.side === HS() || seen(e.x, e.y))) {
      var dc = center(e.x, e.y), rgb = G.rgbOf(u.color), soft = !!D.software[u.kind];
      if (u.kind === 'harmonic' || soft) { G.FX.derez(L, dc[0], dc[1], rgb, now); A.play('death-soft'); }
      else if (u.machine || u.isStatic) {
        G.FX.wreck(L, dc[0], dc[1], rgb, now); shake(u.isStatic ? 9 : 4, now); A.play(u.isStatic ? 'boom' : 'death-machine');
        if (G.biomeOf(b) !== 'cyber') G.decal(b, 'scorch', e.x, e.y, u.isStatic ? 1.6 : 1);
        if (u.isStatic) G.FX.explosion(L, dc[0], dc[1], 1.2, now);
      } else { G.FX.downed(L, dc[0], dc[1], rgb, now); A.play('death-human'); }
    } else if (e.t === 'boom') {
      var bc = center(e.x, e.y);
      if (e.kind === 'emp') { G.FX.emp(L, bc[0], bc[1], e.r || 1, now); shake(4, now); A.play('emp'); }
      else { G.FX.explosion(L, bc[0], bc[1], e.r || 1, now); shake(8, now); A.play('boom'); if (G.biomeOf(b) !== 'cyber') G.decal(b, 'scorch', e.x, e.y, 1.8); }
    } else if (e.t === 'spawn') { var sc = center(e.x, e.y); G.FX.warp(L, sc[0], sc[1], now); A.play('spawn'); }
    else if (e.t === 'scan') A.play('scan');
    else if (e.t === 'text' && seen(e.x, e.y)) {
      var tc = center(e.x, e.y);
      if (/SHIELD|AEGIS/.test(e.text)) { G.FX.shieldUp(L, tc[0], tc[1], now); A.play('shield'); }
      else if (e.text === '!') { G.FX.alert(L, tc[0], tc[1], now); A.play('alert'); }
      else if (/STUNNED|OVERRIDDEN/.test(e.text)) { G.FX.stun(L, tc[0], tc[1], now); A.play('stun'); }
      else if (e.text === 'OVERWATCH' || e.text === 'HUNKER') A.play('overwatch');
    } else if (e.t === 'shot' || e.t === 'hack') {
      faceTo(e.from, Math.atan2(e.ty - e.fy, e.tx - e.fx));
      var from = Tac.unitById(b, e.from), to = Tac.unitById(b, e.to);
      if ((from && from.side === HS()) || (to && to.side === HS()) || seen(e.fx, e.fy) || seen(e.tx, e.ty)) A.play(e.t === 'hack' ? 'hack' : 'shot-' + (e.kind || 'bullet'));
    }
  }

  return { start: start, startWith: startWith, debug: function () { return st; } };
})();
