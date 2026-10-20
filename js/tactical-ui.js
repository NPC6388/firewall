// FIREWALL: tactical screen. Canvas renderer, input, and the event-animation queue.
var XG = globalThis.XG = globalThis.XG || {};

XG.TacUI = (function () {
  var Tac = XG.Tac, D = XG.DATA, TS = 40, W = Tac.W, H = Tac.H;
  var $ = function (id) { return document.getElementById(id); };
  var st = null, cv, ctx, dpr = 1, bound = false;

  var DUR = { move: 85, shot: 260, dmg: 140, heal: 140, text: 110, death: 380, boom: 440, scan: 420, hack: 380, spawn: 280, pause: 1 };
  var THEME = { purge: '79,209,255', relay: '199,146,255', uplink: '255,42,85' };

  function start(g, mission, squad, onDone) { startWith(g, Tac.create(g, mission, squad), onDone); }
  // Runs any prepared battle (FIREWALL or Lattice controlled). b.human says which side the person plays.
  function startWith(g, b, onDone) {
    cv = $('tac-canvas'); ctx = cv.getContext('2d');
    st = {
      g: g, b: b, onDone: onDone, sel: null, mode: null, aim: null, hover: null,
      queue: [], cur: null, floaters: [], fx: [], displayPos: {}, displayHp: {}, dying: {}, hidden: {},
      reachCache: null, finished: false, lastLog: 0, dirty: true
    };
    $('tac-log').innerHTML = '';
    syncLog();
    st.sel = firstReady();
    XG.UI.show('screen-tactical');
    bindOnce();
    resize();
    if (b.side !== b.human) banner(lat() ? 'FIREWALL TURN' : 'LATTICE TURN', 'enemy');
    hud();
    requestAnimationFrame(frame);
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
      else if (/^[1-9]$/.test(e.key)) { var u = selUnit(); if (u && u.abilities[+e.key - 1]) pickAbility(u.abilities[+e.key - 1]); }
    });
    $('tac-endturn').onclick = endTurn;
    $('tac-overclock').onclick = overclock;
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
  function select(id) { st.sel = id; st.mode = null; st.aim = null; hud(); hoverPanel(); }
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
    if (A.target === 'self') { run(id); return; }
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
    var dur = DUR[e.t] || 0, b = st.b, u = e.id && Tac.unitById(b, e.id);
    if (e.t === 'move') {
      var shown = (u && u.side === HS()) || pathVisible(e.path);
      dur = shown ? DUR.move * (e.path.length - 1) : 0;
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
    else if (e.t === 'pause') dur = e.ms;
    if (dur > 0) st.cur = { e: e, t0: now, end: now + dur };
    else finish(e);
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
    $('tac-top').innerHTML = '<b>' + b.mission.name + '</b><span class="dim">' + b.mission.city + '</span><span class="obj">◎ ' + obj + '</span>' +
      '<span class="dim">Turn ' + b.turn + (b.turnLimit ? '/' + b.turnLimit : '') + ' · ' + left + ' hostile(s) in sight</span>' +
      '<span class="turn-banner ' + (mine ? 'player' : 'enemy') + '">' + (b.outcome ? 'BATTLE OVER' : mine ? 'YOUR TURN' : lat() ? 'FIREWALL TURN' : 'LATTICE TURN') + '</span>';

    $('tac-squad').innerHTML = squadUnits().map(function (x) {
      var pips = '';
      for (var i = 0; i < x.maxHp; i++) pips += '<i class="' + (i < x.hp ? '' : 'e') + '"></i>';
      for (var j = 0; j < x.shield; j++) pips += '<i class="s"></i>';
      var cls = !x.alive ? 'dead' : x.ap <= 0 ? 'spent' : '';
      var tag = !x.alive ? (lat() ? 'LOST' : 'KIA') : x.override ? '<span class="good">OVERRIDE ' + x.override + '</span>' : (x.overwatch ? 'OW · ' : '') + (x.hunker ? 'HNK · ' : '') + x.ap + ' AP';
      return '<div class="sq ' + cls + (x.id === st.sel ? ' on' : '') + '" data-unit="' + x.id + '"><div class="n"><span style="color:' + x.color + '">' + x.glyph + '</span> ' + (x.short || x.name) + '</div>' +
        '<div class="dim">' + tag + '</div><div class="pips">' + pips + '</div></div>';
    }).join('');
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
    $('tac-abort').disabled = !canInput();
    infoPanel(u);
  }
  function modeHint() {
    var A = D.abilities[st.mode];
    var u = selUnit(), k = u ? u.abilities.indexOf(st.mode) + 1 : 0;
    if (A.target === 'enemy') return 'Tab cycles targets. Click the target again or press ' + k + ' to fire. Esc cancels.';
    if (A.target === 'ally') return 'Click an ally, or Tab to one and press ' + k + '. Esc cancels.';
    return 'Click a tile, or hover one and press ' + k + ' (range ' + A.range + '). Esc cancels.';
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
          html += hi.ok ? '<div>' + (u.short || u.name) + ': <b>' + hi.chance + '%</b> to hit · ' + hi.crit + '% crit · ' + coverLabel(hi) + ' · ' + hi.d.toFixed(1) + ' tiles</div>'
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
    if (!st) return;
    pump(now);
    if (!st) return;
    draw(now);
    requestAnimationFrame(frame);
  }

  function center(x, y) { return [x * TS + TS / 2, y * TS + TS / 2]; }
  function unitPos(u, now) {
    if (st.cur && st.cur.e.t === 'move' && st.cur.e.id === u.id) {
      var p = st.cur.e.path, k = Math.min(1, (now - st.cur.t0) / (st.cur.end - st.cur.t0)) * (p.length - 1);
      var i = Math.min(p.length - 2, Math.floor(k)), f = k - i;
      return [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f];
    }
    var d = st.displayPos[u.id];
    return d ? [d[0], d[1]] : [u.x, u.y];
  }

  function draw(now) {
    var b = st.b, theme = THEME[b.mission.kind];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070d16'; ctx.fillRect(0, 0, W * TS, H * TS);
    // floor + grid
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var t = b.tiles[y * W + x], px = x * TS, py = y * TS;
      ctx.fillStyle = (x + y) % 2 ? '#0b1422' : '#0c1625'; ctx.fillRect(px, py, TS, TS);
      ctx.strokeStyle = 'rgba(' + theme + ',.06)'; ctx.strokeRect(px + .5, py + .5, TS - 1, TS - 1);
      if (t === Tac.WALL) {
        ctx.fillStyle = '#26364f'; ctx.fillRect(px, py, TS, TS);
        ctx.fillStyle = '#3a5277'; ctx.fillRect(px, py, TS, 4);
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath();
        for (var hz = 8; hz < TS; hz += 8) { ctx.moveTo(px, py + hz + .5); ctx.lineTo(px + TS, py + hz + .5); }
        ctx.stroke();
      } else if (t === Tac.LOW) {
        ctx.fillStyle = '#1a2c44'; ctx.fillRect(px + 4, py + 15, TS - 8, TS - 19);
        ctx.strokeStyle = 'rgba(' + theme + ',.45)'; ctx.strokeRect(px + 4.5, py + 15.5, TS - 9, TS - 20);
      } else if (t === Tac.HIGH) {
        ctx.fillStyle = '#152238'; ctx.fillRect(px + 5, py + 3, TS - 10, TS - 6);
        ctx.strokeStyle = '#34507a'; ctx.strokeRect(px + 5.5, py + 3.5, TS - 11, TS - 7);
        ctx.fillStyle = 'rgba(' + theme + ',.7)';
        for (var l = 0; l < 4; l++) ctx.fillRect(px + 10, py + 8 + l * 7, (l * 7 + x * 3 + y) % 13 + 4, 2);
      }
    }
    // active scans
    b.scans.forEach(function (s) {
      var c = center(s.x, s.y);
      ctx.strokeStyle = 'rgba(255,209,102,.35)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(c[0], c[1], s.r * TS, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    });
    // fog
    ctx.fillStyle = 'rgba(2,4,8,.58)';
    for (var fy = 0; fy < H; fy++) for (var fx = 0; fx < W; fx++) if (!b.visible[fy * W + fx]) ctx.fillRect(fx * TS, fy * TS, TS, TS);

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

    // fx
    st.fx = st.fx.filter(function (f) { return now - f.t0 < f.dur; });
    st.fx.forEach(function (f) { drawFx(f, now); });
    // floaters
    st.floaters = st.floaters.filter(function (f) { return now - f.t0 < 1000; });
    ctx.textAlign = 'center'; ctx.font = 'bold 13px "Share Tech Mono", monospace';
    st.floaters.forEach(function (f) {
      var k = (now - f.t0) / 1000; if (k < 0) return;
      var c = center(f.x, f.y);
      ctx.globalAlpha = 1 - k * k; ctx.fillStyle = '#000'; ctx.fillText(f.text, c[0] + 1, c[1] - 22 - k * 26 + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, c[0], c[1] - 22 - k * 26); ctx.globalAlpha = 1;
    });
    // turn banner flash
    if (bannerEl && now - bannerEl.t0 < 1100) {
      var a = 1 - (now - bannerEl.t0) / 1100;
      ctx.globalAlpha = a * .9; ctx.fillStyle = 'rgba(4,8,14,.75)'; ctx.fillRect(0, H * TS / 2 - 34, W * TS, 68);
      ctx.fillStyle = bannerEl.color; ctx.font = 'bold 34px Rajdhani, sans-serif';
      ctx.fillText(bannerEl.text, W * TS / 2, H * TS / 2 + 12); ctx.globalAlpha = 1;
    }
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
      ctx.fillStyle = !it.hi.ok ? '#7d8ea5' : o.dash ? 'rgba(255,209,102,.5)' : it.hi.cover === 0 ? '#7dff9b' : '#ffd166';
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
    var c = [pos[0] * TS + TS / 2, pos[1] * TS + TS / 2], enemy = x.side === 'enemy' || x.origSide === 'enemy';
    ctx.globalAlpha = Math.max(0, alpha);
    if (x.id === st.sel && x.alive) {
      ctx.strokeStyle = '#4fd1ff'; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -now / 40; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c[0], c[1], 18, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    }
    var R = x.isStatic ? 16 : 13;
    ctx.fillStyle = enemy ? '#1d0a12' : '#0a1626';
    ctx.strokeStyle = x.color; ctx.lineWidth = 2;
    ctx.beginPath();
    if (x.isStatic) { for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3 + now / 1500; ctx.lineTo(c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R); } ctx.closePath(); }
    else if (enemy) { ctx.moveTo(c[0], c[1] - R); ctx.lineTo(c[0] + R, c[1]); ctx.lineTo(c[0], c[1] + R); ctx.lineTo(c[0] - R, c[1]); ctx.closePath(); }
    else ctx.arc(c[0], c[1], R, 0, 7);
    ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
    if (enemy && !x.isStatic) { ctx.shadowColor = x.color; ctx.shadowBlur = 10; }
    ctx.fillStyle = x.color; ctx.font = 'bold 14px "Share Tech Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(x.glyph, c[0], c[1] + 1); ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0;
    // hp pips
    var hp = st.displayHp[x.id] !== undefined ? st.displayHp[x.id] : x.hp, n = x.maxHp, pw = Math.min(5, 30 / n);
    var x0 = c[0] - (n * pw) / 2;
    for (var i = 0; i < n; i++) { ctx.fillStyle = i < hp ? (enemy ? '#ff4d6d' : '#7dff9b') : '#2a1820'; ctx.fillRect(x0 + i * pw, c[1] - 20, pw - 1, 3); }
    for (var s = 0; s < x.shield; s++) { ctx.fillStyle = '#c792ff'; ctx.fillRect(x0 + s * pw, c[1] - 24, pw - 1, 2); }
    // status
    ctx.font = '10px "Share Tech Mono", monospace';
    if (x.overwatch) { ctx.fillStyle = '#4fd1ff'; ctx.fillText('OW', c[0] - 13, c[1] + 19); }
    if (x.hunker) { ctx.fillStyle = '#4fd1ff'; ctx.fillText('HNK', c[0] + 12, c[1] + 19); }
    if (x.shield) { ctx.strokeStyle = 'rgba(199,146,255,.7)'; ctx.beginPath(); ctx.arc(c[0], c[1], 16, 0, 7); ctx.stroke(); }
    if (x.marked) { ctx.strokeStyle = '#ffd166'; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (o) { ctx.beginPath(); ctx.moveTo(c[0] + o[0] * 17, c[1] + o[1] * 11); ctx.lineTo(c[0] + o[0] * 17, c[1] + o[1] * 17); ctx.lineTo(c[0] + o[0] * 11, c[1] + o[1] * 17); ctx.stroke(); }); }
    if (x.stunned) { ctx.fillStyle = '#7dff9b'; ctx.fillText('zz', c[0] + 14, c[1] - 10); }
    if (x.override) { ctx.fillStyle = '#7dff9b'; ctx.fillText('⟲' + x.override, c[0] + 14, c[1] - 10); }
    if (x.side === 'enemy' && !x.alerted && !x.isStatic) { ctx.fillStyle = '#7d8ea5'; ctx.fillText('?', c[0] + 14, c[1] - 10); }
    if (x.side === HS() && x.ap <= 0 && x.alive && st.b.side === HS() && !x.isStatic) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(c[0], c[1], 13, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawFx(f, now) {
    var e = f.e, k = Math.min(1, (now - f.t0) / (f.dur - 120 > 0 ? f.dur - 120 : f.dur));
    if (e.t === 'shot' || e.t === 'hack') {
      var a = center(e.fx, e.fy), z = center(e.tx, e.ty);
      if (e.t === 'shot' && !e.hit) { z = [z[0] + (e.tx >= e.fx ? 12 : -12), z[1] - 14]; }
      var col = e.t === 'hack' ? '#7dff9b' : { bullet: '#ffe9a8', lattice: '#ff3d6e', pulse: '#c792ff', spike: '#ff3df2' }[e.kind];
      ctx.strokeStyle = col; ctx.globalAlpha = 1 - Math.max(0, (now - f.t0 - (f.dur - 120)) / 120);
      ctx.lineWidth = e.kind === 'spike' ? 3 : 2;
      if (e.t === 'hack') { ctx.setLineDash([3, 5]); ctx.lineDashOffset = -now / 20; }
      var head = Math.min(1, k * 1.15), tail = Math.max(0, k * 1.15 - .35);
      ctx.beginPath(); ctx.moveTo(a[0] + (z[0] - a[0]) * tail, a[1] + (z[1] - a[1]) * tail); ctx.lineTo(a[0] + (z[0] - a[0]) * head, a[1] + (z[1] - a[1]) * head); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1; ctx.globalAlpha = 1;
    } else if (e.t === 'boom') {
      var c = center(e.x, e.y), rr = (0.4 + k * 1.2) * TS;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = e.kind === 'emp' ? 'rgba(79,209,255,.5)' : 'rgba(255,123,58,.55)';
      ctx.beginPath(); ctx.arc(c[0], c[1], rr, 0, 7); ctx.fill();
      ctx.strokeStyle = e.kind === 'emp' ? '#4fd1ff' : '#ffd166'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1;
    } else if (e.t === 'scan') {
      var c2 = center(e.x, e.y);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c2[0], c2[1], k * e.r * TS, 0, 7); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1;
    } else if (e.t === 'spawn') {
      var c3 = center(e.x, e.y);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ff2a55'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c3[0], c3[1], (1 - k) * TS * 1.2 + 6, 0, 7); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1;
    }
  }

  return { start: start, startWith: startWith, debug: function () { return st; } };
})();
