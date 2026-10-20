// FIREWALL: tactical battle engine. Pure logic, no DOM. Every action returns an event list
// that the UI animates; the engine state is already final when the events come back.
var XG = globalThis.XG = globalThis.XG || {};

XG.Tac = (function () {
  var D = XG.DATA;
  var W = 22, H = 16, SIGHT = 11;
  var FLOOR = 0, WALL = 1, LOW = 2, HIGH = 3;

  // ------------------------------------------------------------ geometry
  function inB(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function tile(b, x, y) { return inB(x, y) ? b.tiles[y * W + x] : WALL; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }
  function sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function coverOf(t) { return t === WALL || t === HIGH ? 40 : t === LOW ? 20 : 0; }

  function unitAt(b, x, y) {
    for (var i = 0; i < b.units.length; i++) { var u = b.units[i]; if (u.alive && u.x === x && u.y === y) return u; }
    return null;
  }
  function free(b, x, y) { return inB(x, y) && tile(b, x, y) === FLOOR && !unitAt(b, x, y); }

  // Bresenham; walls always block, tall cover blocks unless it's next to either end (peeking).
  function lineClear(b, x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx + dy, x = x0, y = y0, sx0 = x0, sy0 = y0;
    while (!(x === x1 && y === y1)) {
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (x === x1 && y === y1) break;
      var t = tile(b, x, y);
      if (t === WALL) return false;
      if (t === HIGH && cheb(x, y, sx0, sy0) > 1 && cheb(x, y, x1, y1) > 1) return false;
    }
    return true;
  }
  function los(b, ax, ay, bx, by) { return lineClear(b, ax, ay, bx, by) || lineClear(b, bx, by, ax, ay); }

  // Directional cover: the cover tile on the side facing the attacker counts.
  function coverValue(b, tx, ty, fx, fy) {
    var ddx = fx - tx, ddy = fy - ty, best = 0;
    if (ddx !== 0 && Math.abs(ddx) >= Math.abs(ddy) / 2) best = Math.max(best, coverOf(tile(b, tx + sign(ddx), ty)));
    if (ddy !== 0 && Math.abs(ddy) >= Math.abs(ddx) / 2) best = Math.max(best, coverOf(tile(b, tx, ty + sign(ddy))));
    return best;
  }

  // BFS over 8 directions, no corner cutting. Returns dist array + prev for paths.
  function reach(b, u, maxSteps) {
    var n = W * H, d = new Array(n).fill(-1), prev = new Array(n).fill(-1), q = [u.y * W + u.x];
    d[q[0]] = 0;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi], cx = c % W, cy = (c - cx) / W;
      if (d[c] >= maxSteps) continue;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        if (!ox && !oy) continue;
        var nx = cx + ox, ny = cy + oy;
        if (!free(b, nx, ny)) continue;
        if (ox && oy && (tile(b, cx + ox, cy) !== FLOOR || tile(b, cx, cy + oy) !== FLOOR)) continue;
        var ni = ny * W + nx;
        if (d[ni] !== -1) continue;
        d[ni] = d[c] + 1; prev[ni] = c; q.push(ni);
      }
    }
    return { d: d, prev: prev };
  }
  function pathTo(r, x, y) {
    var i = y * W + x, p = [];
    if (r.d[i] < 0) return null;
    while (r.prev[i] !== -1) { p.unshift([i % W, (i - i % W) / W]); i = r.prev[i]; }
    return p;
  }
  function moveRange(u) { return u.ap >= 2 ? u.mobility * 2 : u.ap === 1 ? u.mobility : 0; }

  // -------------------------------------------------------------- map gen
  function genMap(b, rng) {
    for (var attempt = 0; attempt < 40; attempt++) {
      var t = new Array(W * H).fill(FLOOR), doors = {};
      var set = function (x, y, v) { if (inB(x, y)) t[y * W + x] = v; };
      var get = function (x, y) { return inB(x, y) ? t[y * W + x] : WALL; };
      var nb = rng.int(2, 4);
      for (var k = 0, placed = 0; k < 60 && placed < nb; k++) {
        var bw = rng.int(5, 8), bh = rng.int(4, 6), bx = rng.int(5, W - bw - 1), by = rng.int(1, H - bh - 1), ok = true;
        for (var yy = by - 1; yy <= by + bh && ok; yy++) for (var xx = bx - 1; xx <= bx + bw && ok; xx++) if (get(xx, yy) !== FLOOR) ok = false;
        if (!ok) continue;
        placed++;
        var per = [];
        for (var x2 = bx; x2 < bx + bw; x2++) for (var y2 = by; y2 < by + bh; y2++) {
          var edge = x2 === bx || y2 === by || x2 === bx + bw - 1 || y2 === by + bh - 1;
          if (!edge) continue;
          set(x2, y2, WALL);
          var corner = (x2 === bx || x2 === bx + bw - 1) && (y2 === by || y2 === by + bh - 1);
          if (!corner) per.push([x2, y2]);
        }
        rng.shuffle(per);
        for (var di = 0; di < rng.int(2, 3); di++) { set(per[di][0], per[di][1], FLOOR); doors[per[di][0] + ',' + per[di][1]] = 1; }
        if (bw > 5 && bh > 4) set(rng.int(bx + 2, bx + bw - 3), rng.int(by + 2, by + bh - 3), HIGH);
      }
      var nc = rng.int(16, 24);
      for (var c = 0; c < nc; c++) {
        var cx = rng.int(3, W - 1), cy = rng.int(0, H - 1), kind = rng.next();
        var cells = [];
        if (kind < 0.5) { var horiz = rng.next() < 0.5, len = rng.int(2, 3); for (var l = 0; l < len; l++) cells.push([cx + (horiz ? l : 0), cy + (horiz ? 0 : l), LOW]); }
        else if (kind < 0.8) cells.push([cx, cy, HIGH]);
        else { var h2 = rng.next() < 0.5; cells.push([cx, cy, HIGH], [cx + (h2 ? 1 : 0), cy + (h2 ? 0 : 1), HIGH]); }
        cells.forEach(function (cc) {
          if (get(cc[0], cc[1]) === FLOOR && !doors[cc[0] + ',' + cc[1]] && !doors[(cc[0] + 1) + ',' + cc[1]] && !doors[(cc[0] - 1) + ',' + cc[1]] &&
              !doors[cc[0] + ',' + (cc[1] + 1)] && !doors[cc[0] + ',' + (cc[1] - 1)]) set(cc[0], cc[1], cc[2]);
        });
      }
      // deployment zone with a little starting cover
      var mid = H >> 1;
      for (var sx = 0; sx < 3; sx++) for (var sy = mid - 3; sy <= mid + 3; sy++) set(sx, sy, FLOOR);
      set(3, mid - 2, LOW); set(3, mid + 2, LOW); set(3, mid - 1, FLOOR); set(3, mid, FLOOR); set(3, mid + 1, FLOOR);

      // connectivity
      var seen = new Array(W * H).fill(false), q = [mid * W + 1], cnt = 0, floors = 0;
      seen[q[0]] = true;
      for (var qi = 0; qi < q.length; qi++) {
        var ci = q[qi], qx = ci % W, qy = (ci - qx) / W; cnt++;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var nx = qx + o[0], ny = qy + o[1];
          if (inB(nx, ny) && !seen[ny * W + nx] && t[ny * W + nx] === FLOOR) { seen[ny * W + nx] = true; q.push(ny * W + nx); }
        });
      }
      t.forEach(function (v) { if (v === FLOOR) floors++; });
      if (cnt >= floors * 0.9) { b.tiles = t; b.reachable = seen; return; }
    }
    b.tiles = new Array(W * H).fill(FLOOR); b.reachable = new Array(W * H).fill(true);
  }

  // -------------------------------------------------------------- units
  function makeEnemy(b, type, x, y) {
    var E = D.enemies[type];
    var u = {
      id: b.nextId++, side: 'enemy', kind: type, name: E.name, glyph: E.glyph, color: E.color, x: x, y: y,
      hp: E.hp, maxHp: E.hp, armor: E.armor, aim: E.aim + (b.mission.diff - 1) * 2, mobility: E.mobility,
      dmg: E.dmg.slice(), range: E.range, close: 10, crit: 5, defense: E.defense, machine: !!E.machine,
      hackDef: E.hackDef, special: E.special || null, isStatic: !!E.static, spawn: E.spawn || null, spawned: 0,
      abilities: E.static ? [] : ['shoot'], charges: {}, cooldowns: {}, ap: 0, overwatch: false, hunker: false,
      shield: 0, marked: 0, stunned: 0, override: 0, alerted: false, kills: 0, alive: true, xp: E.xp
    };
    b.units.push(u);
    return u;
  }

  function makeSquadUnit(b, g, s, x, y) {
    var C = D.classes[s.cls], st = XG.State.stats(g, s);
    var ab = C.abilities.slice();
    if (s.cls === 'hacker' && b.mission.kind === 'uplink') ab.push('sever');
    var u = {
      id: b.nextId++, sid: s.id, side: 'player', kind: s.cls, name: s.name, short: shortName(s.name), glyph: C.glyph, color: C.color,
      rank: XG.State.rankName(s), x: x, y: y, hp: s.hp, maxHp: st.maxHp, armor: st.armor, aim: st.aim, mobility: st.mobility,
      dmg: st.dmg, range: st.range, close: st.close, crit: st.crit, defense: 0, machine: !!C.machine, hackSkill: st.hackSkill,
      abilities: ab, charges: { grenade: 1, medkit: 2 }, cooldowns: {}, ap: 2, overwatch: false, hunker: false,
      shield: 0, marked: 0, stunned: 0, override: 0, alerted: true, kills: 0, hacks: 0, alive: true
    };
    b.units.push(u);
    return u;
  }
  function shortName(n) { var m = n.match(/"([^"]+)"/); return m ? m[1] : n.split(' ')[0]; }

  var COMPOSITION = {
    1: ['drone', 'drone', 'drone'],
    2: ['drone', 'drone', 'warden', 'drone'],
    3: ['drone', 'drone', 'warden', 'harmonic', 'drone'],
    4: ['drone', 'warden', 'harmonic', 'drone', 'drone'],
    5: ['drone', 'warden', 'warden', 'harmonic', 'drone', 'drone']
  };

  // squad: array of soldier objects (already chosen). mission: strategy mission object.
  function create(g, mission, squad) {
    var rng = new XG.RNG(mission.seed || 12345);
    var b = {
      W: W, H: H, tiles: null, units: [], nextId: 1, turn: 1, side: 'player', rng: rng,
      mission: { kind: mission.kind, diff: mission.diff, name: mission.name, city: mission.city, site: mission.site },
      grammar: XG.Strat.has(g, 'lattice_grammar'), emp: !!g.flags.emp,
      overclock: XG.Strat.overclockCharges(g), visible: null, scans: [], sever: 0, outcome: null, salvage: 0, log: [],
      enemyQueue: []
    };
    genMap(b, rng);
    var mid = H >> 1, spots = [[1, mid], [1, mid - 1], [1, mid + 1], [0, mid - 2], [0, mid + 2], [2, mid], [0, mid]];
    squad.forEach(function (s, i) { makeSquadUnit(b, g, s, spots[i][0], spots[i][1]); });

    var R = b.reachable;
    var cand = [];
    for (var y = 0; y < H; y++) for (var x = 9; x < W; x++) if (R[y * W + x] && free(b, x, y)) cand.push([x, y]);
    rng.shuffle(cand);
    var list = (COMPOSITION[mission.diff] || COMPOSITION[5]).slice();
    if (mission.kind === 'relay') {
      list.pop();
      placeStatic(b, 'relay', cand, W - 6);
    } else if (mission.kind === 'uplink') {
      list = ['warden', 'harmonic', 'drone', 'drone'];
      placeStatic(b, 'core', cand, W - 5);
    }
    // pods of 2-3, centers spread out
    var centers = [], pods = [];
    while (list.length) pods.push(list.splice(0, list.length === 4 ? 2 : Math.min(3, list.length)));
    pods.forEach(function (pod) {
      var c = null;
      for (var i = 0; i < cand.length && !c; i++) {
        var p = cand[i];
        if (p[0] < 10 || !free(b, p[0], p[1])) continue;
        if (centers.every(function (o) { return dist(o[0], o[1], p[0], p[1]) >= 5; })) c = p;
      }
      c = c || cand.filter(function (p) { return free(b, p[0], p[1]); })[0];
      centers.push(c);
      pod.forEach(function (type) {
        var spot = nearestFree(b, c[0], c[1], 3);
        if (spot) makeEnemy(b, type, spot[0], spot[1]);
      });
    });
    refreshVis(b);
    log(b, [], 'Deployed: ' + b.mission.name + ' — ' + b.mission.city + '. ' + ({ purge: 'Eliminate all hostiles.', relay: 'Destroy the Relay and all hostiles.', uplink: 'Destroy or Sever the Uplink Core.' })[b.mission.kind], 'sys');
    return b;
  }
  function placeStatic(b, type, cand, minX) {
    var spot = cand.filter(function (p) {
      return p[0] >= minX && free(b, p[0], p[1]) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (o) { return free(b, p[0] + o[0], p[1] + o[1]); });
    })[0] || cand[0];
    var u = makeEnemy(b, type, spot[0], spot[1]);
    if (type === 'core') u.alerted = true;
    return u;
  }
  function nearestFree(b, x, y, r) {
    var best = null, bd = 1e9;
    for (var yy = y - r; yy <= y + r; yy++) for (var xx = x - r; xx <= x + r; xx++) {
      if (!free(b, xx, yy) || !b.reachable[yy * W + xx]) continue;
      var d = dist(x, y, xx, yy) + b.rng.next() * 0.3;
      if (d < bd) { bd = d; best = [xx, yy]; }
    }
    return best;
  }

  // -------------------------------------------------------- visibility
  function refreshVis(b) {
    var v = new Array(W * H).fill(false);
    b.units.forEach(function (u) {
      if (!u.alive || u.side !== 'player') return;
      for (var y = Math.max(0, u.y - SIGHT); y <= Math.min(H - 1, u.y + SIGHT); y++)
        for (var x = Math.max(0, u.x - SIGHT); x <= Math.min(W - 1, u.x + SIGHT); x++)
          if (!v[y * W + x] && dist(u.x, u.y, x, y) <= SIGHT && los(b, u.x, u.y, x, y)) v[y * W + x] = true;
    });
    b.scans.forEach(function (s) {
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (dist(s.x, s.y, x, y) <= s.r) v[y * W + x] = true;
    });
    b.visible = v;
  }
  function isVisible(b, u) { return u.side === 'player' || (b.visible && b.visible[u.y * W + u.x]); }

  function foesOf(b, u) {
    return b.units.filter(function (o) { return o.alive && o.side !== u.side; });
  }
  function sees(b, u, o) { return dist(u.x, u.y, o.x, o.y) <= SIGHT && los(b, u.x, u.y, o.x, o.y); }

  function alert(b, u, ev) {
    if (u.alerted || u.side !== 'enemy') return;
    u.alerted = true;
    var woke = 1;
    b.units.forEach(function (o) {
      if (o.alive && o.side === 'enemy' && !o.alerted && dist(o.x, o.y, u.x, u.y) <= 7) { o.alerted = true; woke++; }
    });
    if (isVisible(b, u)) ev.push({ t: 'text', x: u.x, y: u.y, text: '!', color: '#ff4d6d' });
    log(b, ev, 'Lattice pod activated (' + woke + ' contact' + (woke > 1 ? 's' : '') + ').', 'bad');
  }
  function checkAlerts(b, ev) {
    b.units.forEach(function (e) {
      if (!e.alive || e.side !== 'enemy' || e.alerted) return;
      foesOf(b, e).some(function (p) { if (sees(b, e, p)) { alert(b, e, ev); return true; } return false; });
    });
  }

  // ------------------------------------------------------------ combat
  function hitInfo(b, a, t, opts) {
    opts = opts || {};
    var d = dist(a.x, a.y, t.x, t.y);
    if (d > a.range || !los(b, a.x, a.y, t.x, t.y)) return { chance: 0, crit: 0, cover: 0, d: d, ok: false };
    var cov = coverValue(b, t.x, t.y, a.x, a.y);
    var ch = a.aim - cov - (t.defense || 0) - (t.hunker ? 25 : 0);
    if (d <= 3) ch += a.close || 0;
    if (t.marked > 0) ch += 15;
    if (opts.overwatch) ch -= 15;
    if (d > 10) ch -= Math.round((d - 10) * 3);
    if (t.isStatic) ch = Math.max(ch, 85);
    ch = Math.max(5, Math.min(95, Math.round(ch)));
    var crit = (a.crit || 0) + (cov === 0 && !t.isStatic ? 25 : 0);
    return { chance: ch, crit: Math.min(100, crit), cover: cov, d: d, ok: true };
  }

  function log(b, ev, msg, cls) {
    b.log.push({ turn: b.turn, msg: msg, cls: cls || '' });
    if (b.log.length > 200) b.log.shift();
    ev.push({ t: 'log', msg: msg, cls: cls || '' });
  }

  function damage(b, t, amount, ev, src, opts) {
    opts = opts || {};
    if (amount <= 0 || !t.alive) return;
    if (!opts.ignoreArmor && t.armor) amount = Math.max(1, amount - t.armor);
    if (t.shield > 0) {
      var ab = Math.min(t.shield, amount); t.shield -= ab; amount -= ab;
      ev.push({ t: 'text', x: t.x, y: t.y, text: 'SHIELD -' + ab, color: '#c792ff' });
    }
    if (amount > 0) {
      t.hp -= amount;
      ev.push({ t: 'dmg', id: t.id, x: t.x, y: t.y, amount: amount, hpAfter: Math.max(0, t.hp), crit: !!opts.crit });
    }
    if (t.side === 'enemy') alert(b, t, ev);
    if (t.hp <= 0) kill(b, t, ev, src, opts.cause);
  }

  function kill(b, t, ev, src, cause) {
    t.alive = false; t.hp = 0; t.overwatch = false;
    ev.push({ t: 'death', id: t.id, x: t.x, y: t.y });
    var credit = src && (src.creditTo ? unitById(b, src.creditTo) : src);
    if (credit && credit.side === 'player' && credit.sid && t.origSide !== 'player' && (t.side === 'enemy' || t.origSide === 'enemy')) credit.kills++;
    if (t.side === 'enemy' || t.origSide === 'enemy') b.salvage += (t.xp || 1) * 2;
    log(b, ev, t.name + (cause ? ' ' + cause : ' destroyed') + '.', t.side === 'player' && t.sid ? 'bad' : 'good');
    if (t.kind === 'core') { b.outcome = 'win'; log(b, ev, 'UPLINK CORE DESTROYED.', 'good'); }
  }
  function unitById(b, id) { return b.units.filter(function (u) { return u.id === id; })[0]; }

  function fire(b, a, t, ev, opts) {
    opts = opts || {};
    var hi = hitInfo(b, a, t, opts);
    if (!hi.ok) return false;
    var hit = b.rng.chance(hi.chance);
    var crit = hit && b.rng.chance(hi.crit);
    ev.push({ t: 'shot', from: a.id, to: t.id, fx: a.x, fy: a.y, tx: t.x, ty: t.y, hit: hit, kind: a.kind === 'sentinel' ? 'pulse' : a.side === 'enemy' ? 'lattice' : 'bullet' });
    var tag = (opts.overwatch ? 'Overwatch: ' : '') + (a.short || a.name) + ' → ' + (t.short || t.name) + ' (' + hi.chance + '%)';
    if (!hit) {
      ev.push({ t: 'text', x: t.x, y: t.y, text: 'MISS', color: '#9aa7b8' });
      log(b, ev, tag + ': miss.', '');
      if (t.side === 'enemy') alert(b, t, ev);
      return true;
    }
    var dmg = b.rng.int(a.dmg[0], a.dmg[1]) + (crit ? 2 : 0);
    log(b, ev, tag + ': ' + (crit ? 'CRIT ' : 'hit ') + dmg + '.', a.side === 'player' ? 'good' : 'bad');
    damage(b, t, dmg, ev, a, { crit: crit });
    return true;
  }

  // reaction fire for each step of a move
  function reactions(b, mover, ev) {
    b.units.forEach(function (o) {
      if (!mover.alive || !o.alive || !o.overwatch || o.side === mover.side || o.stunned) return;
      if (mover.isStatic) return;
      var hi = hitInfo(b, o, mover, { overwatch: true });
      if (!hi.ok) return;
      o.overwatch = false;
      fire(b, o, mover, ev, { overwatch: true });
    });
  }

  // ------------------------------------------------------------ outcome
  function checkOutcome(b) {
    if (b.outcome) return b.outcome;
    if (b.mission.kind === 'uplink' && b.sever >= 3) b.outcome = 'win';
    var squadAlive = b.units.some(function (u) { return u.alive && u.sid; });
    var enemies = b.units.some(function (u) { return u.alive && u.side === 'enemy'; });
    if (!squadAlive) b.outcome = 'loss';
    else if (!enemies && b.mission.kind !== 'uplink') b.outcome = 'win';
    return b.outcome;
  }
  function after(b, ev) { refreshVis(b); checkAlerts(b, ev); checkOutcome(b); return ev; }

  // ------------------------------------------------------------ abilities
  function canAct(b, u) { return u.alive && u.side === 'player' && b.side === 'player' && !b.outcome && u.ap > 0; }

  // Returns null if usable, or a reason string.
  function abilityBlock(b, u, id) {
    var A = D.abilities[id];
    if (!u.alive) return 'Down';
    if (u.ap <= 0) return 'No AP left';
    if (A.charges && (u.charges[id] || 0) <= 0) return 'No charges';
    if (u.cooldowns[id] > 0) return 'Cooldown ' + u.cooldowns[id];
    var ts = targets(b, u, id);
    if (A.target !== 'self' && A.target !== 'tile' && !ts.length) return 'No valid target';
    return null;
  }

  function targets(b, u, id) {
    var A = D.abilities[id];
    if (u.abilities.indexOf(id) < 0) return [];
    if (A.target === 'enemy') {
      return foesOf(b, u).filter(function (t) {
        if (!isVisible(b, t) && u.side === 'player') return false;
        if (id === 'shoot') return hitInfo(b, u, t).ok;
        if (id === 'hack') return t.machine && t.hackDef !== null && t.hackDef !== undefined && !t.isStatic &&
          dist(u.x, u.y, t.x, t.y) <= A.range && los(b, u.x, u.y, t.x, t.y);
        if (id === 'sever') return t.kind === 'core' && cheb(u.x, u.y, t.x, t.y) <= 1;
        return false;
      });
    }
    if (A.target === 'ally') {
      return b.units.filter(function (t) {
        if (!t.alive || t.side !== u.side) return false;
        if (id === 'medkit') return !t.machine && t.hp < t.maxHp && cheb(u.x, u.y, t.x, t.y) <= 1;
        if (id === 'shield') return t.id === u.id || (dist(u.x, u.y, t.x, t.y) <= A.range && los(b, u.x, u.y, t.x, t.y));
        return false;
      });
    }
    return [];
  }

  function tileOk(b, u, id, x, y) {
    var A = D.abilities[id];
    if (!inB(x, y) || dist(u.x, u.y, x, y) > A.range) return false;
    if (id === 'grenade') return b.visible[y * W + x];
    return true;
  }

  // Every successful hack (stun, override or sever) permanently adds +1 to the hacker's hack skill.
  function learnHack(b, u, ev) {
    u.hacks++; u.hackSkill++;
    log(b, ev, u.short + ' learns from the intrusion: hack skill ' + u.hackSkill + ' (+1).', 'good');
  }

  function spend(u, id) {
    var A = D.abilities[id];
    if (A.charges) u.charges[id]--;
    if (A.cooldown) u.cooldowns[id] = A.cooldown;
    if (A.ends) u.ap = 0; else u.ap--;
  }

  // Walk a path one tile at a time so overwatch and pod alerts can interrupt it.
  function doMove(b, u, x, y) {
    if (u.ap <= 0) return null;
    var r = reach(b, u, moveRange(u)), path = pathTo(r, x, y);
    if (!path || !path.length) return null;
    var ev = [], seg = [[u.x, u.y]];
    u.ap -= path.length <= u.mobility ? 1 : 2;
    for (var i = 0; i < path.length && u.alive && !b.outcome; i++) {
      u.x = path[i][0]; u.y = path[i][1]; seg.push(path[i]);
      var sub = [];
      reactions(b, u, sub);
      refreshVis(b); checkAlerts(b, sub); checkOutcome(b);
      if (sub.length) {
        ev.push({ t: 'move', id: u.id, path: seg }); seg = [[u.x, u.y]];
        Array.prototype.push.apply(ev, sub);
      }
    }
    if (seg.length > 1) ev.push({ t: 'move', id: u.id, path: seg });
    return after(b, ev);
  }

  var act = {
    move: function (b, u, x, y) {
      if (!canAct(b, u)) return null;
      return doMove(b, u, x, y);
    },

    shoot: function (b, u, t) {
      if (!canAct(b, u) || targets(b, u, 'shoot').indexOf(t) < 0) return null;
      var ev = []; spend(u, 'shoot'); fire(b, u, t, ev); return after(b, ev);
    },
    overwatch: function (b, u) {
      if (!canAct(b, u)) return null;
      var ev = []; spend(u, 'overwatch'); u.overwatch = true;
      ev.push({ t: 'text', x: u.x, y: u.y, text: 'OVERWATCH', color: '#4fd1ff' });
      log(b, ev, u.short + ' is on overwatch.', ''); return after(b, ev);
    },
    hunker: function (b, u) {
      if (!canAct(b, u)) return null;
      var ev = []; spend(u, 'hunker'); u.hunker = true;
      ev.push({ t: 'text', x: u.x, y: u.y, text: 'HUNKER', color: '#4fd1ff' });
      log(b, ev, u.short + ' hunkers down.', ''); return after(b, ev);
    },
    grenade: function (b, u, x, y) {
      if (!canAct(b, u) || abilityBlock(b, u, 'grenade') || !tileOk(b, u, 'grenade', x, y)) return null;
      var ev = [], emp = b.emp; spend(u, 'grenade');
      ev.push({ t: 'boom', fx: u.x, fy: u.y, x: x, y: y, r: 1, kind: emp ? 'emp' : 'frag' });
      log(b, ev, u.short + ' throws ' + (emp ? 'an EMP' : 'a frag') + ' grenade.', '');
      var hitList = b.units.filter(function (t) { return t.alive && cheb(t.x, t.y, x, y) <= 1; });
      hitList.forEach(function (t) {
        var d = emp ? (t.side === 'enemy' && t.machine ? 5 : t.machine ? 2 : 0) : 3;
        damage(b, t, d, ev, u, { ignoreArmor: emp });
      });
      if (!emp) for (var yy = y - 1; yy <= y + 1; yy++) for (var xx = x - 1; xx <= x + 1; xx++) {
        var tt = tile(b, xx, yy);
        if (tt === LOW || tt === HIGH) b.tiles[yy * W + xx] = FLOOR;
      }
      return after(b, ev);
    },
    hack: function (b, u, t) {
      if (!canAct(b, u) || targets(b, u, 'hack').indexOf(t) < 0) return null;
      var ev = [], chance = Math.max(10, Math.min(90, u.hackSkill - t.hackDef)); spend(u, 'hack');
      ev.push({ t: 'hack', from: u.id, to: t.id, fx: u.x, fy: u.y, tx: t.x, ty: t.y });
      if (b.rng.chance(chance)) {
        learnHack(b, u, ev);
        if (b.grammar) {
          t.side = 'player'; t.origSide = 'enemy'; t.override = 2; t.ap = 2; t.overwatch = false; t.creditTo = u.id;
          t.short = t.name.split(' ')[1] || t.name; t.color = '#7dff9b';
          ev.push({ t: 'text', x: t.x, y: t.y, text: 'OVERRIDDEN', color: '#7dff9b' });
          log(b, ev, u.short + ' overrides the ' + t.name + ' (' + chance + '%). It fights for us for 2 turns.', 'good');
        } else {
          t.stunned = 2;
          ev.push({ t: 'text', x: t.x, y: t.y, text: 'STUNNED', color: '#7dff9b' });
          log(b, ev, u.short + ' crashes the ' + t.name + ' (' + chance + '%). Stunned 2 turns.', 'good');
        }
        alert(b, t.side === 'enemy' ? t : u, ev);
      } else {
        ev.push({ t: 'text', x: t.x, y: t.y, text: 'HACK FAILED', color: '#9aa7b8' });
        log(b, ev, u.short + '\'s hack bounces off (' + chance + '%).', '');
        alert(b, t, ev);
      }
      return after(b, ev);
    },
    medkit: function (b, u, t) {
      if (!canAct(b, u) || abilityBlock(b, u, 'medkit') || targets(b, u, 'medkit').indexOf(t) < 0) return null;
      var ev = [], amt = Math.min(4, t.maxHp - t.hp); spend(u, 'medkit'); t.hp += amt;
      ev.push({ t: 'heal', id: t.id, x: t.x, y: t.y, amount: amt, hpAfter: t.hp });
      log(b, ev, u.short + ' patches up ' + t.short + ' (+' + amt + ').', 'good'); return after(b, ev);
    },
    scan: function (b, u, x, y) {
      if (!canAct(b, u) || abilityBlock(b, u, 'scan') || !tileOk(b, u, 'scan', x, y)) return null;
      var ev = [], n = 0; spend(u, 'scan');
      b.scans.push({ x: x, y: y, r: 5, turns: 2 });
      b.units.forEach(function (t) { if (t.alive && t.side === 'enemy' && dist(t.x, t.y, x, y) <= 5) { t.marked = 2; n++; } });
      ev.push({ t: 'scan', x: x, y: y, r: 5 });
      log(b, ev, u.short + ' runs a sensor scan: ' + n + ' hostile' + (n === 1 ? '' : 's') + ' marked.', n ? 'good' : ''); return after(b, ev);
    },
    shield: function (b, u, t) {
      if (!canAct(b, u) || abilityBlock(b, u, 'shield') || targets(b, u, 'shield').indexOf(t) < 0) return null;
      var ev = []; spend(u, 'shield'); t.shield = Math.max(t.shield, 3);
      ev.push({ t: 'text', x: t.x, y: t.y, text: 'AEGIS +3', color: '#c792ff' });
      log(b, ev, u.short + ' projects an Aegis shield onto ' + (t.short || t.name) + '.', 'good'); return after(b, ev);
    },
    sever: function (b, u, t) {
      if (!canAct(b, u) || targets(b, u, 'sever').indexOf(t) < 0) return null;
      var ev = [], chance = Math.min(90, u.hackSkill + 10); spend(u, 'sever');
      ev.push({ t: 'hack', from: u.id, to: t.id, fx: u.x, fy: u.y, tx: t.x, ty: t.y });
      if (b.rng.chance(chance)) {
        learnHack(b, u, ev);
        b.sever++;
        ev.push({ t: 'text', x: t.x, y: t.y, text: 'SEVER ' + b.sever + '/3', color: '#7dff9b' });
        log(b, ev, u.short + ' cuts an uplink trunk (' + b.sever + '/3).', 'good');
        if (b.sever >= 3) log(b, ev, 'UPLINK SEVERED.', 'good');
      } else {
        ev.push({ t: 'text', x: t.x, y: t.y, text: 'REJECTED', color: '#9aa7b8' });
        log(b, ev, 'The core rejects ' + u.short + '\'s intrusion (' + chance + '%).', '');
      }
      return after(b, ev);
    },
    overclock: function (b, u) {
      if (!u.alive || !u.sid || b.side !== 'player' || b.outcome || b.overclock <= 0 || u.overclocked) return null;
      var ev = []; b.overclock--; u.overclocked = true; u.ap += 1;
      ev.push({ t: 'text', x: u.x, y: u.y, text: 'OVERCLOCK +1 AP', color: '#c792ff' });
      log(b, ev, 'HALCYON overclocks ' + u.short + ' (+1 AP).', 'good'); return after(b, ev);
    }
  };

  // Abilities are only usable by units that actually have them.
  Object.keys(act).forEach(function (id) {
    if (id === 'move' || id === 'overclock') return;
    var fn = act[id];
    act[id] = function (b, u, a1, a2) { return u && u.abilities.indexOf(id) >= 0 ? fn(b, u, a1, a2) : null; };
  });

  // ------------------------------------------------------------ turns
  function endPlayerTurn(b) {
    if (b.side !== 'player' || b.outcome) return [];
    var ev = [];
    b.units.forEach(function (u) {
      if (!u.alive || !u.override) return;
      if (--u.override <= 0) { u.side = 'enemy'; kill(b, u, ev, null, 'is purged by the Lattice'); }
    });
    b.side = 'enemy';
    b.units.forEach(function (u) {
      if (!u.alive || u.side !== 'enemy') return;
      u.hunker = false; u.overwatch = false;
      Object.keys(u.cooldowns).forEach(function (k) { if (u.cooldowns[k] > 0) u.cooldowns[k]--; });
      if (u.stunned > 0) { u.stunned--; u.ap = 0; } else u.ap = 2;
    });
    checkAlerts(b, ev);
    b.enemyQueue = b.units.filter(function (u) { return u.alive && u.side === 'enemy'; })
      .sort(function (a, c) { return (c.isStatic ? 1 : 0) - (a.isStatic ? 1 : 0); }).map(function (u) { return u.id; });
    log(b, ev, '— Lattice turn —', 'sys');
    return after(b, ev);
  }

  // One enemy acts. Returns events, or null when the enemy turn is over (player turn started).
  function enemyStep(b) {
    if (b.outcome) return null;
    while (b.enemyQueue.length) {
      var u = unitById(b, b.enemyQueue.shift());
      if (!u || !u.alive || u.side !== 'enemy') continue;
      var ev = ai(b, u);
      return after(b, ev);
    }
    startPlayerTurn(b);
    return null;
  }

  function startPlayerTurn(b) {
    b.side = 'player'; b.turn++;
    b.units.forEach(function (u) {
      if (!u.alive) return;
      if (u.side === 'player') {
        u.ap = 2; u.overwatch = false; u.hunker = false; u.overclocked = false;
        Object.keys(u.cooldowns).forEach(function (k) { if (u.cooldowns[k] > 0) u.cooldowns[k]--; });
      } else if (u.marked > 0) u.marked--;
    });
    b.scans = b.scans.filter(function (s) { return --s.turns > 0; });
    log(b, [], '— Turn ' + b.turn + ' —', 'sys');
    refreshVis(b);
  }

  // ------------------------------------------------------------ AI
  // Works for either side, so tests can auto-play the squad too.
  function ai(b, u) {
    var ev = [];
    if (u.isStatic) return spawnTick(b, u, ev);
    if (u.side === 'enemy' && !u.alerted) return ev;
    var guard = 0;
    while (u.ap > 0 && u.alive && !b.outcome && guard++ < 4) {
      var foes = foesOf(b, u);
      if (!foes.length) break;
      if (u.special === 'spike' && !u.cooldowns.spike) {
        var st = foes.filter(function (f) { return !f.isStatic && dist(u.x, u.y, f.x, f.y) <= 14 && los(b, u.x, u.y, f.x, f.y); })
          .sort(function (a, c) { return a.hp - c.hp; })[0];
        if (st) {
          u.cooldowns.spike = 3; u.ap = 0;
          ev.push({ t: 'shot', from: u.id, to: st.id, fx: u.x, fy: u.y, tx: st.x, ty: st.y, hit: true, kind: 'spike' });
          log(b, ev, u.name + ' fires a Data Spike at ' + (st.short || st.name) + ' (ignores cover).', 'bad');
          damage(b, st, 3, ev, u, {});
          break;
        }
      }
      var best = bestShot(b, u, foes);
      var threshold = u.ap >= 2 ? 50 : 20;
      if (best && best.score >= threshold) { u.ap = 0; fire(b, u, best.t, ev); break; }
      var dest = bestTile(b, u, foes);
      if (!dest) { if (best && best.hi.chance >= 10) { u.ap = 0; fire(b, u, best.t, ev); } else u.ap = 0; break; }
      var mev = doMove(b, u, dest[0], dest[1]);
      if (!mev) { u.ap = 0; break; }
      Array.prototype.push.apply(ev, mev);
    }
    return ev;
  }
  function bestShot(b, u, foes) {
    var best = null;
    foes.forEach(function (t) {
      var hi = hitInfo(b, u, t);
      if (!hi.ok) return;
      var score = hi.chance + (t.hp <= u.dmg[1] ? 15 : 0) + (t.isStatic ? -10 : 0);
      if (!best || score > best.score) best = { t: t, hi: hi, score: score };
    });
    return best;
  }
  function tileScore(b, u, foes, x, y) {
    var ox = u.x, oy = u.y; u.x = x; u.y = y;
    var near = 1e9, s = 0, shot = 0, flanked = false;
    foes.forEach(function (f) {
      var d = dist(x, y, f.x, f.y); if (d < near) near = d;
      if (f.isStatic) return;
      if (los(b, f.x, f.y, x, y) && d <= SIGHT && coverValue(b, x, y, f.x, f.y) === 0) flanked = true;
      var hi = hitInfo(b, u, f); if (hi.ok && hi.chance > shot) shot = hi.chance;
    });
    var nf = foes.filter(function (f) { return !f.isStatic; }).sort(function (a, c) { return dist(x, y, a.x, a.y) - dist(x, y, c.x, c.y); })[0] || foes[0];
    s += coverValue(b, x, y, nf.x, nf.y);
    s += shot > 0 ? 20 + shot * 0.6 : -near * 3;
    if (flanked) s -= 15;
    if (near < 2) s -= 8;
    u.x = ox; u.y = oy;
    return s + b.rng.next() * 3;
  }
  function bestTile(b, u, foes) {
    var r = reach(b, u, u.mobility), best = null, bs = tileScore(b, u, foes, u.x, u.y) + 4;
    for (var i = 0; i < r.d.length; i++) {
      if (r.d[i] <= 0) continue;
      var x = i % W, y = (i - x) / W, s = tileScore(b, u, foes, x, y);
      if (s > bs) { bs = s; best = [x, y]; }
    }
    if (!best) {
      // nothing better nearby: if no shot either, march toward the nearest foe using a long BFS
      var hasShot = foes.some(function (f) { return hitInfo(b, u, f).ok; });
      if (hasShot) return null;
      var far = reach(b, u, 60), tgt = foes[0], bd = 1e9, step = null;
      foes.forEach(function (f) { var d = dist(u.x, u.y, f.x, f.y); if (d < bd) { bd = d; tgt = f; } });
      var cb = 1e9;
      for (var j = 0; j < far.d.length; j++) {
        if (far.d[j] <= 0) continue;
        var jx = j % W, jy = (j - jx) / W, dd = dist(jx, jy, tgt.x, tgt.y);
        if (dd < cb) { cb = dd; step = [jx, jy]; }
      }
      if (!step) return null;
      var p = pathTo(far, step[0], step[1]);
      if (!p || !p.length) return null;
      return p[Math.min(p.length, u.mobility) - 1];
    }
    return best;
  }

  function spawnTick(b, u, ev) {
    var sp = u.spawn;
    if (!sp || (!u.alerted && u.kind !== 'core')) return ev;
    var make = function (type) {
      var spot = nearestFree(b, u.x, u.y, 2);
      if (!spot || u.spawned >= sp.max) return;
      var e = makeEnemy(b, type, spot[0], spot[1]); e.alerted = true; u.spawned++;
      ev.push({ t: 'spawn', id: e.id, x: e.x, y: e.y });
      log(b, ev, u.name + ' compiles a ' + e.name + '.', 'bad');
    };
    if (b.turn % sp.every === 0) make(sp.type);
    if (sp.heavy && b.turn % sp.heavyEvery === 0) make(sp.heavy);
    return ev;
  }

  function result(b) {
    return {
      outcome: b.outcome || 'abort',
      salvage: b.outcome === 'win' ? b.salvage : 0,
      units: b.units.filter(function (u) { return u.sid; }).map(function (u) {
        return { sid: u.sid, hp: u.hp, alive: u.alive, kills: u.kills, hacks: u.hacks || 0, name: u.name };
      })
    };
  }
  function abort(b) { if (!b.outcome) b.outcome = 'abort'; }

  return {
    W: W, H: H, FLOOR: FLOOR, WALL: WALL, LOW: LOW, HIGH: HIGH, SIGHT: SIGHT,
    create: create, act: act, endPlayerTurn: endPlayerTurn, enemyStep: enemyStep, ai: ai,
    reach: reach, pathTo: pathTo, moveRange: moveRange, hitInfo: hitInfo, targets: targets, tileOk: tileOk,
    abilityBlock: abilityBlock, coverValue: coverValue, los: los, isVisible: isVisible, unitAt: unitAt,
    unitById: unitById, tile: tile, dist: dist, cheb: cheb, checkOutcome: checkOutcome, result: result, abort: abort
  };
})();
