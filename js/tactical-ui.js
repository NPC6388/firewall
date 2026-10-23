// FIREWALL: tactical screen. Canvas renderer, input, and the event-animation queue.
var XG = globalThis.XG = globalThis.XG || {};

XG.TacUI = (function () {
  var Tac = XG.Tac, D = XG.DATA, TS = 40, W = Tac.BASE_W, H = Tac.BASE_H; // W/H: the current battle's map size (set in startWith)
  var $ = function (id) { return document.getElementById(id); };
  var st = null, cv, ctx, dpr = 1, bound = false;

  var DUR = { move: 85, shot: 260, dmg: 140, heal: 140, text: 110, death: 380, boom: 440, scan: 420, hack: 380, spawn: 280, pause: 1 };

  function start(g, mission, squad, onDone) { startWith(g, Tac.create(g, mission, squad), onDone); }
  // Runs any prepared battle (FIREWALL or Lattice controlled). b.human says which side the person plays.
  // snap: the battle as it stood on turn 1 (JSON), kept so Restart can rebuild it; taken here on a fresh start.
  function startWith(g, b, onDone, snap) {
    cv = $('tac-canvas'); ctx = cv.getContext('2d');
    if (XG.Comms) XG.Comms.clear();
    W = b.W || Tac.BASE_W; H = b.H || Tac.BASE_H;
    st = {
      snap: b.training ? null : snap || JSON.stringify(b),
      g: g, b: b, onDone: onDone, sel: null, mode: null, aim: null, hover: null,
      queue: [], cur: null, floaters: [], fx: [], parts: [], face: {}, faceDisp: {}, flash: {}, shake: null, lastNow: 0,
      displayPos: {}, displayHp: {}, dying: {}, hidden: {}, seen: {},
      reachCache: null, finished: false, lastLog: 0, dirty: true,
      cam: { x: 0, y: 0, z: 1 }, camGoal: null, camFit: true, keys: {}, mouse: null, drag: null
    };
    // units start facing the other side (spawn points are random, so east/west defaults would look wrong)
    if (!b.training) ['player', 'enemy'].forEach(function (sd) {
      var mine = b.units.filter(function (u) { return u.alive && u.side === sd; }), foes = b.units.filter(function (u) { return u.alive && u.side !== sd; });
      if (!mine.length || !foes.length) return;
      var fx = foes.reduce(function (s, u) { return s + u.x; }, 0) / foes.length, fy = foes.reduce(function (s, u) { return s + u.y; }, 0) / foes.length;
      mine.forEach(function (u) { st.face[u.id] = Math.atan2(fy - u.y, fx - u.x); });
    });
    $('tac-log').innerHTML = '';
    syncLog();
    st.sel = firstReady();
    XG.UI.show('screen-tactical');
    bindOnce();
    resize();
    var su = selUnit() || st.b.units.filter(function (u) { return u.alive && u.side === HS(); })[0];
    if (su) centerOn(su.x, su.y, true);
    if (b.side !== b.human) banner(lat() ? 'FIREWALL TURN' : 'LATTICE TURN', 'enemy');
    XG.Audio.scene(lat() ? 'battle-lat' : 'battle');
    if (XG.Tutorial) XG.Tutorial.battleStart(g, b, { hud: function () { hud(); } });
    if (XG.Comms) XG.Comms.battle(g, b, 'start');
    hud();
    var loop = st.loop = {};
    requestAnimationFrame(function tick(now) { if (st && st.loop === loop) { frame(now); requestAnimationFrame(tick); } });
  }

  function bindOnce() {
    if (bound) return; bound = true;
    cv.addEventListener('mousemove', function (e) {
      if (!st) return;
      st.mouse = { x: e.clientX, y: e.clientY };
      updateHover();
    });
    cv.addEventListener('mouseleave', function () { if (st) { st.mouse = null; st.hover = null; hoverPanel(); } });
    // a left click that ended a drag only panned the view
    cv.addEventListener('click', function (e) { if (st && st.dragMoved) { st.dragMoved = false; return; } click(tileFromEvent(e)); });
    // camera: left or middle drag pans; the wheel zooms at the cursor. Right click moves (or cancels an armed ability).
    cv.addEventListener('mousedown', function (e) {
      if (!st || (e.button !== 0 && e.button !== 1)) return;
      if (e.button === 1) e.preventDefault(); // no autoscroll
      st.drag = { x: e.clientX, y: e.clientY, cx: st.cam.x, cy: st.cam.y, moved: false };
      st.dragMoved = false;
    });
    window.addEventListener('mousemove', function (e) {
      var d = st && st.drag; if (!d) return;
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
      if (!d.moved || st.camFit) return;
      var k = viewScale();
      st.camGoal = null;
      setCam(d.cx - (e.clientX - d.x) * k / st.cam.z, d.cy - (e.clientY - d.y) * k / st.cam.z);
    });
    window.addEventListener('mouseup', function () { if (st && st.drag) { st.dragMoved = st.drag.moved; st.drag = null; } });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); if (st) rightClick(tileFromEvent(e)); });
    cv.addEventListener('wheel', function (e) {
      if (!st || st.camFit) return; // a map that fits whole doesn't zoom (and the page may scroll)
      e.preventDefault();
      var r = cv.getBoundingClientRect(), k = viewScale();
      zoomAt((e.clientX - r.left - cv.clientLeft) * k, (e.clientY - r.top - cv.clientTop) * k, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    document.addEventListener('keyup', function (e) { if (st && ARROWS[e.key]) st.keys[e.key] = false; });
    window.addEventListener('blur', function () { if (st) st.keys = {}; });
    window.addEventListener('resize', function () { if (st) resize(); });
    if (typeof ResizeObserver === 'function') new ResizeObserver(function () { if (st) resize(); }).observe(document.querySelector('.tac-bar')); // e.g. the squad wraps
    document.addEventListener('keydown', function (e) {
      if (!st || $('screen-tactical').classList.contains('hidden') || XG.UI.isModal()) return;
      if (e.key === 'Escape') cancel();
      else if (ARROWS[e.key]) { e.preventDefault(); st.keys[e.key] = true; st.camGoal = null; }
      else if (e.key === 'c' || e.key === 'C') { var cu = selUnit(); if (cu) centerOn(cu.x, cu.y); }
      else if (e.key === 'Tab') { e.preventDefault(); if (st.mode) cycleTarget(e.shiftKey ? -1 : 1); else cycle(); }
      else if (e.key === 'Enter') endTurn();
      else if (e.key === 'o' || e.key === 'O') overclock();
      else if (e.key === ' ') { e.preventDefault(); if (!(XG.Tutorial && XG.Tutorial.advance())) { if (st.mode) confirmArmed(); else if (allSpent()) endTurn(); } }
      else if (e.key === 'y' || e.key === 'Y') overwatchAll();
      else if (e.key === 'h' || e.key === 'H') hunkerAll();
      else if (e.key === 'm' || e.key === 'M') XG.Settings.set('muted', !XG.Settings.get('muted'));
      else if (e.key === '?' || e.key === 'F1') { e.preventDefault(); XG.Help.open(); }
      else if (/^[1-9]$/.test(e.key)) { var u = selUnit(); if (u && u.abilities[+e.key - 1]) pickAbility(u.abilities[+e.key - 1]); }
    });
    $('tac-endturn').onclick = endTurn;
    $('tac-overclock').onclick = overclock;
    $('tac-owall').onclick = overwatchAll;
    $('tac-hkall').onclick = hunkerAll;
    // Esc closes the overwatch-all / hunker-all question (the battle key handler is paused while a modal is open)
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('owa-no') && XG.UI.isModal()) XG.UI.closeModal(); });
    $('tac-abort').onclick = function () {
      if (!canInput()) return;
      // Restart: start over from turn 1, same map, squad and enemies; nothing from this attempt counts
      var RS = st.snap ? '<button id="ab-restart" title="Start over from turn 1: same map, squad, enemies and objectives, but both sides land on new spawn points and patrols take new routes. Nothing from this attempt counts.">Restart mission</button>' : '';
      XG.UI.modal(st.b.training ? '<h1>Leave the range?</h1><p>Training ends; nothing is lost.</p><div class="modal-actions"><button id="ab-no">Stay</button><button class="danger" id="ab-yes">Leave</button></div>' : lat() ? '<h1>Withdraw?</h1><p>Your units pull back into the network. The mission counts as lost.</p>' +
        '<div class="modal-actions"><button id="ab-no">Keep fighting</button>' + RS + '<button class="danger" id="ab-yes">Withdraw</button></div>' :
        '<h1>Abort mission?</h1><p>The squad extracts. The mission counts as a failure: regional infection rises and Convergence +2%.' +
        (st.b.mission.kind !== 'purge' ? ' Story missions stay available for another attempt.' : '') + '</p>' +
        '<div class="modal-actions"><button id="ab-no">Stay and fight</button>' + RS + '<button class="danger" id="ab-yes">Abort</button></div>');
      if ($('ab-restart')) $('ab-restart').onclick = restart;
      $('ab-no').onclick = XG.UI.closeModal;
      $('ab-yes').onclick = function () { XG.UI.closeModal(); Tac.abort(st.b); };
    };
  }

  // ------------------------------------------------------------ camera
  // The canvas fills the battle area (VW x VH CSS px). st.cam.x/y is the map point (unzoomed px, TS per tile) at the
  // view's top-left and st.cam.z the zoom. A map that fits whole at today's tile size or more (combat training) is
  // drawn whole and centred, as before: st.camFit, no panning or zooming.
  var VW = 880, VH = 640, ZMIN = .5, ZMAX = 1.5, ARROWS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };
  function resize() {
    dpr = window.devicePixelRatio || 1;
    var wrap = cv.parentElement, aw = wrap.clientWidth - 16;
    var barH = document.querySelector('.tac-bar').offsetHeight;
    document.documentElement.style.setProperty('--bar-h', barH + 'px'); // the comms card sits just above the bar
    var ah = window.innerWidth <= 980 ? Math.min(aw * H / W, window.innerHeight * .7) : window.innerHeight - $('tac-top').offsetHeight - barH - 20;
    aw = Math.max(160, Math.floor(aw)); ah = Math.max(120, Math.floor(ah));
    var fit = Math.min(aw / (W * TS), ah / (H * TS));
    st.camFit = !!st.b.training || fit >= 1;
    if (st.camFit) { // as before: the canvas holds the whole map at its own resolution and CSS scales it to fit
      VW = W * TS; VH = H * TS;
      st.cam = { x: 0, y: 0, z: 1 }; st.camGoal = null;
      cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
      cv.style.width = Math.floor(W * TS * fit) + 'px'; cv.style.height = Math.floor(H * TS * fit) + 'px';
      return;
    } else {
      VW = aw; VH = ah;
      ZMIN = Math.min(ZMAX, Math.max(.5, fit));
      st.cam.z = Math.max(ZMIN, Math.min(ZMAX, st.cam.z || 1));
      setCam(st.cam.x, st.cam.y);
    }
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
    cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
  }
  // CSS px of the view per client px (1 unless the page is zoomed or the canvas got squeezed).
  function viewScale() { return cv.clientWidth ? VW / cv.clientWidth : 1; }
  function clampCam(c) {
    var vw = VW / st.cam.z, vh = VH / st.cam.z, mw = W * TS, mh = H * TS;
    c.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, c.x));
    c.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, c.y));
    return c;
  }
  function setCam(x, y) { st.cam.x = x; st.cam.y = y; clampCam(st.cam); }
  // Is the tile inside the view, at least `margin` map px from its edges?
  function onScreen(x, y, margin) {
    var px = x * TS + TS / 2, py = y * TS + TS / 2, vw = VW / st.cam.z, vh = VH / st.cam.z;
    var m = Math.min(margin, vw / 4, vh / 4);
    return px >= st.cam.x + m && px <= st.cam.x + vw - m && py >= st.cam.y + m && py <= st.cam.y + vh - m;
  }
  // Centre the view on a point in map px: glide there (snap with reduced motion or when asked).
  function centerPx(px, py, snap) {
    if (st.camFit) return;
    var goal = clampCam({ x: px - VW / st.cam.z / 2, y: py - VH / st.cam.z / 2 });
    if (snap || XG.Gfx.REDUCED) { st.camGoal = null; setCam(goal.x, goal.y); updateHover(); }
    else st.camGoal = goal;
  }
  function centerOn(x, y, snap) { centerPx(x * TS + TS / 2, y * TS + TS / 2, snap); }
  // Bring tiles into view if any of them is off screen (or hugging an edge); leave the camera alone if they're all
  // visible. Several tiles (a shot's two ends, a path) are framed together when they fit. Returns true when it glides.
  function focusTiles(pts) {
    if (st.camFit || !pts.length) return false;
    var m = TS * 1.5;
    if (pts.every(function (p) { return onScreen(p[0], p[1], m); })) return false;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    var fits = (x1 - x0 + 1) * TS + 2 * m <= VW / st.cam.z && (y1 - y0 + 1) * TS + 2 * m <= VH / st.cam.z, last = pts[pts.length - 1];
    if (fits) centerPx((x0 + x1 + 1) * TS / 2, (y0 + y1 + 1) * TS / 2); else centerOn(last[0], last[1]);
    return !!st.camGoal;
  }
  function zoomAt(sx, sy, f) {
    var z = st.cam.z, nz = Math.max(ZMIN, Math.min(ZMAX, z * f));
    if (nz === z) return;
    var wx = st.cam.x + sx / z, wy = st.cam.y + sy / z;
    st.cam.z = nz; st.camGoal = null;
    setCam(wx - sx / nz, wy - sy / nz);
    updateHover();
  }
  // Arrow keys, edge scrolling and the glide toward camGoal. Returns true while the camera is moving.
  var PAN = 760, EDGE = 18;
  function camStep(now) {
    var dt = Math.min(50, now - (st.camT || now)); st.camT = now;
    if (st.camFit || !dt) return false;
    var ox = st.cam.x, oy = st.cam.y, dx = 0, dy = 0, k = st.keys;
    if (!XG.UI.isModal()) { dx = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0); dy = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0); }
    if (st.mouse && !st.drag && !dx && !dy) {
      var r = cv.getBoundingClientRect(), s = viewScale(), sx = (st.mouse.x - r.left - cv.clientLeft) * s, sy = (st.mouse.y - r.top - cv.clientTop) * s;
      dx = sx < EDGE ? -1 : sx > VW - EDGE ? 1 : 0; dy = sy < EDGE ? -1 : sy > VH - EDGE ? 1 : 0;
    }
    if (dx || dy) { st.camGoal = null; setCam(st.cam.x + dx * PAN * dt / 1000 / st.cam.z, st.cam.y + dy * PAN * dt / 1000 / st.cam.z); }
    else if (st.camGoal) {
      var g = st.camGoal, f = 1 - Math.exp(-dt / 70);
      if (Math.abs(g.x - st.cam.x) + Math.abs(g.y - st.cam.y) < 1) { st.camGoal = null; setCam(g.x, g.y); }
      else setCam(st.cam.x + (g.x - st.cam.x) * f, st.cam.y + (g.y - st.cam.y) * f);
    }
    var moved = st.cam.x !== ox || st.cam.y !== oy;
    if (moved) updateHover();
    return moved || !!st.camGoal || !!(st.drag && st.drag.moved);
  }
  function tileFromEvent(e) {
    var r = cv.getBoundingClientRect(), s = viewScale();
    var sx = (e.clientX - r.left - cv.clientLeft) * s, sy = (e.clientY - r.top - cv.clientTop) * s;
    return { x: Math.floor((st.cam.x + sx / st.cam.z) / TS), y: Math.floor((st.cam.y + sy / st.cam.z) / TS) };
  }
  // The cursor in map px (null when it is off the map), for sprites whose eyes follow it.
  function cursorMap() {
    if (!st.mouse) return null;
    var r = cv.getBoundingClientRect(), s = viewScale();
    return [st.cam.x + (st.mouse.x - r.left - cv.clientLeft) * s / st.cam.z, st.cam.y + (st.mouse.y - r.top - cv.clientTop) * s / st.cam.z];
  }
  function updateHover() {
    if (!st || !st.mouse) return;
    var t = tileFromEvent({ clientX: st.mouse.x, clientY: st.mouse.y });
    if (!st.hover || t.x !== st.hover.x || t.y !== st.hover.y) { st.hover = t; hoverPanel(); }
  }
  // For tests: scroll the tile into view (snapping) and return its centre in client coordinates.
  function tileToClient(x, y) {
    if (!st) return null;
    if (!st.camFit && !onScreen(x, y, TS * 3)) centerOn(x, y, true);
    st.camGoal = null;
    var r = cv.getBoundingClientRect(), s = viewScale();
    return { x: r.left + cv.clientLeft + (x * TS + TS / 2 - st.cam.x) * st.cam.z / s, y: r.top + cv.clientTop + (y * TS + TS / 2 - st.cam.y) * st.cam.z / s, tile: TS * st.cam.z / s };
  }

  // ----------------------------------------------------------- helpers
  // HS(): the side the person controls ('player' = FIREWALL, 'enemy' = Lattice). lat(): playing the Lattice.
  function HS() { return st.b.human; }
  function lat() { return st.b.human === 'enemy'; }
  function selUnit() { var u = st.sel && Tac.unitById(st.b, st.sel); return u && u.alive && u.side === HS() ? u : null; }
  function squadUnits() { return st.b.units.filter(function (u) { return u.side === HS() && !u.isStatic && (u.alive || u.sid || u.deployed); }); }
  // Your units with AP left, leader first: most HP now, then most max HP, then squad order. Selection and Tab follow this.
  // Every unit of yours is out of AP: Space ends the turn and the End Turn button pulses.
  function allSpent() { return canInput() && !readyUnits().length; }
  function readyUnits() {
    return st.b.units.filter(function (x) { return x.alive && x.side === HS() && x.ap > 0; })
      .sort(function (a, c) { return c.hp - a.hp || c.maxHp - a.maxHp || a.id - c.id; });
  }
  function firstReady() { var u = readyUnits()[0]; return u ? u.id : null; }
  // A tile the person's side has ever seen (unexplored ground is blank: no terrain, cover or move-range shading).
  function explored(x, y) { var e = st.b.explored || st.b.visible; return !!e[y * W + x]; }
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
  // Combat training can refuse an input that isn't part of the current lesson.
  function allowed(kind, a1, a2) { return !XG.Tutorial || XG.Tutorial.allow(kind, st.b, a1, a2); }
  function click(t) {
    if (!canInput() || t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) return;
    var b = st.b, u = selUnit(), at = unitAtVisible(t.x, t.y), A = st.mode && D.abilities[st.mode];
    if (A) {
      if (A.target === 'enemy') {
        if (at && Tac.targets(b, u, st.mode).indexOf(at) >= 0) {
          if (st.aim === at.id) run(st.mode, at); else { st.aim = at.id; hoverPanel(); }
        } else if (!at && st.mode === 'shoot' && objTarget(u, t.x, t.y)) { // a destructible tile: aim, then fire
          var ot = Tac.objectAt(b, t.x, t.y);
          if (st.aim === ot.id) runObject(ot); else { st.aim = ot.id; hud(); hoverPanel(); }
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
    if (at && u && Tac.targets(b, u, 'shoot').indexOf(at) >= 0) { if (allowed('arm', 'shoot')) { st.mode = 'shoot'; st.aim = at.id; hud(); } return; }
  }
  // Right click: cancel an armed ability, otherwise move the selected unit to that tile.
  function rightClick(t) {
    if (st.mode) { cancel(); return; }
    if (!canInput() || t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) return;
    var b = st.b, u = selUnit();
    if (!u || unitAtVisible(t.x, t.y)) return;
    var r = getReach(u), d = r.d[t.y * W + t.x];
    if (d > 0 && allowed('move', t.x, t.y)) {
      var ev = Tac.act.move(b, u, t.x, t.y);
      if (ev) { enqueue(ev); hud(); }
    }
  }
  function select(id) {
    if (id !== st.sel) XG.Audio.play('select');
    st.sel = id; st.mode = null; st.aim = null; hud(); hoverPanel();
    var su = Tac.unitById(st.b, id); if (su) focusTiles([[su.x, su.y]]);
  }
  function cancel() { if (st.mode) { st.mode = null; st.aim = null; hud(); hoverPanel(); } }
  function cycle() {
    var list = readyUnits();
    if (!list.length) return;
    var i = list.map(function (u) { return u.id; }).indexOf(st.sel);
    var nu = list[(i + 1) % list.length];
    select(nu.id);
    centerOn(nu.x, nu.y); // Tab always brings the new unit to the middle of the screen
  }
  // While an ability is armed, Tab / Shift+Tab steps through its valid targets instead of squadmates.
  // Enemies are ordered best odds first (same as the auto-aim), allies nearest first.
  // Your own hacked machines are valid Shoot targets but always sort after real hostiles.
  // Destructible objects the selected unit can shoot (cached per tile, turn and log length; the list is a line-of-sight scan).
  function objTargets(u) {
    var b = st.b, key = [u.id, u.x, u.y, b.turn, b.log.length, u.ap].join(',');
    if (!st.objCache || st.objCache.key !== key) st.objCache = { key: key, list: Tac.objectTargets(b, u) };
    return st.objCache.list;
  }
  function objTarget(u, x, y) { return objTargets(u).filter(function (o) { return o.x === x && o.y === y; })[0] || null; }
  function aimObject() { return st.aim && st.b ? Tac.objectById(st.b, st.aim) : null; }
  function runObject(o) {
    var u = selUnit(); if (!u || !canInput()) return;
    var ev = Tac.act.shootTile(st.b, u, o.x, o.y);
    st.mode = null; st.aim = null; st.objCache = null;
    if (ev) enqueue(ev);
    hud();
  }
  function hackedLast(a, c) { return (a.side === HS() ? 1 : 0) - (c.side === HS() ? 1 : 0); }
  function cycleTarget(dir) {
    var u = selUnit(); if (!canInput() || !u || !st.mode) return;
    var A = D.abilities[st.mode];
    if (A.target !== 'enemy' && A.target !== 'ally') return; // tile abilities: aim with the mouse
    var ts = Tac.targets(st.b, u, st.mode);
    if (!ts.length && !(st.mode === 'shoot' && objTargets(u).some(function (o) { return o.prop === 'barrel'; }))) return;
    ts.sort(A.target === 'enemy'
      ? function (a, c) { return hackedLast(a, c) || Tac.hitInfo(st.b, u, c).chance - Tac.hitInfo(st.b, u, a).chance || a.id - c.id; }
      : function (a, c) { return Tac.dist(u.x, u.y, a.x, a.y) - Tac.dist(u.x, u.y, c.x, c.y) || a.id - c.id; });
    if (st.mode === 'shoot') ts = ts.concat(objTargets(u).filter(function (o) { return o.prop === 'barrel'; }).sort(function (a, c) { return Tac.hitInfo(st.b, u, c).chance - Tac.hitInfo(st.b, u, a).chance || a.y - c.y || a.x - c.x; })); // objects only after every unit
    var i = ts.map(function (t) { return t.id; }).indexOf(st.aim);
    st.aim = ts[(i + dir + ts.length) % ts.length].id;
    hud(); hoverPanel();
  }

  function pickAbility(id) {
    var u = selUnit(); if (!canInput() || !u) return;
    var why = Tac.abilityBlock(st.b, u, id); if (why) return;
    if (st.mode !== id && !allowed('arm', id)) return;
    var A = D.abilities[id];
    if (st.mode === id && confirmMode(u, id, A)) return;
    st.mode = id; st.aim = null;
    if (A.target === 'enemy') {
      var ts = Tac.targets(st.b, u, id).map(function (t) { return { t: t, c: Tac.hitInfo(st.b, u, t).chance }; }).sort(function (a, c) { return hackedLast(a.t, c.t) || c.c - a.c; });
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
      var ao = id === 'shoot' && aimObject();
      if (ao && objTarget(u, ao.x, ao.y)) { runObject(ao); return true; }
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
    if (!allowed('fire', id, a1)) return;
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
  // Overwatch all / Hunker all: every unit of yours with AP left that can take that order, after an "are you sure?",
  // then the turn ends.
  function overwatchAll() { groupOrder('overwatch', 'overwatchAll', 'Overwatch all', 'go on overwatch', 'goes on overwatch'); }
  function hunkerAll() { groupOrder('hunker', 'hunkerAll', 'Hunker all', 'hunker down', 'hunkers down'); }
  function groupOrder(id, kind, title, many, one) {
    if (!canInput() || !allowed(kind)) return;
    var b = st.b, list = b.units.filter(function (u) { return u.alive && u.side === HS() && !u.isStatic && u.ap > 0 && !Tac.abilityBlock(b, u, id); });
    if (!list.length) { XG.UI.modal('<h1>' + title + '</h1><p>No one can ' + many + ' right now.</p><div class="modal-actions"><button class="primary" id="owa-no">OK</button></div>'); $('owa-no').onclick = XG.UI.closeModal; $('owa-no').focus(); return; }
    st.mode = null; st.aim = null; hud();
    XG.UI.modal('<h1>' + title + '?</h1><p>Are you sure? <b>' + list.length + '</b> unit' + (list.length > 1 ? 's ' + many : ' ' + one) + ', then your turn ends: ' +
      list.map(function (u) { return u.short || u.name; }).join(', ') + '.</p>' +
      '<div class="modal-actions"><button id="owa-no">Cancel (Esc)</button><button class="primary" id="owa-yes">' + title + ' (Space)</button></div>');
    $('owa-no').onclick = XG.UI.closeModal;
    $('owa-yes').onclick = function () {
      XG.UI.closeModal();
      list.forEach(function (u) { if (u.alive && u.ap > 0) { var ev = Tac.act[id](st.b, u); if (ev) enqueue(ev); } });
      endTurn(true); // the order's events play first, then the other side moves
    };
    $('owa-yes').focus(); // Space / Enter press the focused button
  }
  function overclock() {
    var u = selUnit(); if (!canInput() || !u || !allowed('overclock')) return;
    var ev = Tac.act.overclock(st.b, u); if (ev) { enqueue(ev); hud(); }
  }
  // force: end it even while events are still queued (Overwatch all ends the turn behind its own events).
  function endTurn(force) {
    if (force !== true && (!canInput() || !allowed('end'))) return;
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
      if (e.t === 'dmg' || (u && u.side === HS()) || b.visible[e.y * W + e.x]) floater(e.x, e.y, (e.t === 'dmg' ? '-' : '+') + e.amount + (e.crit ? ' CRIT' : ''), e.t === 'heal' ? '#7dff9b' : e.crit ? '#ffd166' : '#ff6b85', now);
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
    while (!st.cur && st.queue.length) {
      var nx0 = st.queue[0];
      if (!nx0.camDone) { nx0.camDone = true; if (focusTiles(eventTiles(nx0))) { st.cur = { e: { t: 'camwait' }, t0: now, end: now + 260 }; break; } }
      begin(st.queue.shift(), now);
    }
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
        st.sel = firstReady(); st.mode = null; st.aim = null; // every turn starts on the leader
        var lu = selUnit(); if (lu) focusTiles([[lu.x, lu.y]]);
        hud();
      }
      return;
    }
    if (st.dirty) {
      st.dirty = false;
      var u = selUnit();
      if (!u || u.ap <= 0) { var nx = firstReady(); if (nx && nx !== st.sel) { st.sel = nx; var nu = selUnit(); if (nu) focusTiles([[nu.x, nu.y]]); } }
      hud(); hoverPanel();
    }
  }

  // Restart the mission from turn 1: same map, squad and enemies, new spawn points. Nothing from the abandoned attempt counts.
  function restart() {
    if (!st || !st.snap) return;
    var nb = JSON.parse(st.snap);
    nb.rng = Object.assign(new XG.RNG(1), nb.rng);
    Tac.redeploy(nb); // same map, units and HP; both squads land on new spots (also resets fog and sight caches)
    XG.UI.closeModal();
    startWith(st.g, nb, st.onDone, st.snap);
  }

  function finishBattle() {
    st.finished = true;
    syncLog(); hud();
    var b = st.b, o = b.outcome;
    var won = lat() ? XG.Lat.latticeWon(b.mission.lkind, o, b.mission.scenario) : o === 'win';
    XG.Audio.play(won ? 'victory' : 'defeat');
    if (XG.Comms) XG.Comms.battle(st.g, b, won ? 'win' : 'lose');
    setTimeout(function () {
      // node scenario: the headline names what happened to the server (captured, held), or the wipe that ended it
      var node = b.server && o !== 'abort', mineAtt = b.nodeAttacker === b.human;
      var head = b.training ? '<h1 class="good">TRAINING COMPLETE</h1>' : node && b.captured ? '<h1 class="' + (mineAtt ? 'good' : 'bad') + '">SERVER CAPTURED</h1>'
        : node && o === 'timeout' ? '<h1 class="' + (mineAtt ? 'bad' : 'good') + '">' + (mineAtt ? 'SERVER HELD: OUT OF TIME' : 'SERVER HELD') + '</h1>'
        : lat()
        ? (won ? '<h1 class="good">' + (b.mission.lkind === 'breach' ? 'SYSTEM BREACHED' : b.mission.lkind === 'strike' ? 'SAFEHOUSE HARMONIZED' : b.mission.lkind === 'uplink' ? 'UPLINK HOLDS' : b.mission.scenario === 'exterminate' ? 'SQUAD EXTERMINATED' : 'CELL HOLDS') + '</h1>'
          : o === 'abort' ? '<h1 class="warn">WITHDRAWN</h1>' : '<h1 class="bad">FORCES LOST</h1>')
        : o === 'win' ? '<h1 class="good">' + (b.mission.scenario === 'exterminate' || node ? 'HOSTILES EXTERMINATED' : 'OBJECTIVE COMPLETE') + '</h1>' : o === 'abort' ? '<h1 class="warn">EXTRACTION</h1>' : '<h1 class="bad">SQUAD WIPED</h1>';
      XG.UI.modal(head + '<p>' + b.mission.name + ' · turn ' + b.turn + '</p><div class="modal-actions">' + (st.snap ? '<button id="tac-again" title="Start over from turn 1: same map, squad, enemies and objectives, but both sides land on new spawn points and patrols take new routes. Nothing from this attempt counts.">Restart mission</button>' : '') + '<button class="primary" id="tac-done">Debrief ▸</button></div>');
      if ($('tac-again')) $('tac-again').onclick = restart;
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
    var scen = b.mission.scenario, z = Tac.zoneState(b), tl = ' · turn ' + b.turn + '/' + b.turnLimit;
    var obj = z ? (z.attacker === b.human ? 'Capture the server: ' + z.capture + '/' + z.need + tl : 'Hold the server' + (z.capture ? ' (lost ' + z.capture + '/' + z.need + ')' : '') + tl)
      : scen === 'exterminate' ? 'Exterminate: no time limit'
      : lat()
      ? { raid: 'Wipe the squad or hold until turn ' + b.turnLimit + ' ends', strike: 'Destroy the FIREWALL squad', breach: 'Purge the security software', uplink: 'Keep the Uplink Core alive' }[b.mission.lkind]
      : { purge: 'Eliminate all hostiles', relay: 'Destroy the Relay and all hostiles', uplink: 'Destroy the Uplink Core or Sever it (' + b.sever + '/3)' }[b.mission.kind];
    var left = b.units.filter(function (x) { return x.alive && x.side !== HS() && visibleUnit(x); }).length;
    countPanel();
    var mine = b.side === b.human;
    XG.Audio.intensity(left ? 1 : .15);
    // critical: hostiles in sight and half or more of your side is down
    var side = b.units.filter(function (x) { return x.side === b.human && !x.isStatic; }), up = side.filter(function (x) { return x.alive; }).length;
    XG.Audio.mood(left && up * 2 <= side.length ? 'critical' : left ? 'contact' : 'stealth');
    if (XG.Tutorial) XG.Tutorial.battleUpdate(b, u, st.mode, st.aim);
    $('tac-top').innerHTML = '<b>' + b.mission.name + '</b><span class="dim">' + b.mission.city + '</span><span class="obj">◎ ' + obj + '</span>' +
      '<span class="dim">' + (z ? '' : 'Turn ' + b.turn + (b.turnLimit ? '/' + b.turnLimit : '') + ' · ') + left + ' hostile(s) in sight</span>' +
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
      var name = id === 'grenade' && b.emp ? 'EMP Grenade' : A.short || A.name; // short label keeps the bar on one row
      ab += '<button data-ab="' + id + '" class="' + (st.mode === id ? 'on' : '') + '"' + (why || !canInput() ? ' disabled' : '') + ' title="' + A.name + ': ' + A.desc + (why ? ' — ' + why : '') + '"><span class="key">' + (i + 1) + '</span>' + name + extra + '</button>';
    });
    if (st.mode) ab += '<span class="dim ab-hint">' + modeHint() + '</span>';
    $('tac-abilities').innerHTML = ab;
    $('tac-abilities').querySelectorAll('[data-ab]').forEach(function (el) { el.onclick = function () { pickAbility(el.getAttribute('data-ab')); }; });

    var oc = $('tac-overclock');
    oc.classList.toggle('hidden', lat() || !(b.overclock > 0 || XG.Strat.has(st.g, 'halcyon')));
    oc.textContent = 'Overclock (' + b.overclock + ')';
    oc.disabled = !canInput() || !u || !u.sid || b.overclock <= 0 || u.overclocked;
    $('tac-endturn').disabled = !canInput();
    $('tac-endturn').classList.toggle('spent', allSpent());
    $('tac-endturn').innerHTML = allSpent() ? 'End Turn ␣' : 'End Turn ⏎';
    $('tac-endturn').title = allSpent() ? 'Everyone is out of AP: Space or Enter ends the turn' : 'End turn (Enter)';
    $('tac-owall').disabled = !canInput();
    $('tac-hkall').disabled = !canInput();
    $('tac-abort').disabled = !canInput();
    infoPanel(u);
  }
  // What Hunker Down buys: every visible hostile's chance to hit u now, and if u hunkers.
  function hunkerOdds(u) {
    var b = st.b, was = u.hunker, out = [];
    b.units.forEach(function (e) {
      if (!e.alive || e.side === HS() || e.isStatic || !b.visible[e.y * W + e.x]) return;
      u.hunker = false; var a = Tac.hitInfo(b, e, u); u.hunker = true; var h = Tac.hitInfo(b, e, u);
      if (a.ok) out.push({ e: e, now: a.chance, hunk: h.chance });
    });
    u.hunker = was;
    return out;
  }
  function modeHint() {
    var A = D.abilities[st.mode];
    var u = selUnit(), k = u ? u.abilities.indexOf(st.mode) + 1 : 0;
    if (st.mode === 'hunker' && u) {
      var ho = hunkerOdds(u), best = ho.reduce(function (m, o) { return o.now > m.now ? o : m; }, { now: -1 });
      return (best.now >= 0 ? 'Hunkered, the best shot on you drops from ' + best.now + '% to ' + best.hunk + '%. ' : 'No visible hostile has a shot at you right now. ') + 'Press ' + k + ' again or Space to confirm. Esc cancels.';
    }
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
      ((D.classes[u.kind] || u.origSide || u.short) ? '<div class="dim">' + (u.rank ? u.rank + ' ' : '') + (D.classes[u.kind] ? D.classes[u.kind].name : D.enemies[u.kind].name + (u.mark ? ' ' + D.latticeMarks[u.mark] : '') + (u.origSide ? ' (hijacked)' : '')) + '</div>' : '') +
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
      (hi.flankCrit ? '<tr><td colspan="2" class="good">Flanked: +25 crit</td></tr>' : '') + (hi.object ? '<tr><td colspan="2" class="dim">Object: no cover or defense, no crits</td></tr>' : '') + '</table>';
  }
  // The duel table for a hovered hostile: every hit-chance factor side by side, your shot at it and its shot at you,
  // then the result, crit, damage after armor and shields, and who can see whom. Same numbers as Tac.hitInfo.
  var DUEL_ROWS = [['aim', 'Aim'], ['cover', 'Cover'], ['def', 'Defense'], ['hunker', 'Hunkered'], ['close', 'Close range'],
    ['mark', 'Scan mark'], ['ow', 'Overwatch'], ['range', 'Range'], ['clamp', 'Floor / cap']];
  function duelKey(l) {
    return /^Aim|standoff/i.test(l) ? 'aim' : /cover/i.test(l) ? 'cover' : /defense/i.test(l) ? 'def' : /Hunker/.test(l) ? 'hunker'
      : /Close/.test(l) ? 'close' : /Marked/.test(l) ? 'mark' : /Overwatch/.test(l) ? 'ow' : /^Range/.test(l) ? 'range' : 'clamp';
  }
  function duel(u, f) {
    var b = st.b, out = Tac.hitInfo(b, u, f), back = Tac.hitInfo(b, f, u);
    var col = function (hi) { var m = {}; (hi.parts || []).forEach(function (p) { var k = duelKey(p[0]); m[k] = (m[k] || 0) + p[1]; if (/standoff/i.test(p[0])) m.standoff = 1; }); return m; };
    var A = col(out), B = col(back);
    var cell = function (hi, m, k) {
      if (!hi.ok) return '<td class="dim">–</td>';
      var v = m[k]; if (v === undefined) return '<td class="dim">0</td>';
      return '<td class="' + (k === 'aim' ? '' : v > 0 ? 'good' : 'bad') + '">' + (k !== 'aim' && v > 0 ? '+' : '') + v + (k === 'aim' && m.standoff ? '*' : '') + '</td>';
    };
    var cov = function (tx, ty, fx, fy) { var cd = Tac.coverDetail(b, tx, ty, fx, fy); if (!cd.base) return 'none, flanked';
      var s = cd.side ? SIDES.filter(function (o) { return o[0] === cd.side[0] && o[1] === cd.side[1]; })[0][3] : '';
      return (cd.base >= 40 ? 'full' : 'half') + ' ' + s + (cd.value < cd.base ? ' at ' + cd.angle + '°' : ''); };
    var dmg = function (a, t) { var lo = Math.max(1, a.dmg[0] - (t.armor || 0)), hi = Math.max(1, a.dmg[1] - (t.armor || 0)); return lo === hi ? '' + lo : lo + '–' + hi; };
    var rows = DUEL_ROWS.filter(function (r) { return r[0] === 'aim' || r[0] === 'cover' || r[0] === 'range' || A[r[0]] !== undefined || B[r[0]] !== undefined; });
    var h = '<table class="odds duel"><tr class="hd"><td>' + out.d.toFixed(1) + ' tiles</td><td>Your shot</td><td>Its shot</td></tr>' +
      rows.map(function (r) { return '<tr><td>' + r[1] + '</td>' + cell(out, A, r[0]) + cell(back, B, r[0]) + '</tr>'; }).join('') +
      '<tr class="tot"><td>Hit chance</td><td>' + (out.ok ? out.chance + '%' : '–') + '</td><td>' + (back.ok ? back.chance + '%' : '–') + '</td></tr>' +
      '<tr><td>Crit</td><td' + (out.flankCrit ? ' class="good"' : '') + '>' + (out.ok ? out.crit + '%' : '–') + '</td><td' + (back.flankCrit ? ' class="bad"' : '') + '>' + (back.ok ? back.crit + '%' : '–') + '</td></tr>' +
      '<tr><td>Damage</td><td>' + dmg(u, f) + (f.shield ? ' <span class="dim">+' + f.shield + ' sh</span>' : '') + '</td><td>' + dmg(f, u) + (u.shield ? ' <span class="dim">+' + u.shield + ' sh</span>' : '') + '</td></tr>' +
      '</table>';
    var notes = ['Its cover from you: ' + cov(f.x, f.y, u.x, u.y) + '. Your cover from it: ' + cov(u.x, u.y, f.x, f.y) + '.'];
    if (!out.ok) notes.push('You have no line of fire' + (out.d > u.range ? ' (out of range)' : '') + '.');
    if (!back.ok) notes.push('It has no shot at you' + (back.d > f.range ? ' (out of range)' : '') + '.');
    if (A.standoff || B.standoff) notes.push('* Corner standoff: both shots start from 50 instead of aim.');
    if (u.hunker) notes.push('You are hunkered: −25 to its shot.');
    if (out.flankCrit) notes.push('It is flanked: +25 crit for you.');
    if (back.flankCrit) notes.push('You are flanked: +25 crit for it.');
    return h + '<div class="duel-notes dim">' + notes.join('<br>') + '</div>';
  }
  function hoverPanel() {
    if (!st) return;
    var b = st.b, h = st.hover, u = selUnit(), html = '', ao = aimObject();
    if (ao) h = { x: ao.x, y: ao.y };
    var focus = st.aim && !ao ? Tac.unitById(b, st.aim) : h ? unitAtVisible(h.x, h.y) : null;
    if (focus && focus.alive) {
      html = '<b style="color:' + focus.color + '">' + focus.name + '</b><div>HP ' + focus.hp + '/' + focus.maxHp + (focus.armor ? ' · armor ' + focus.armor : '') + (focus.shield ? ' · shield ' + focus.shield : '') +
        (focus.side === b.human && !focus.isStatic ? ' · <span class="' + (focus.ap ? 'good' : 'dim') + '">' + focus.ap + ' AP left</span>' : '') + '</div>';
      if (focus.side !== b.human) {
        var E = D.enemies[focus.kind] || D.classes[focus.kind] || D.software[focus.kind];
        html += (focus.rank ? '<div class="dim">' + focus.rank + ' ' + E.name + '</div>' : '') + '<div class="dim">' + E.blurb + '</div>';
        if (focus.stunned) html += '<div class="good">Stunned (' + focus.stunned + ')</div>';
        if (focus.marked) html += '<div class="good">Marked by scan (+15 aim)</div>';
        if (focus.side === 'enemy' && !focus.alerted) html += '<div class="dim">Unaware of the squad.</div>';
        if (u) {
          var hi = Tac.hitInfo(b, u, focus);
          if (u.alive && u !== focus) html += duel(u, focus);
          else html += hi.ok ? '<div>' + (u.short || u.name) + ': <b>' + hi.chance + '%</b> to hit · ' + hi.crit + '% crit · ' + coverLabel(hi) + ' · ' + hi.d.toFixed(1) + ' tiles</div>' + breakdown(hi)
            : '<div class="dim">No line of fire from ' + (u.short || u.name) + '.</div>';
          if (u.hackSkill && focus.hackDef !== null && focus.hackDef !== undefined && !focus.isStatic)
            html += '<div class="good">Hack chance ' + Math.max(10, Math.min(90, u.hackSkill - focus.hackDef)) + '%' + (b.grammar ? ' (override)' : ' (stun)') + '</div>';
          if (focus.kind === 'core' && u.hackSkill) html += '<div class="good">Sever chance ' + Math.min(90, u.hackSkill + 10) + '% when adjacent</div>';
        }
      }
    } else if (h && Tac.isServer(b, h.x, h.y)) {
      var zh = Tac.zoneState(b), att = zh.attacker === b.human;
      html = '<b style="color:#7de3ff">Server node</b><div>Capture <b>' + zh.capture + '/' + zh.need + '</b> · turn ' + b.turn + '/' + b.turnLimit + '</div>' +
        '<div class="dim">' + (att ? 'End your turn with a unit within 1 tile of it and no hostile there to score a point.' : 'The attackers score a point when they end their turn beside it with none of yours there. Keep a unit in the zone.') +
        ' Cannot be shot or destroyed, gives no cover, and nobody can stand on it.</div>' +
        '<div>In the zone now: ' + (lat() ? 'Lattice ' + (zh.attacker === 'enemy' ? zh.att : zh.def) + ', FIREWALL ' + (zh.attacker === 'player' ? zh.att : zh.def) : 'squad ' + zh.att + ', Lattice ' + zh.def) + '</div>';
    } else if (h && h.x >= 0 && h.x < W && h.y >= 0 && h.y < H && !explored(h.x, h.y)) {
      html = '<b>Unexplored</b><div class="dim">Nobody has seen this ground yet.</div>';
    } else if (h && h.x >= 0 && h.x < W && h.y >= 0 && h.y < H) {
      var t = Tac.tile(b, h.x, h.y);
      var pn = XG.Gfx.propName(b, h.x, h.y);
      html = '<b>' + (pn || (t === Tac.PIT ? XG.Gfx.pitName(b) : ['Floor', 'Wall', 'Low cover', 'High cover'][t])) + '</b>' + (b.visible[h.y * W + h.x] ? '' : ' <span class="dim">(not in sight)</span>');
      var ob = explored(h.x, h.y) && Tac.objectAt(b, h.x, h.y);
      if (ob) { // a destructible object: durability; odds only for explosives (the only ones you can aim at)
        html += '<div>Durability <b>' + ob.hp + '/' + ob.maxHp + '</b>' + (ob.prop === 'barrel' ? ' <span class="warn">· explodes when destroyed</span>' : '') + '</div>';
        if (ob.prop === 'window') { /* the rule line below explains it */ }
        else if (ob.prop !== 'barrel') html += '<div class="dim">Breakable: missed shots at someone behind it can chip it, and blasts destroy it.</div>';
        else if (u && u.abilities.indexOf('shoot') >= 0 && canInput()) {
          var oh = Tac.hitInfo(b, u, ob);
          html += oh.ok ? '<div>' + (u.short || u.name) + ': <b>' + oh.chance + '%</b> to hit it · ' + oh.d.toFixed(1) + ' tiles</div>' + breakdown(oh) : '<div class="dim">No line of fire from ' + (u.short || u.name) + '.</div>';
        }
      }
      if (pn) html += '<div class="' + (Tac.propOf(b, h.x, h.y) === 'barrel' ? 'warn' : 'dim') + '">' + XG.Gfx.propRule(b, h.x, h.y) + (/^(window|frame)$/.test(Tac.propOf(b, h.x, h.y)) ? '.' : XG.DATA.props[Tac.propOf(b, h.x, h.y)] && XG.DATA.props[Tac.propOf(b, h.x, h.y)].faces ? '. The face toward the attacker counts.' : t === Tac.PIT ? '. Impassable, gives no cover, does not block line of sight.' : t === Tac.LOW ? '. Half cover.' : '. Full cover.') + '</div>';
      else if (t === Tac.PIT) html += '<div class="dim">Impassable. Gives no cover and does not block line of sight.</div>';
      if (t === Tac.WALL || t === Tac.HIGH || t === Tac.LOW) html += '<div class="' + (Tac.blocksFire(b, h.x, h.y) ? 'warn' : 'dim') + '">' + (b.faces && b.faces[h.y * W + h.x] ? 'Solid from its full sides (blocks sight and fire), fire-through over its half sides.'
        : Tac.blocksFire(b, h.x, h.y) ? 'Solid: blocks sight and fire. Lines that only graze its corner pass; otherwise lean round its end.' : 'Fire-through: ' + (t === Tac.HIGH ? 'full' : 'half') + ' cover, but it can be seen and shot over or through.') + '</div>';
      if (t === 0) {
        var cf = coverFacing(h.x, h.y), sides = SIDES.map(function (o) {
          var c = Tac.coverTile(b, h.x + o[0], h.y + o[1], o[0], o[1]), s = sideState(cf, o);
          var tag = s === 'idle' ? ' <span class="bad">(no use: faces no visible enemy)</span>' : s === 'fading' ? ' <span class="warn">(angled)</span>' : '';
          var what = c === 1 ? 'wall' : c === 3 ? 'high cover' : Tac.tile(b, h.x + o[0], h.y + o[1]) === 0 ? 'Sentinel' : 'crate', pnm = XG.Gfx.propName(b, h.x + o[0], h.y + o[1]);
          if (pnm) what = pnm.toLowerCase() + (Tac.propOf(b, h.x + o[0], h.y + o[1]) === 'barrel' ? ' <span class="warn">(explodes)</span>' : '');
          return c ? '<br>· ' + o[3] + ': ' + what + ', <b>' + (c === 2 ? 'half cover −20' : 'full cover −40') + '</b>' + tag : null;
        }).filter(Boolean);
        html += '<div class="dim">Cover here: ' + (sides.length ? sides.join('') : 'none') + '</div>';
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
  // Hostiles you have spotted at least once this battle, and how many of those are still up.
  function countPanel() {
    var b = st.b, found = 0, alive = 0;
    b.units.forEach(function (x) {
      if (x.side === HS()) return;
      if (x.alive && !st.hidden[x.id] && b.visible[x.y * W + x.x]) st.seen[x.id] = true;
      if (st.seen[x.id]) { found++; if (x.alive) alive++; }
    });
    $('tac-count').innerHTML = 'Hostiles alive / discovered: <b>' + alive + '/' + found + '</b>';
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
  // While nothing is animating and you haven't touched the mouse or keys for a moment, redraw less often: the ambient
  // shimmer doesn't need 60 fps, and a full-rate canvas loads the browser's shared GPU process (video in other tabs stalls).
  var lastInput = 0, IDLE_MS = 2000, LONG_IDLE_MS = 15000;
  if (typeof document !== 'undefined') ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(function (n) {
    document.addEventListener(n, function () { lastInput = performance.now(); }, { capture: true, passive: true });
  });
  function frame(now) {
    pump(now);
    if (!st) return;
    var camMoving = camStep(now);
    var busy = camMoving || st.cur || st.queue.length || st.fx.length || st.parts.length || st.floaters.length ||
      (st.shake && now - st.shake.t0 < 500) || (bannerEl && now - bannerEl.t0 < 2500);
    var quiet = now - lastInput, gap = busy || quiet < IDLE_MS ? 0 : quiet < LONG_IDLE_MS ? 33 : 83; // full, 30 fps, 12 fps
    if (gap && now - (st.lastDraw || 0) < gap - 4) return;
    st.lastDraw = now; draw(now);
  }

  function center(x, y) { return [x * TS + TS / 2, y * TS + TS / 2]; }
  // Labels sit above a unit; on the top row of the view there's no room, so they go below it instead.
  function labelY(c) { return c[1] - st.cam.y < TS ? c[1] + 58 : c[1]; }
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
    ctx.fillStyle = '#070d16'; ctx.fillRect(0, 0, VW, VH);
    var sh = shakeOffset(now), z = st.cam.z;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (sh[0] - st.cam.x * z), dpr * (sh[1] - st.cam.y * z)); // map px from here on
    // only the part of the baked terrain that is on screen (the full map is up to 3x the view)
    var tx0 = Math.max(0, Math.floor(st.cam.x)), ty0 = Math.max(0, Math.floor(st.cam.y));
    var tw = Math.min(W * TS - tx0, Math.ceil(VW / z) + 2), th = Math.min(H * TS - ty0, Math.ceil(VH / z) + 2);
    ctx.drawImage(G.terrain(b, dpr).canvas, tx0 * dpr, ty0 * dpr, tw * dpr, th * dpr, tx0, ty0, tw, th);
    G.ambient(ctx, b, now);
    G.damaged(ctx, b);
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
    G.motes(ctx, b, now);
    G.fog(ctx, b);

    var u = selUnit(), idle = canInput();
    // movement range + path preview
    if (u && idle && !st.mode && u.ap > 0) {
      var r = getReach(u);
      for (var i = 0; i < r.d.length; i++) {
        if (r.d[i] <= 0 || !explored(i % W, Math.floor(i / W))) continue;
        ctx.fillStyle = r.d[i] <= u.mobility && u.ap >= 1 ? 'rgba(79,209,255,.14)' : 'rgba(255,209,102,.06)';
        ctx.fillRect((i % W) * TS + 1, Math.floor(i / W) * TS + 1, TS - 2, TS - 2);
      }
      var h = st.hover;
      if (h && h.x >= 0 && h.x < W && h.y >= 0 && h.y < H && r.d[h.y * W + h.x] > 0) {
        var p = Tac.pathTo(r, h.x, h.y), dash = p.length > u.mobility;
        ctx.strokeStyle = dash ? '#ffd166' : '#4fd1ff'; ctx.lineWidth = 2; ctx.beginPath();
        var c0 = center(u.x, u.y); ctx.moveTo(c0[0], c0[1]);
        p.forEach(function (q) { var c = center(q[0], q[1]); ctx.lineTo(c[0], c[1]); }); ctx.stroke(); ctx.lineWidth = 1;
        if (explored(h.x, h.y)) { drawCoverCones(h.x, h.y); drawCoverShields(h.x, h.y); }
        drawMoveOdds(u, h.x, h.y);
      }
    }
    // ability target previews
    if (u && st.mode && idle) drawModePreview(u, now);

    // the node server (always drawn: both sides know where the objective is), then the units
    var zs = Tac.zoneState(b);
    if (zs) { var scn = center(zs.x, zs.y); G.server(ctx, zs, scn[0], scn[1], { now: now }); }
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

    XG.Tutorial.overlay(ctx, b, now);
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
      ctx.save(); ctx.translate(c[0], Math.max(st.cam.y + 16, c[1] - 24 - k * 28)); ctx.scale(pop, pop);
      ctx.font = 'bold ' + (big ? 17 : 13) + 'px "Share Tech Mono", monospace';
      ctx.globalAlpha = 1 - k * k; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0); ctx.restore();
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.vignette(ctx, VW, VH);
    if (bannerEl && now - bannerEl.t0 < 1300) G.banner(ctx, bannerEl.text, bannerEl.color, (now - bannerEl.t0) / 1300, VW, VH, now);
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
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(c[0] - w / 2, labelY(c) - 38, w, 15);
      ctx.fillStyle = !it.hi.ok ? '#7d8ea5' : o.dash ? 'rgba(255,209,102,.5)' : it.hi.cover === 0 ? XG.Gfx.pal().flank : '#ffd166';
      ctx.fillText(txt, c[0], labelY(c) - 26);
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

  // How each side's cover at (x, y) does against the hostiles you can see, by direction only (they can move
  // into range or around a wall): 'full' (blocks one head-on), 'fading' (only at an angle), 'idle' (faces none
  // of them). With no visible hostile at all, every side reads 'full' (nothing to judge it against). Cached.
  var SIDES = [[0, -1, 'N', 'North'], [1, 0, 'E', 'East'], [0, 1, 'S', 'South'], [-1, 0, 'W', 'West']];
  function coverFacing(x, y) {
    var b = st.b, key = [x, y, b.turn, b.log.length].join(',');
    if (st.facingCache && st.facingCache.key === key) return st.facingCache;
    var res = { key: key, threats: 0, side: {} };
    b.units.forEach(function (e) {
      if (!e.alive || e.side === HS() || e.isStatic || !e.range || st.hidden[e.id] || !b.visible[e.y * W + e.x]) return;
      res.threats++;
      var cd = Tac.coverDetail(b, x, y, e.x, e.y);
      if (!cd.side) return;
      var k = cd.side.join(','), cur = res.side[k], st2 = cd.value >= cd.base ? 'full' : 'fading';
      if (cur !== 'full') res.side[k] = st2;
    });
    st.facingCache = res;
    return res;
  }
  function sideState(f, o) { return !f.threats ? 'full' : f.side[o[0] + ',' + o[1]] || 'idle'; }
  // Faint cones around a tile with cover, one wedge per direction a shot could come from, using the same rule as
  // Tac.coverDetail: green = some side counts in full (within 30 degrees of head-on), yellow = it fades toward half
  // (out to about 63 degrees), red = nothing covers that direction (flanked). Sampled every 3 degrees.
  var CONE_COL = { full: '125,255,155', fading: '255,209,102', open: '255,107,133' };
  function coneClass(x, y, a) {
    var dx = Math.cos(a), dy = Math.sin(a), best = 'open';
    for (var i = 0; i < SIDES.length; i++) {
      var o = SIDES[i], along = o[0] ? dx * o[0] : dy * o[1], across = o[0] ? dy : dx;
      if (along <= 0 || along < Math.abs(across) / 2 - 1e-9 || Tac.coverTile(st.b, x + o[0], y + o[1], o[0], o[1]) === Tac.FLOOR) continue;
      if (Math.atan2(Math.abs(across), along) <= Math.PI / 6 + 1e-9) return 'full';
      best = 'fading';
    }
    return best;
  }
  function drawCoverCones(x, y) {
    if (!SIDES.some(function (o) { return Tac.coverTile(st.b, x + o[0], y + o[1]) !== Tac.FLOOR; })) return;
    var c = center(x, y), R = TS * 4.5, step = Math.PI / 60, a0 = 0, cls = coneClass(x, y, step / 2);
    var wedge = function (from, to, k) {
      ctx.fillStyle = 'rgba(' + CONE_COL[k] + ',' + (k === 'open' ? .05 : .09) + ')';
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.arc(c[0], c[1], R, from, to); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(' + CONE_COL[k] + ',.22)'; ctx.beginPath(); ctx.arc(c[0], c[1], R, from, to); ctx.stroke();
    };
    for (var a = step; a < Math.PI * 2 + step / 2; a += step) {
      var k = a < Math.PI * 2 ? coneClass(x, y, a + step / 2) : null;
      if (k !== cls) { wedge(a0, a, cls); a0 = a; cls = k; }
    }
  }
  function drawCoverShields(x, y) {
    var f = coverFacing(x, y);
    SIDES.forEach(function (o) {
      var t = Tac.coverTile(st.b, x + o[0], y + o[1], o[0], o[1]);
      if (t === 0) return;
      var full = t === Tac.WALL || t === Tac.HIGH, c = center(x, y), sx = c[0] + o[0] * 14, sy = c[1] + o[1] * 14, s = sideState(f, o);
      if (s === 'idle') return; // cover facing away from every enemy you can see is no cover at all
      var col = s === 'full' ? '79,209,255' : '255,209,102';
      ctx.beginPath(); ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy - 5); ctx.lineTo(sx + 5, sy); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 5, sy); ctx.closePath();
      ctx.fillStyle = 'rgba(' + col + ',.15)'; ctx.fill();
      // full cover: a solid shield; half cover: the lower half filled
      ctx.save(); ctx.clip(); ctx.fillStyle = 'rgb(' + col + ')'; ctx.fillRect(sx - 6, full ? sy - 6 : sy - 1, 12, full ? 13 : 8); ctx.restore();
      ctx.strokeStyle = 'rgb(' + col + ')'; ctx.stroke();
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
      if (st.mode === 'hunker') hunkerOdds(u).forEach(function (o) {
        var c = center(o.e.x, o.e.y), txt = o.now + '% → ' + o.hunk + '%';
        ctx.font = 'bold 12px "Share Tech Mono", monospace'; var w = ctx.measureText(txt).width + 10;
        ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(c[0] - w / 2, labelY(c) - 40, w, 16); ctx.fillStyle = '#4fd1ff'; ctx.fillText(txt, c[0], labelY(c) - 28);
        ctx.strokeStyle = 'rgba(79,209,255,.25)'; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(cs[0], cs[1]); ctx.stroke(); ctx.setLineDash([]);
      });
      return;
    }
    if (st.mode === 'shoot') objTargets(u).forEach(function (o) { // explosives in reach get a pulsing frame; other objects only when hovered or aimed
      var c = center(o.x, o.y), aimed = st.aim === o.id, hov = st.hover && st.hover.x === o.x && st.hover.y === o.y;
      if (o.prop !== 'barrel' && !aimed && !hov) return;
      ctx.strokeStyle = aimed ? '#ffd166' : o.prop === 'barrel' ? 'rgba(255,107,133,' + (.4 + pulse * .4) + ')' : 'rgba(255,209,102,.28)'; ctx.lineWidth = aimed ? 2.5 : 1.2;
      ctx.setLineDash([4, 4]); ctx.strokeRect(c[0] - 18, c[1] - 18, 36, 36); ctx.setLineDash([]);
      if (aimed || hov) {
        var oc = Tac.hitInfo(b, u, o).chance; ctx.font = 'bold ' + (aimed ? 15 : 12) + 'px "Share Tech Mono", monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillRect(c[0] - 18, c[1] - 36, 36, 15); ctx.fillStyle = '#ffd166'; ctx.fillText(oc + '%', c[0], c[1] - 24);
      }
      if (aimed) { var s0 = center(u.x, u.y); ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.setLineDash([]); }
      ctx.lineWidth = 1;
    });
    if (A.target === 'enemy' || A.target === 'ally') {
      Tac.targets(b, u, st.mode).forEach(function (t) {
        var c = center(t.x, t.y), aimed = st.aim === t.id;
        ctx.strokeStyle = A.target === 'ally' ? (aimed ? '#7dff9b' : 'rgba(125,255,155,' + (.35 + pulse * .4) + ')') : aimed ? '#ffd166' : 'rgba(255,209,102,' + (.35 + pulse * .4) + ')';
        ctx.lineWidth = aimed ? 2.5 : 1.5; ctx.beginPath(); ctx.arc(c[0], c[1], 18, 0, 7); ctx.stroke();
        if (A.target === 'enemy') {
          var ch = st.mode === 'hack' ? Math.max(10, Math.min(90, u.hackSkill - t.hackDef)) : st.mode === 'sever' ? Math.min(90, u.hackSkill + 10) : Tac.hitInfo(b, u, t).chance;
          ctx.font = 'bold ' + (aimed ? 15 : 12) + 'px "Share Tech Mono", monospace'; ctx.textAlign = 'center';
          ctx.fillStyle = '#000'; ctx.fillRect(c[0] - 18, labelY(c) - 36, 36, 15);
          ctx.fillStyle = '#ffd166'; ctx.fillText(ch + '%', c[0], labelY(c) - 24);
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
      facing: ang, now: now, alpha: alpha, flash: Math.max(0, fl), human: HS(), myTurn: st.b.side === HS(), top: st.cam.y, look: cursorMap(),
      hp: st.displayHp[x.id] !== undefined ? st.displayHp[x.id] : x.hp
    });
    var h = st.hover;
    if (h && h.x === pos[0] && h.y === pos[1] && x.alive && x.side === HS() && !x.isStatic && st.b.side === HS()) apPips(x, c);
  }
  // AP left on a hovered unit of yours: a little column of diamonds on the sprite's left (clear of the gun, the HP bar
  // and the neighbours' badges), filled = AP left, outlined = spent, read top to bottom.
  function apPips(x, c) {
    var n = Math.max(2, x.ap), gap = 8, px = c[0] - 18, y0 = c[1] - (n - 1) * gap / 2;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(px - 5, y0 - 6, 10, (n - 1) * gap + 12);
    for (var i = 0; i < n; i++) {
      var y = y0 + i * gap;
      ctx.beginPath(); ctx.moveTo(px, y - 3.5); ctx.lineTo(px + 3, y); ctx.lineTo(px, y + 3.5); ctx.lineTo(px - 3, y); ctx.closePath();
      if (i < x.ap) { ctx.fillStyle = i >= 2 ? '#ffd166' : '#4fd1ff'; ctx.fill(); } // a third (overclocked) AP shows gold
      else { ctx.strokeStyle = 'rgba(79,209,255,.4)'; ctx.lineWidth = 1; ctx.stroke(); }
    }
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
    var cm = function (k) { if (XG.Comms) XG.Comms.battle(st.g, b, k); };
    if (e.t === 'death' && u && !u.isStatic) cm(u.side === HS() ? 'loss' : 'kill');
    else if (e.t === 'dmg' && e.crit && u && u.side !== HS()) cm('crit');
    else if (e.t === 'hack' && Tac.unitById(b, e.from) && Tac.unitById(b, e.from).side === HS()) cm('hack');
    if (e.t === 'dmg') {
      st.flash[e.id] = now;
      if (e.crit) { shake(3, now); A.play('crit'); }
    } else if (e.t === 'heal') { if ((u && u.side === HS()) || seen(e.x, e.y)) { var hc = center(e.x, e.y); G.FX.heal(L, hc[0], hc[1], now); A.play('heal'); } } // the AI side heals in the fog too
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
    } else if (e.t === 'debris') { if (seen(e.x, e.y)) { var dc2 = center(e.x, e.y); G.FX.wreck(L, dc2[0], dc2[1], '150,150,160', now); G.FX.shatter(L, dc2[0], dc2[1], now); A.play('death-machine'); shake(2, now); }
    } else if (e.t === 'shatter') { if (seen(e.x, e.y)) { var gc = center(e.x, e.y); G.FX.shatter(L, gc[0], gc[1], now); A.play('shatter'); } }
    else if (e.t === 'spawn') { var sc = center(e.x, e.y); G.FX.warp(L, sc[0], sc[1], now); A.play('spawn'); }
    else if (e.t === 'scan') A.play('scan');
    else if (e.t === 'text' && seen(e.x, e.y)) {
      var tc = center(e.x, e.y);
      if (/SHIELD|AEGIS/.test(e.text)) { G.FX.shieldUp(L, tc[0], tc[1], now); A.play('shield'); }
      else if (e.text === '!') { G.FX.alert(L, tc[0], tc[1], now); A.play('alert'); }
      else if (/STUNNED|OVERRIDDEN/.test(e.text)) { G.FX.stun(L, tc[0], tc[1], now); A.play('stun'); }
      else if (e.text === 'OVERWATCH' || /^HUNKER/.test(e.text)) A.play('overwatch');
    } else if (e.t === 'shot' || e.t === 'hack') {
      faceTo(e.from, Math.atan2(e.ty - e.fy, e.tx - e.fx));
      var from = Tac.unitById(b, e.from), to = Tac.unitById(b, e.to);
      if ((from && from.side === HS()) || (to && to.side === HS()) || seen(e.fx, e.fy) || seen(e.tx, e.ty)) A.play(e.t === 'hack' ? 'hack' : 'shot-' + (e.kind || 'bullet'));
    }
  }

  // The tiles an event happens on, as far as the person can see them (the camera frames these before it plays).
  function eventTiles(e) {
    var b = st.b, vis = function (x, y) { return b.visible[y * W + x]; }, mine = function (id) { var u = Tac.unitById(b, id); return u && u.side === HS(); };
    if (e.t === 'move') return e.path.length > 1 ? e.path.filter(function (p, i) { return (mine(e.id) || vis(p[0], p[1])) && (i === 0 || i === e.path.length - 1 || !mine(e.id)); }) : [];
    if (e.t === 'shot' || e.t === 'hack') return mine(e.from) || mine(e.to) || vis(e.fx, e.fy) || vis(e.tx, e.ty) ? [[e.fx, e.fy], [e.tx, e.ty]] : [];
    if (e.t === 'boom' || e.t === 'shatter' || e.t === 'debris') return [[e.x, e.y]];
    if (e.t === 'text' || e.t === 'dmg' || e.t === 'heal' || e.t === 'death' || e.t === 'spawn' || e.t === 'scan') return (e.id && mine(e.id)) || vis(e.x, e.y) ? [[e.x, e.y]] : [];
    return [];
  }

  return { start: start, startWith: startWith, debug: function () { return st; }, tileToClient: tileToClient, centerOn: function (x, y) { if (st) centerOn(x, y, true); } };
})();
