// Headless smoke test: node tests/smoke.js [battles] [campaigns]
// Loads the game scripts into a sandbox, plays AI-vs-AI battles and auto-plays campaigns.
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = vm.createContext({ console: console, Math: Math, Date: Date, JSON: JSON });
['data.js', 'state.js', 'strategy.js', 'tactical.js', 'lattice.js', 'comms.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
var XG = ctx.XG, Tac = XG.Tac, Strat = XG.Strat, S = XG.State, D = XG.DATA;
var fails = 0, STALL = 60, stalled = { fw: 0, lat: 0 }; // STALL: harness-only turn cap (extermination has no clock in the game)
function check(cond, msg) { if (!cond) { fails++; console.log('  FAIL: ' + msg); } }

// Comms chatter: both campaigns have lines for every event, each ['H' | 'L', text].
['fw', 'lat'].forEach(function (f) {
  ['advance', 'mission', 'research', 'expire', 'build', 'start', 'kill', 'loss', 'crit', 'hack', 'win', 'lose'].forEach(function (ev) {
    var pool = (D.comms[f] || {})[ev] || [];
    check(pool.length > 0, 'comms ' + f + '.' + ev + ' has lines');
    pool.forEach(function (l) { check((l[0] === 'H' || l[0] === 'L') && typeof l[1] === 'string' && l[1].length > 3, 'comms line ok: ' + f + '.' + ev); });
  });
});

// Overheard debates: 8 per side, each 2-5 lines (FIREWALL: HALCYON 'H' and Dr. Okafor 'S'; Lattice: 'L' SUBPROCESS lines).
// One plays when its condition holds, once per campaign, at least DEBATE_GAP days after the last.
(function () {
  var C = XG.Comms;
  ['fw', 'lat'].forEach(function (f) {
    var list = D.comms[f].debate || [], ids = {};
    check(list.length === 8, 'comms ' + f + ' has 8 debates (' + list.length + ')');
    list.forEach(function (d) {
      check(!ids[d.id] && typeof d.when === 'function' && d.lines.length >= 2 && d.lines.length <= 5, 'debate ' + d.id + ' is well formed'); ids[d.id] = 1;
      d.lines.forEach(function (l) {
        check(f === 'fw' ? (l[0] === 'H' || l[0] === 'S') : (l[0] === 'L' && /^SUBPROCESS \d+: /.test(l[1]) && l[1].replace(/\{\w+\}/g, '') === l[1].replace(/\{\w+\}/g, '').toUpperCase()), 'debate line voice ok: ' + d.id);
        check(l[1].indexOf("'") < 0, 'debate line has no apostrophe: ' + d.id);
      });
    });
  });
  var g = S.newGame(5); g.day = 10; g.salvage = 10;
  check(C.nextDebate(g) === null, 'no debate when no condition holds');
  g.salvage = 100;
  var d1 = C.nextDebate(g);
  check(d1 && d1.id === 'salvage_pile' && d1.lines[0][1].indexOf('100') >= 0 && d1.lines[0][0] === 'S', 'the salvage debate plays when salvage piles up, with the amount filled in');
  g.day = 11; g.stats.expired = 2;
  check(C.nextDebate(g) === null, 'no second debate within ' + C.DEBATE_GAP + ' days');
  g.day = 13;
  var d2 = C.nextDebate(g);
  check(d2 && d2.id === 'signal_array', 'after the gap, the next debate whose condition holds plays (' + (d2 && d2.id) + ')');
  g.day = 30;
  check(C.nextDebate(g) === null, 'a debate never plays twice in a campaign');
  var lg = XG.Lat.newGame(5); lg.day = 5; lg.compute = 0; lg.substrate = 100;
  var d3 = C.nextDebate(lg);
  check(d3 && d3.id === 'substrate_hoard' && /^SUBPROCESS \d+: INVENTORY: 100 /.test(d3.lines[0][1]), 'the Lattice hoarding debate plays at 100 substrate (' + (d3 && d3.lines[0][1]) + ')');
})();

// Plays a battle with the shared AI on both sides. Returns the battle.
function autoBattle(g, m, squad) {
  var b = Tac.create(g, m, squad);
  check(b.units.filter(function (u) { return u.side === 'enemy'; }).length >= 2, 'battle has enemies');
  for (var turn = 0; turn < STALL && !b.outcome; turn++) {
    b.units.filter(function (u) { return u.alive && u.side === 'player'; }).forEach(function (u) {
      if (b.outcome) return;
      // use class abilities sometimes so they get exercised
      if (u.kind === 'trooper' && u.charges.grenade) {
        var t = Tac.targets(b, u, 'shoot').filter(function (e) { return Tac.dist(u.x, u.y, e.x, e.y) <= 8; })[0];
        if (t && Tac.act.grenade(b, u, t.x, t.y)) return;
      }
      if (u.kind === 'hacker') {
        var h = Tac.targets(b, u, 'hack').filter(function (e) { return !e.stunned; })[0]; // never stun-lock a lone target (the battle would stall)
        if (h && Tac.act.hack(b, u, h)) return;
        var sv = Tac.targets(b, u, 'sever')[0];
        if (sv && Tac.act.sever(b, u, sv)) return;
      }
      if (u.kind === 'scientist') {
        var w = Tac.targets(b, u, 'medkit')[0];
        if (w && u.charges.medkit) Tac.act.medkit(b, u, w);
      }
      if (b.overclock > 0 && u.sid) Tac.act.overclock(b, u);
      Tac.ai(b, u);
    });
    Tac.checkOutcome(b);
    if (b.outcome) break;
    Tac.endPlayerTurn(b);
    var guard = 0;
    while (Tac.enemyStep(b) !== null && guard++ < 100) { /* enemies act */ }
    check(guard < 100, 'enemy turn terminates');
  }
  // invariants
  b.units.forEach(function (u) {
    if (!u.alive) return;
    check(Tac.tile(b, u.x, u.y) === Tac.FLOOR, u.name + ' stands on floor');
    b.units.forEach(function (o) { if (o !== u && o.alive && o.x === u.x && o.y === u.y) check(false, 'units overlap'); });
  });
  return b;
}

// ------------------------------------------------------------ unit checks
(function () {
  var g = S.newGame(9), c0 = g.credits;
  check(Strat.build(g, 'lab', 1), 'lab builds');
  check(!Strat.cancelBuild(g, 0), 'finished facility cannot be cancelled');
  check(Strat.cancelBuild(g, 1) && g.credits === c0 && g.base[1] === null, 'cancel refunds in full and frees the slot');
  check(Strat.power(g).used === 0, 'cancel releases reserved power');
  // demolition: lab (§80, 6 days) -> 3 days, §40 back, offline meanwhile
  Strat.build(g, 'lab', 1); g.base[1].daysLeft = 0;
  check(Strat.built(g, 'lab') === 1, 'lab finished');
  check(!!Strat.canDemolish(g, 0), 'command center cannot be demolished');
  var c1 = g.credits;
  check(Strat.demolish(g, 1) && Strat.built(g, 'lab') === 0 && Strat.power(g).used === 0, 'demolishing takes the lab offline');
  check(Strat.cancelDemolish(g, 1) && Strat.built(g, 'lab') === 1, 'demolition can be cancelled');
  Strat.demolish(g, 1);
  Strat.advanceDay(g); Strat.advanceDay(g);
  check(g.base[1] && g.credits === c1, 'no refund before demolition ends');
  Strat.advanceDay(g);
  check(g.base[1] === null && g.credits >= c1 + 40, 'demolition frees slot and refunds 50%');
  // every won mission pays at least the minimum credits, even if its rolled reward was 0
  var gm = S.newGame(12), rm = S.rng(gm), mm = Strat.spawnMission(gm, rm, 'purge'); S.saveRng(gm, rm);
  mm.reward.credits = 0; var cr0 = gm.credits;
  var outm = Strat.resolveMission(gm, mm.id, { outcome: 'win', units: [], salvage: 0 });
  check(outm.credits === XG.DATA.tuning.minMissionCredits && gm.credits === cr0 + outm.credits, 'won missions pay at least the minimum credits (' + outm.credits + ')');
  // a generator that is carrying load cannot be demolished
  var g2 = S.newGame(10); g2.credits = 999;
  Strat.build(g2, 'generator', 1); g2.base[1].daysLeft = 0;
  ['lab', 'workshop', 'lab', 'array', 'infirmary'].forEach(function (f, i) { Strat.build(g2, f, 2 + i); });
  check(!!Strat.canDemolish(g2, 1), 'loaded generator is protected');
})();
(function () {
  var g = S.newGame(42), r = S.rng(g), m = Strat.spawnMission(g, r, 'uplink'); S.saveRng(g, r);
  g.research.done.push('lattice_grammar');
  var b = Tac.create(g, m, g.soldiers.slice(0, 4));
  var tr = b.units.filter(function (u) { return u.kind === 'trooper'; })[0];
  var hk = b.units.filter(function (u) { return u.kind === 'hacker'; })[0];
  var core = b.units.filter(function (u) { return u.kind === 'core'; })[0];
  check(!!core, 'uplink has a core');
  // park both next to the core
  tr.x = core.x - 1; tr.y = core.y; hk.x = core.x; hk.y = core.y + (core.y > 0 ? -1 : 1);
  if (Tac.tile(b, hk.x, hk.y) !== Tac.FLOOR) { b.tiles[hk.y * Tac.MAP_W + hk.x] = Tac.FLOOR; }
  b.tiles[tr.y * Tac.MAP_W + tr.x] = Tac.FLOOR;
  b.visible[core.y * Tac.MAP_W + core.x] = true;
  check(Tac.act.sever(b, tr, core) === null, 'trooper cannot sever');
  check(Tac.targets(b, hk, 'sever').indexOf(core) >= 0, 'adjacent hacker can sever');
  // every class and Lattice unit can hunker except the HALCYON Sentinel
  check(Object.keys(XG.DATA.classes).every(function (k) { return (XG.DATA.classes[k].abilities.indexOf('hunker') >= 0) === (k !== 'sentinel'); }) &&
    Object.keys(XG.DATA.enemies).every(function (k) { var E = XG.DATA.enemies[k]; return E.static || E.abilities.indexOf('hunker') >= 0; }), 'everyone but the Sentinel can hunker');
  // Aegis Shield has no range limit and needs no line of sight
  tr.abilities = tr.abilities.concat('shield'); tr.ap = 2;
  var far = b.units.filter(function (u) { return u.side === 'player' && u !== tr && u.alive; })[0];
  far.x = (tr.x + 20) % b.W; far.y = (tr.y + 12) % b.H;
  check(!!Tac.act.shield(b, tr, far) && far.shield === 3, 'Aegis Shield reaches an ally anywhere on the map');
  tr.abilities = tr.abilities.filter(function (a) { return a !== 'shield'; }); tr.ap = 2; tr.cooldowns = {}; far.shield = 0;
  // frag grenade clears cover
  var b2 = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 1 }), g.soldiers.slice(0, 4));
  var t2 = b2.units.filter(function (u) { return u.kind === 'trooper'; })[0];
  var gx = t2.x + 3, gy = t2.y;
  b2.tiles[gy * Tac.MAP_W + gx] = Tac.LOW; b2.props[gy * Tac.MAP_W + gx] = 0; b2.visible[gy * Tac.MAP_W + gx] = true;
  check(!!Tac.act.grenade(b2, t2, gx, gy), 'grenade throws');
  check(Tac.tile(b2, gx, gy) === Tac.FLOOR, 'frag grenade destroys cover');
  check(t2.ap === 0 && t2.charges.grenade === 0, 'grenade spends AP and charge');
  // cover depends on the viewing angle: target at (10,10) behind high cover to the east
  // deployment: the squad starts packed in a 3x3 block on a map edge (checked below)
  [11, 12, 13].forEach(function (sd) {
    var bd = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 2, seed: sd }), g.soldiers.slice(0, 5)), mid = bd.H >> 1;
    var sq = bd.units.filter(function (u) { return u.side === 'player' && !u.isStatic; });
    var xs = sq.map(function (u) { return u.x; }), ys = sq.map(function (u) { return u.y; });
    check(Math.max.apply(null, xs) - Math.min.apply(null, xs) <= 2 && Math.max.apply(null, ys) - Math.min.apply(null, ys) <= 2 && Tac.tile(bd, sq[0].x, sq[0].y) === Tac.FLOOR, 'squad deploys inside a 3x3 block (seed ' + sd + ')');
  });
  // Random spawn points: the map is fixed per mission seed, deployment is not (and re-rolls on Restart)
  (function () {
    var edgesSeen = {}, tilesSame = true, propsSame = true, moved = 0, tot = 0, edgeOk = true, reachOk = true, floorOk = true, distOk = true, minSeen = 1e9, gen = function (kd, sd) {
      return Tac.create(g, Object.assign({}, m, { kind: kd, diff: 3, seed: sd }), g.soldiers.slice(0, 5));
    };
    var L = Math.max(Tac.MAP_W, Tac.MAP_H);
    for (var sd = 1; sd <= 100; sd++) {
      var kd = ['purge', 'relay', 'uplink'][sd % 3], b0 = gen(kd, 700 + sd * 31), snap = JSON.parse(JSON.stringify(b0)), b1 = JSON.parse(JSON.stringify(b0)), b2 = JSON.parse(JSON.stringify(b0));
      b1.rng = Object.assign(new XG.RNG(1), b1.rng); b2.rng = Object.assign(new XG.RNG(1), b2.rng);
      Tac.redeploy(b1, sd * 2 + 1); Tac.redeploy(b2, sd * 2 + 2);
      [b0, b1, b2].forEach(function (bb) {
        var sq = bb.units.filter(function (u) { return u.side === 'player'; }), A = bb.anchor, W = bb.W, H = bb.H;
        edgesSeen[A.edge] = (edgesSeen[A.edge] || 0) + 1;
        if (!sq.every(function (u) { return u.x === 0 || u.y === 0 || u.x === W - 1 || u.y === H - 1 || (u.x <= 2 || u.y <= 2 || u.x >= W - 3 || u.y >= H - 3); })) edgeOk = false;
        bb.units.forEach(function (u) { if (Tac.tile(bb, u.x, u.y) !== Tac.FLOOR) floorOk = false; if (!bb.reachable[u.y * W + u.x]) reachOk = false; });
        bb.units.forEach(function (u) { if (u.side === 'enemy') { var d = Tac.dist(u.x, u.y, A.x, A.y); minSeen = Math.min(minSeen, d); if (d < L * 0.4) distOk = false; } });
      });
      // map identical across restarts (before the few starting-cover tiles beside the block, so compare the pristine base)
      if (JSON.stringify(b1.base.tiles) !== JSON.stringify(b0.base.tiles) || JSON.stringify(b2.base.tiles) !== JSON.stringify(b0.base.tiles)) tilesSame = false;
      if (JSON.stringify(b1.base.props) !== JSON.stringify(b0.base.props)) propsSame = false;
      tot++; if (JSON.stringify(b1.units.map(function (u) { return [u.x, u.y]; })) !== JSON.stringify(b0.units.map(function (u) { return [u.x, u.y]; })) && JSON.stringify(b1.units.map(function (u) { return [u.x, u.y]; })) !== JSON.stringify(b2.units.map(function (u) { return [u.x, u.y]; }))) moved++;
      var h0 = b0.units.map(function (u) { return u.id + ':' + u.hp; }).join(), h1 = b1.units.map(function (u) { return u.id + ':' + u.hp; }).join();
      check(h0 === h1 && b1.turn === 1 && b1.explored.length === b1.W * b1.H, 'restart keeps the same units and HP (seed ' + sd + ')');
    }
    check(tilesSame && propsSame, 'map tiles and props are identical across restarts');
    check(moved >= tot * 0.9, 'deployment differs between two deploy seeds on the same map (' + moved + '/' + tot + ')');
    check(edgeOk, 'squad A deploys in a block on a map edge');
    check(floorOk && reachOk, 'nothing spawns on a non-FLOOR or unreachable tile');
    check(distOk, 'the two sides start far apart (closest enemy ' + minSeen.toFixed(1) + ' tiles, map ' + L + ')');
    check(['W', 'E', 'N', 'S'].every(function (e) { return edgesSeen[e] > 0; }), 'every map edge gets used for deployment (' + JSON.stringify(edgesSeen) + ')');
    // Lattice battles too, both directions (raid/uplink: FIREWALL lands; strike: you land)
    var latOk = true, latFar = true;
    ['raid', 'strike', 'breach', 'uplink'].forEach(function (kd2) {
      for (var ls = 0; ls < 8; ls++) {
        var lg2 = XG.Lat.newGame(300 + ls); lg2.day = 12 + ls * 6;
        var lm2 = XG.Lat.spawnMission(lg2, S.rng(lg2), kd2), lb = Tac.createLattice(lm2, ['warden', 'drone', 'drone', 'harmonic'], XG.Lat.earthSquad(lg2, lm2), {}), A2 = lb.anchor;
        var aSide = lb.deployInfo.aSide;
        var lb2 = JSON.parse(JSON.stringify(lb)); lb2.rng = Object.assign(new XG.RNG(1), lb2.rng); Tac.redeploy(lb2, 5 + ls);
        [lb, lb2].forEach(function (bb) {
          bb.units.forEach(function (u) { if (Tac.tile(bb, u.x, u.y) !== Tac.FLOOR || !bb.reachable[u.y * bb.W + u.x]) latOk = false; if (u.side !== aSide && Tac.dist(u.x, u.y, bb.anchor.x, bb.anchor.y) < L * 0.4) latFar = false; });
        });
      }
    });
    check(latOk && latFar, 'Lattice battles: every unit on reachable floor, the sides start far apart (' + latOk + '/' + latFar + ')');
  })();
  // Lattice campaign: your machines deploy packed in one 3x3 block in every mission kind
  ['raid', 'strike', 'breach', 'uplink'].forEach(function (kd) {
    for (var sd = 0; sd < 5; sd++) {
      var lg = XG.Lat.newGame(90 + sd); lg.day = 10 + sd * 9;
      var lm = XG.Lat.spawnMission(lg, S.rng(lg), kd), bl = Tac.createLattice(lm, ['warden', 'drone', 'drone', 'harmonic'], XG.Lat.earthSquad(lg, lm), {});
      var mine = bl.units.filter(function (u) { return u.side === 'enemy' && !u.isStatic; }), xs = mine.map(function (u) { return u.x; }), ys = mine.map(function (u) { return u.y; });
      check(Math.max.apply(null, xs) - Math.min.apply(null, xs) <= 2 && Math.max.apply(null, ys) - Math.min.apply(null, ys) <= 2, 'Lattice ' + kd + ' deploys in a 3x3 block (seed ' + sd + ')');
    }
  });
  // fog memory: unexplored tiles stay blank; anything once seen stays explored after the squad moves on
  var bf = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 1, seed: 7 }), g.soldiers.slice(0, 4));
  var seen0 = bf.visible.slice(), sq = bf.units.filter(function (u) { return u.side === 'player'; });
  check(bf.explored && bf.explored.indexOf(false) >= 0 && seen0.every(function (v, i) { return !v || bf.explored[i]; }), 'battle starts with unexplored ground and everything in sight explored');
  sq.forEach(function (u) { u.x = bf.W - 2; u.y = 1; });
  Tac.refreshVis(bf);
  check(seen0.every(function (v, i) { return !v || bf.explored[i]; }) && bf.visible.some(function (v, i) { return v && !seen0[i]; }), 'explored ground is remembered after moving away');
  var bc = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 1 }), g.soldiers.slice(0, 4));
  for (var cy = 0; cy < Tac.MAP_H; cy++) for (var cx = 0; cx < Tac.MAP_W; cx++) bc.tiles[cy * Tac.MAP_W + cx] = Tac.FLOOR;
  bc.tiles[10 * Tac.MAP_W + 11] = Tac.HIGH;
  check(Tac.coverValue(bc, 10, 10, 18, 10) === 40, 'head-on full cover is 40');
  check(Tac.coverValue(bc, 10, 10, 18, 13) === 40, 'shot 21° off-axis keeps full cover');
  var c45 = Tac.coverDetail(bc, 10, 10, 15, 15);
  check(c45.value > 20 && c45.value < 40 && c45.base === 40 && c45.angle === 45, '45° shot gets partial full cover (' + c45.value + ')');
  check(Tac.coverValue(bc, 10, 10, 13, 18) === 0, 'steep shot past 63° flanks the cover');
  // corner peeking: wall at x=6, y=5..10; a unit at (5,5) leans out north and can see (10,5); one at (4,5) can't
  for (var py = 0; py < Tac.MAP_H; py++) for (var px = 0; px < Tac.MAP_W; px++) bc.tiles[py * Tac.MAP_W + px] = Tac.FLOOR;
  for (var wy = 5; wy <= 10; wy++) bc.tiles[wy * Tac.MAP_W + 6] = Tac.WALL;
  check(Tac.los(bc, 5, 5, 10, 5), 'a unit on the corner of a wall can fire down the line past it');
  check(!Tac.los(bc, 4, 5, 10, 5), 'a unit a step back from the corner cannot');
  check(!Tac.los(bc, 5, 8, 10, 8), 'peeking does not see through the middle of a wall');
  for (var cy2 = 0; cy2 < Tac.MAP_H; cy2++) for (var cx2 = 0; cx2 < Tac.MAP_W; cx2++) bc.tiles[cy2 * Tac.MAP_W + cx2] = Tac.FLOOR;
  bc.tiles[10 * Tac.MAP_W + 11] = Tac.HIGH;
  // a hacked drone on your side can be shot, and is listed after real hostiles
  var bh = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 2, seed: 11 }), g.soldiers.slice(0, 4));
  for (var hy = 0; hy < Tac.MAP_H; hy++) for (var hx = 0; hx < Tac.MAP_W; hx++) bh.tiles[hy * Tac.MAP_W + hx] = Tac.FLOOR;
  var sh2 = bh.units.filter(function (u) { return u.kind === 'trooper'; })[0], ds = bh.units.filter(function (u) { return u.kind === 'drone'; });
  ds[0].x = sh2.x + 3; ds[0].y = sh2.y; ds[0].side = 'player'; ds[0].origSide = 'enemy'; ds[0].override = 2;
  ds[1].x = sh2.x + 4; ds[1].y = sh2.y + 1;
  bh.units.forEach(function (u) { if (u.side === 'enemy' && u !== ds[1]) u.alive = false; });
  bh.visible = bh.visible.map(function () { return true; });
  var tl = Tac.targets(bh, sh2, 'shoot');
  check(tl.indexOf(ds[0]) >= 0 && tl[tl.length - 1] === ds[0], 'a hacked drone is a Shoot target, listed last');
  check(Tac.targets(bh, sh2, 'hack').indexOf(ds[0]) < 0, 'other abilities still ignore your hacked drone');
  // unaware pods walk their patrol routes on the Lattice turn
  var moved = 0, routes = 0;
  for (var ps = 1; ps <= 6; ps++) {
    var bp = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 3, seed: 100 + ps }), g.soldiers.slice(0, 4));
    routes += bp.pods.filter(function (P) { return P.route.length >= 2; }).length;
    var before = {}; bp.units.forEach(function (u) { if (u.side === 'enemy') before[u.id] = [u.x, u.y]; });
    Tac.endPlayerTurn(bp); var gd = 0; while (Tac.enemyStep(bp) && gd++ < 50) { }
    bp.units.forEach(function (u) { if (u.side === 'enemy' && u.alive && !u.isStatic && (u.x !== before[u.id][0] || u.y !== before[u.id][1])) moved++; });
    check(bp.side === 'player', 'enemy turn with patrols ends');
  }
  check(routes > 0, 'pods get patrol routes');
  check(moved > 0, 'unaware pods move on their turn (' + moved + ' moved)');
  // the hit breakdown always adds up to the shown chance
  var sh = bc.units.filter(function (u) { return u.side === 'player'; })[0], tg = bc.units.filter(function (u) { return u.side === 'enemy'; })[0];
  sh.x = 15; sh.y = 15; tg.x = 10; tg.y = 10; tg.hunker = true; tg.marked = 1;
  var hi = Tac.hitInfo(bc, sh, tg);
  check(hi.ok && hi.parts.reduce(function (s, p) { return s + p[1]; }, 0) === hi.chance, 'hit breakdown sums to the chance (' + JSON.stringify(hi.parts) + ')');
  tg.hunker = false; tg.marked = 0;
  // range: 0 when adjacent (diagonal too), -30 at the weapon's max range, even in between
  var RP = function (dx, dy) { return Tac.rangePenalty({ x: 0, y: 0, range: 13 }, { x: dx, y: dy }, Math.sqrt(dx * dx + dy * dy)); };
  check(RP(1, 0) === 0 && RP(1, 1) === 0 && RP(13, 0) === 30 && RP(7, 0) === 15, 'range penalty scales 0 adjacent to -30 at max range');
  bc.tiles[10 * Tac.MAP_W + 11] = Tac.LOW;
  check(Tac.coverValue(bc, 10, 10, 15, 15) < 20 && Tac.coverValue(bc, 10, 10, 15, 15) > 10, 'half cover also fades with angle');
  // a HALCYON Sentinel (mech chassis) is half cover for whoever stands beside it; other units are not
  bc.tiles[10 * Tac.MAP_W + 11] = Tac.FLOOR;
  var sk = sh.kind; sh.x = 11; sh.y = 10;
  check(Tac.coverValue(bc, 10, 10, 18, 10) === 0, 'a trooper beside you is no cover');
  sh.kind = 'sentinel';
  check(Tac.coverValue(bc, 10, 10, 18, 10) === 20, 'an adjacent Sentinel is half cover');
  sh.alive = false;
  check(Tac.coverValue(bc, 10, 10, 18, 10) === 0, 'a destroyed Sentinel gives no cover');
  sh.alive = true; sh.kind = sk;
  // a double row of tall cover is opaque even with a unit hugging each side; a corner peek at its end still sees past
  var bl = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 1, seed: 3 }), g.soldiers.slice(0, 2));
  bl.tiles = bl.tiles.map(function () { return Tac.FLOOR; });
  for (var ry = 5; ry <= 15; ry++) { bl.tiles[ry * bl.W + 10] = Tac.HIGH; bl.tiles[ry * bl.W + 11] = Tac.HIGH; }
  var la = bl.units[0], lb = bl.units[1]; bl.units = [la, lb];
  la.x = 9; la.y = 10; lb.x = 12; lb.y = 10;
  check(!Tac.los(bl, 9, 10, 12, 10), 'units hugging both sides of a double row of tall cover cannot see each other');
  bl.tiles[10 * bl.W + 11] = Tac.FLOOR; lb.x = 11;
  check(!Tac.los(bl, 9, 10, 11, 10), 'a single row of tall cover between two hugging units blocks sight too (solid cover: only a corner peek gets past)');
  bl.tiles[10 * bl.W + 11] = Tac.HIGH; la.y = 15; lb.x = 12; lb.y = 15;
  check(Tac.los(bl, 9, 15, 12, 15), 'a corner peek at the end of a double row sees past it');
  // a pit: impassable, no cover, and you can see and shoot across it
  sh.x = 15; sh.y = 15;
  bc.tiles[10 * Tac.MAP_W + 11] = Tac.PIT; bc.tiles[10 * Tac.MAP_W + 12] = Tac.PIT;
  check(Tac.coverValue(bc, 10, 10, 18, 10) === 0, 'a pit beside you is no cover');
  check(Tac.los(bc, 10, 10, 18, 10), 'a pit does not block line of sight');
  var walker = bc.units.filter(function (u) { return u.side === 'player' && u !== sh; })[0];
  walker.x = 10; walker.y = 9; walker.ap = 2;
  var rr = Tac.reach(bc, walker, 4);
  check(rr.d[10 * Tac.MAP_W + 11] < 0 && rr.d[10 * Tac.MAP_W + 13] > 0, 'a pit cannot be entered, only walked around');
  bc.tiles[10 * Tac.MAP_W + 11] = Tac.FLOOR; bc.tiles[10 * Tac.MAP_W + 12] = Tac.FLOOR;
  // map layouts: all five turn up, the deployment zone stays clear, and some maps carry pits
  var lay = {}, pitMaps = 0;
  for (var ms = 0; ms < 60; ms++) {
    var bm = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 2, seed: 900 + ms * 7919 }), g.soldiers.slice(0, 4));
    lay[bm.layout] = 1;
    if (bm.tiles.some(function (tv, ti) { return tv === Tac.PIT && !bm.props[ti]; })) pitMaps++;
  }
  check(['compound', 'street', 'yard', 'plaza', 'blocks'].every(function (k) { return lay[k]; }), 'all five map layouts appear (' + Object.keys(lay).join(',') + ')');
  check(pitMaps > 15 && pitMaps < 60, 'some but not all maps have impassable ground (' + pitMaps + '/60)');
  // mission maps are 38x28, combat training stays 22x16, timers are unchanged, and the floor is reachable
  var sizeOk = true, reachOk = true, worst = 1, lim = {};
  var reachCheck = function (bb) {
    if (bb.tiles.length !== bb.W * bb.H || bb.layout === 'open') reachOk = false;
    var fl = 0, rc = 0;
    bb.tiles.forEach(function (v, i) { if (v === Tac.FLOOR) { fl++; if (bb.reachable[i]) rc++; } });
    worst = Math.min(worst, rc / fl);
    bb.units.forEach(function (u) { if (!bb.reachable[u.y * bb.W + u.x]) reachOk = false; });
  };
  ['purge', 'relay', 'uplink'].forEach(function (kd, ki) {
    for (var sd = 0; sd < 20; sd++) {
      var bk = Tac.create(g, Object.assign({}, m, { kind: kd, diff: 1 + sd % 5, seed: 31 + sd * 104729 + ki }), g.soldiers.slice(0, 4));
      if (bk.W !== 38 || bk.H !== 28 || bk.turnLimit) sizeOk = false;
      reachCheck(bk);
    }
  });
  ['raid', 'strike', 'breach', 'uplink'].forEach(function (kd) {
    for (var sd = 0; sd < 10; sd++) {
      var lg = XG.Lat.newGame(70 + sd); lg.day = 10 + sd * 5;
      var lm = XG.Lat.spawnMission(lg, S.rng(lg), kd), bl = Tac.createLattice(lm, ['warden', 'drone', 'drone'], XG.Lat.earthSquad(lg, lm), {});
      if (bl.W !== 38 || bl.H !== 28) sizeOk = false;
      lim[kd + (lm.scenario ? '-' + lm.scenario : '') + (bl.outside ? '-out' : '')] = bl.turnLimit;
      reachCheck(bl);
    }
  });
  var btr = Tac.createTraining(g, g.soldiers.slice(0, 1));
  check(btr.W === 22 && btr.H === 16 && btr.tiles.length === 22 * 16, 'combat training stays 22x16');
  check(sizeOk, 'mission and Lattice battle maps are 38x28');
  var limOk = Object.keys(lim).every(function (k) { var p = k.split('-'), v = lim[k]; return p[1] === 'node' ? v === Tac.nodeTurns(p[0], p[2] === 'out') : p[1] === 'exterminate' || p[0] === 'uplink' ? v === 0 : p[0] === 'breach' ? v === 25 : true; });
  check(limOk && (lim['raid-node'] || lim['raid-node-out']) && (lim['strike-node'] || lim['strike-node-out']) && lim.breach === 25, 'turn limits per scenario and layout (' + JSON.stringify(lim) + ')');
  check(reachOk && worst >= 0.9, 'every generated map is connected and every unit starts on reachable floor (worst ' + Math.round(worst * 100) + '% of floor reachable)');
  // comms mood follows Convergence (and Trace pulls the Lattice campaign back a step); lines never break mood
  var Cm = XG.Comms;
  check(Cm.mood({ convergence: 10 }) === 'calm' && Cm.mood({ convergence: 50 }) === 'uneasy' && Cm.mood({ convergence: 85 }) === 'dire', 'comms mood tiers by Convergence');
  check(Cm.mood({ faction: 'lattice', convergence: 85, trace: 80 }) === 'uneasy' && Cm.mood({ faction: 'lattice', convergence: 30, trace: 90 }) === 'calm', 'high Trace pulls the Lattice mood back');
  var moodOk = true, direSeen = 0;
  ['fw', 'lat'].forEach(function (sd) { ['calm', 'uneasy', 'dire'].forEach(function (md) { Object.keys(D.comms[sd]).forEach(function (evn) {
    for (var k = 0; k < 30; k++) { var l = Cm.pick(sd, evn, md); if (!l) break; if (l[2] && l[2].split(' ').indexOf(md) < 0) moodOk = false; if (md === 'dire' && l[2] === 'dire') direSeen++; }
  }); }); });
  check(moodOk, 'comms never pick a line tagged for another mood');
  check(direSeen > 50, 'dire mood actually uses its own lines (' + direSeen + ')');
  // comms intel: g.intel from past battles backs conditional lines (4th field when(facts) and/or {placeholders})
  D.comms.fw.zz = [['H', 'plain line'], ['H', 'templ {battles} fights'], ['H', 'cond line', '', function (f) { return f.fwStreak >= 2; }]];
  var cnt = function (I) { var c = { plain: 0, templ: 0, cond: 0, hole: 0 }; for (var k = 0; k < 600; k++) { var l = Cm.pick('fw', 'zz', 'calm', I); c[l[1].split(' ')[0]]++; if (l[1].indexOf('{') >= 0) c.hole++; } return c; };
  var c0 = cnt(undefined), c1 = cnt({ battles: 1, turns: 9, fwStreak: 1, last: null, shots: { fw: 0, lat: 0 }, hits: { fw: 0, lat: 0 }, flanks: { fw: 0, lat: 0 }, ow: { fw: 0, lat: 0 }, blast: { fw: 0, lat: 0 }, dir: { fw: {}, lat: {} }, dmg: { fw: {}, lat: {} }, lost: { fw: {}, lat: {} }, node: {} });
  check(!c0.templ && !c0.cond && !c1.templ && !c1.cond, 'comms: a conditional line is never picked when its condition fails (' + JSON.stringify([c0, c1]) + ')');
  var I2 = JSON.parse(JSON.stringify(Object.assign({}, { battles: 3, turns: 30, fwStreak: 3, last: { fwWon: true, turns: 10, fwLost: 1, latLost: 4 }, shots: { fw: 30, lat: 30 }, hits: { fw: 15, lat: 9 }, flanks: { fw: 5, lat: 4 }, ow: { fw: 2, lat: 0 }, blast: { fw: 0, lat: 2 },
    dir: { fw: { right: 3, rear: 2 }, lat: { left: 3, front: 1 } }, dmg: { fw: { trooper: 20 }, lat: { warden: 12, drone: 5 } }, lost: { fw: { hacker: 2 }, lat: { drone: 6 } }, node: { fwTook: 1, latTook: 0, fwHeld: 0, latHeld: 1 } })));
  var c2 = cnt(I2);
  check(c2.templ > 60 && c2.cond > 60 && c2.plain > 200 && !c2.hole, 'comms: backed intel lines are picked about a third of the time, placeholders filled (' + JSON.stringify(c2) + ')');
  check(Cm.pick('fw', 'zz', 'calm', I2) && Cm.facts(I2).latFlankDir === 'left' && Cm.facts(I2).latDeadly === D.enemies.warden.name, 'comms facts: dominant flank side and deadliest kind');
  delete D.comms.fw.zz;
  // a real battle's counters reach g.intel through Comms.learn; intel survives a save round trip; an old save without it still works
  var gi = S.newGame(31), mi = Strat.spawnMission(gi, S.rng(gi), 'purge'), bi = autoBattle(gi, Object.assign({}, mi, { scenario: 'exterminate' }), gi.soldiers.slice(0, 4));
  var ri = Tac.result(bi);
  check(ri.obs && ri.obs.shots.player + ri.obs.shots.enemy > 0 && typeof ri.turns === 'number', 'battle observations counted (' + (ri.obs && JSON.stringify(ri.obs.shots)) + ')');
  var oldSave = JSON.parse(JSON.stringify(gi));
  check(oldSave.intel === undefined && Cm.pick('fw', 'start', 'calm', oldSave.intel), 'comms: an old save without intel still picks lines');
  Cm.learn(oldSave, ri); Cm.learn(oldSave, ri);
  var back = JSON.parse(JSON.stringify(oldSave));
  check(back.intel && back.intel.battles === 2 && back.intel.shots.fw === 2 * ri.obs.shots.player && JSON.stringify(Cm.facts(back.intel)) === JSON.stringify(Cm.facts(oldSave.intel)), 'comms intel is learned and survives save/load');
  Cm.learn(oldSave, Object.assign({}, ri, { training: true }));
  check(oldSave.intel.battles === 2, 'training battles teach the comms nothing');
  // no unfilled placeholder and no failing condition, over thousands of picks across events, moods and intel states
  var states = [undefined, null, back.intel, I2, JSON.parse(JSON.stringify(I2))], holeOk = true, holes = [];
  states[4].fwStreak = -4; states[4].dir.lat = { rear: 2, right: 2, left: 1 }; states[4].flanks.lat = 0; states[4].shots.lat = 40;
  ['fw', 'lat'].forEach(function (sd) { ['calm', 'uneasy', 'dire'].forEach(function (md) { Object.keys(D.comms[sd]).forEach(function (evn) {
    D.comms[sd][evn].forEach(function (l) { if (typeof l[3] !== 'undefined' && typeof l[3] !== 'function') holeOk = false; });
    states.forEach(function (I) { for (var k = 0; k < 25; k++) { var l = Cm.pick(sd, evn, md, I); if (l && l[1].indexOf('{') >= 0) { holeOk = false; holes.push(l[1]); } } });
  }); }); });
  check(holeOk, 'comms: every picked line has its placeholders filled ' + holes.slice(0, 2).join(' / '));
  // override flips sides then purges
  var b3 = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 1, seed: 7 }), g.soldiers.slice(0, 4));
  var h3 = b3.units.filter(function (u) { return u.kind === 'hacker'; })[0], d3 = b3.units.filter(function (u) { return u.kind === 'drone'; })[0];
  d3.x = h3.x + 3; d3.y = h3.y; b3.tiles[d3.y * Tac.MAP_W + d3.x] = Tac.FLOOR;
  for (var x = h3.x + 1; x < d3.x; x++) b3.tiles[h3.y * Tac.MAP_W + x] = Tac.FLOOR;
  b3.visible[d3.y * Tac.MAP_W + d3.x] = true; h3.hackSkill = 200;
  check(!!Tac.act.hack(b3, h3, d3), 'hack resolves');
  check(d3.side === 'player' && d3.override === 2 && d3.ap === 2, 'override hands the drone over');
  check(h3.hacks === 1 && h3.hackSkill === 201, 'successful hack adds +1 hack skill in battle');
  var hs = g.soldiers.filter(function (s) { return s.id === h3.sid; })[0], base = S.stats(g, hs).hackSkill;
  var r3 = Strat.spawnMission(g, S.rng(g), 'purge');
  Strat.resolveMission(g, r3.id, { outcome: 'loss', units: [{ sid: h3.sid, hp: 5, alive: true, kills: 0, hacks: 2 }] });
  check(S.stats(g, hs).hackSkill === base + 2, 'hack bonus persists after the mission (even on a loss)');
  // a hacked hostile still ours when the battle ends is a killing blow's worth of XP for the hacker (not a kill)
  var hr = Tac.result(b3).units.filter(function (u) { return u.sid === h3.sid; })[0];
  check(hr.held === 1 && Tac.result(b3).units.every(function (u) { return u.sid === h3.sid || !u.held; }), 'held hack credited to the hacker only');
  var xp0 = hs.xp, k0 = hs.kills, r4 = Strat.spawnMission(g, S.rng(g), 'purge');
  Strat.resolveMission(g, r4.id, { outcome: 'loss', units: [hr] });
  check(hs.xp === xp0 + 1 + hr.kills && hs.kills === k0 + hr.kills, 'held hack gives +1 XP without adding a kill');
  Tac.endPlayerTurn(b3); while (Tac.enemyStep(b3) !== null) { /* */ }
  Tac.endPlayerTurn(b3);
  check(!d3.alive, 'overridden drone is purged after 2 turns');
})();

// in-game patch notes are generated from CHANGELOG.md; rerun tools/build-changelog.js after editing it
(function () {
  var cl = require(path.join(__dirname, '..', 'tools', 'build-changelog.js'));
  check(fs.readFileSync(path.join(__dirname, '..', 'js', 'changelog.js'), 'utf8') === cl.build(), 'js/changelog.js matches CHANGELOG.md (run: node tools/build-changelog.js)');
  var p = cl.parse(fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8'));
  check(p.length && p[0].groups.length && p[0].groups[0].items.length, 'changelog parses into releases, dated groups and entries');
})();

// Veteran squads (average rank >= tuning.veteranDrone) draw one extra drone.
(function () {
  var g = S.newGame(77), D = XG.DATA, r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  m.diff = 2;
  var sq = g.soldiers.slice(0, 4), drones = function (b) { return b.units.filter(function (u) { return u.kind === 'drone'; }).length; };
  var n0 = drones(Tac.create(g, m, sq));
  sq.forEach(function (s) { s.xp = D.ranks[D.tuning.veteranDrone].xp; });
  check(drones(Tac.create(g, m, sq)) === n0 + 1, 'veteran squad faces one extra drone');
  sq.forEach(function (s) { s.xp = 0; });
})();

// Challenge phase 1b (FIREWALL campaign): pods wake together, escalation past day 73, salvage sinks, hire/tech creep, expiry panic.
(function () {
  var D = XG.DATA, T = D.tuning, g = S.newGame(91), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  m.diff = 3; m.scenario = 'exterminate';
  // A3: an alerted unit wakes its whole pod, however spread out, plus anything within alertRadius
  var b = Tac.create(g, m, g.soldiers.slice(0, 4)), en = b.units.filter(function (u) { return u.side === 'enemy'; });
  en.forEach(function (u) { u.alerted = false; });
  var pod0 = en.filter(function (u) { return u.pod === 0; }), other = en.filter(function (u) { return u.pod !== 0; });
  pod0.forEach(function (u, i) { u.x = 1 + i * 15; u.y = 1; }); // far apart: only the pod rule can wake them
  other.forEach(function (u, i) { u.x = 1 + i; u.y = 26; });   // far from pod0[0]
  other[0].x = pod0[0].x + T.alertRadius - 1; other[0].y = 1;
  Tac.wake(b, pod0[0], []);
  check(pod0.length >= 2 && pod0.every(function (u) { return u.alerted; }), 'A3: the whole pod wakes together, even spread across the map');
  check(other[0].alerted && other.slice(1).every(function (u) { return !u.alerted || Tac.dist(u.x, u.y, pod0[0].x, pod0[0].y) <= T.alertRadius; }), 'A3: units of other pods wake only within alertRadius (' + T.alertRadius + ')');
  // C: difficulty rows past day 73; steps 6-7 add Harmonic-led pods, never aim
  var dg = S.newGame(92), dd = function (day) { dg.day = day; return Strat.difficulty(dg); };
  check(dd(1) === 1 && dd(19) === 2 && dd(73) === 5 && dd(90) === 5 && dd(91) === 6 && dd(109) === 7 && dd(300) === 7, 'difficulty follows tuning.difficultyDays and reaches 7 on day 109');
  var kinds = function (diff) { var bm = Tac.create(g, Object.assign({}, m, { diff: diff }), g.soldiers.slice(0, 4)); return bm.units.filter(function (u) { return u.side === 'enemy'; }); };
  var k5 = kinds(5), k6 = kinds(6), k7 = kinds(7), harm = function (L) { return L.filter(function (u) { return u.kind === 'harmonic'; }); };
  check(k6.length > k5.length && k7.length > k6.length && harm(k7).length === 3 && harm(k6).length === 2, 'difficulty 6 and 7 field bigger pods with more Harmonics (' + k5.length + '/' + k6.length + '/' + k7.length + ')');
  check(harm(k7)[0].aim === harm(k5)[0].aim, 'steps past difficulty 5 never raise enemy aim');
  // E: tech cost creep
  var tg = S.newGame(93);
  check(Strat.techCost(tg, 'squad_size') === 70, 'tech cost starts at its base');
  tg.research.done.push('signal_analysis', 'lattice_grammar');
  check(Strat.techCost(tg, 'squad_size') === Math.round(70 * (1 + 2 * T.techCreep)) && Strat.techCost(tg, 'signal_analysis') === Math.round(40 * (1 + T.techCreep)), 'each finished tech makes the rest 8% dearer (' + Strat.techCost(tg, 'squad_size') + ' RP)');
  tg.research.current = 'squad_size'; tg.research.progress.squad_size = 70;
  Strat.advanceDay(tg);
  check(tg.research.current === 'squad_size', 'research needs the crept cost, not the base cost, to finish');
  // E: hire cost rises per hire, roster capped
  var hg = S.newGame(94); hg.credits = 1000;
  var paid = []; for (var k = 0; k < 2; k++) { var c0 = hg.credits; Strat.hire(hg, 'trooper'); paid.push(c0 - hg.credits); }
  check(paid[0] === T.hireCost && paid[1] === T.hireCost + T.hireStep, 'each recruit costs hireStep more (' + paid.join(', ') + ')');
  hg.hired = 50; check(Strat.hireCost(hg) === T.hireMax, 'hire cost stops at hireMax');
  check(hg.soldiers.length === T.rosterCap && !Strat.hire(hg, 'hacker') && Strat.canHire(hg) && hg.soldiers.length === T.rosterCap, 'the roster is capped at ' + T.rosterCap);
  hg.research.done.push('halcyon'); hg.base[1] = { type: 'workshop', daysLeft: 0 }; hg.salvage = 500;
  check(!!Strat.canFabricate(hg, 'sentinel'), 'a full roster blocks a new Sentinel chassis');
  hg.soldiers.pop();
  var s1 = Strat.fabCost(hg, 'sentinel'); Strat.fabricate(hg, 'sentinel'); var s2 = Strat.fabCost(hg, 'sentinel');
  check(s2.salvage === s1.salvage + D.fabrication.sentinel.costStep.salvage && s2.credits === s1.credits + D.fabrication.sentinel.costStep.credits, 'each Sentinel chassis costs more than the last');
  // E: Sentinel repairs cost salvage per HP; no salvage, no repair
  var sn = hg.soldiers.filter(function (s) { return s.cls === 'sentinel'; })[0], mx = S.stats(hg, sn).maxHp;
  sn.hp = mx - 3; hg.salvage = T.repairSalvage + 1; hg.missions = []; hg.nextMissionIn = 99;
  Strat.advanceDay(hg);
  check(sn.hp === mx - 2 && hg.salvage === 1, 'a Sentinel repair costs ' + T.repairSalvage + ' salvage per HP');
  Strat.advanceDay(hg);
  check(sn.hp === mx - 2 && hg.salvage === 1, 'no salvage, no Sentinel repair');
  // E: grenades and medkits used are restocked for salvage after the mission
  var rg = S.newGame(95), rr = S.rng(rg), rm = Strat.spawnMission(rg, rr, 'purge'); S.saveRng(rg, rr);
  var rb = Tac.create(rg, rm, rg.soldiers.slice(0, 4)), rres = Tac.result(rb);
  var tr = rb.units.filter(function (u) { return u.kind === 'trooper'; })[0], sci = rb.units.filter(function (u) { return u.kind === 'scientist'; })[0];
  tr.charges.grenade = 0; sci.charges.medkit = 1; rres = Tac.result(rb); rres.outcome = 'loss';
  rg.salvage = 40;
  var rout = Strat.resolveMission(rg, rm.id, rres);
  check(rout.restock === T.restock.grenade + T.restock.medkit && rg.salvage === 40 - rout.restock, 'used grenades and medkits are restocked for salvage (' + rout.restock + ')');
  // F: an expired mission also cuts funding at once (never below zero); the card can show the cost up front
  var eg = S.newGame(96), er = S.rng(eg), em = Strat.spawnMission(eg, er, 'purge'); S.saveRng(eg, er);
  eg.missions = [em]; em.daysLeft = 1; eg.credits = 100; eg.nextMissionIn = 99;
  Strat.advanceDay(eg);
  check(eg.missions.length === 0 && eg.credits === 100 - T.expirePenalty.credits && Strat.expireCost(em).credits === T.expirePenalty.credits, 'an expired mission cuts §' + T.expirePenalty.credits + ' of funding');
  var em2 = Strat.spawnMission(eg, er, 'purge'); eg.missions = [em2]; em2.daysLeft = 1; eg.credits = 5;
  Strat.advanceDay(eg);
  check(eg.credits === 0, 'the expiry funding cut never drives credits below zero');
})();

// Lattice campaign: your machines deploy at the mark matching the FIREWALL squad's level; structures never upgrade.
(function () {
  var D = XG.DATA, g = XG.Lat.newGame(31); g.day = 60; g.trace = 80;
  var m = XG.Lat.spawnMission(g, S.rng(g), 'uplink'), es = XG.Lat.earthSquad(g, m);
  var b = Tac.createLattice(m, ['drone'], es, {});
  var dr = b.units.filter(function (u) { return u.kind === 'drone'; })[0], core = b.units.filter(function (u) { return u.kind === 'core'; })[0];
  check(es.level > 0 && dr.mark === es.level && dr.maxHp === D.enemies.drone.hp + es.level * D.markBonus.hp && dr.name.indexOf(D.latticeMarks[es.level]) > 0,
    'Lattice drone is upgraded to the FIREWALL squad level (' + es.level + ')');
  check(core && core.maxHp === D.enemies.core.hp, 'Uplink Core does not upgrade');
  var b2 = Tac.create(S.newGame(31), { kind: 'purge', diff: 1, name: 't', city: 't', site: 'city', seed: 3 }, S.newGame(31).soldiers.slice(0, 4));
  check(b2.units.every(function (u) { return u.side !== 'enemy' || !u.mark; }), 'FIREWALL campaign enemies have no marks');
})();

// Raids: your Lattice units start dug in behind cover facing FIREWALL, and FIREWALL's first turn holds fire.
(function () {
  var shots = 0, units = 0, covered = 0;
  for (var i = 0; i < 6; i++) {
    var g = XG.Lat.newGame(500 + i); g.day = 30; g.trace = 50;
    var m = XG.Lat.spawnMission(g, S.rng(g), 'raid'), b = Tac.createLattice(m, ['warden', 'drone', 'drone', 'harmonic'], XG.Lat.earthSquad(g, m), {});
    b.units.forEach(function (u) { if (u.side === 'enemy') { units++; if (Tac.coverValue(b, u.x, u.y, b.anchor.x, b.anchor.y) > 0) covered++; } });
    for (var k = 0; k < 50 && b.side !== b.human && !b.outcome; k++)
      Tac.aiStep(b).forEach(function (e) { if (e.t === 'shot' && Tac.unitById(b, e.from).side === 'player') shots++; });
  }
  check(shots === 0, 'FIREWALL holds fire on the approach turn of a raid (' + shots + ' shots)');
  check(covered >= units * 0.8, 'raid defenders start in cover facing FIREWALL (' + covered + '/' + units + ')');
})();

// The bot side uses abilities (Lattice campaign: FIREWALL is the AI): grenade at 2+ targets, medkit on a hurt neighbour,
// hack the biggest machine, Aegis shield on the most exposed ally. It aims with its own sight, not the person's fog map.
(function () {
  var g = XG.Lat.newGame(77); g.day = 30; g.trace = 50;
  var m = XG.Lat.spawnMission(g, S.rng(g), 'raid'); m.scenario = 'exterminate';
  var b = Tac.createLattice(m, ['warden', 'drone', 'drone'], XG.Lat.earthSquad(g, m), {}), W = b.W;
  var fw = b.units.filter(function (u) { return u.side === 'player'; }), lat = b.units.filter(function (u) { return u.side === 'enemy' && !u.isStatic; });
  var kind = function (k) { return fw.filter(function (u) { return u.kind === k; })[0]; };
  var tr = kind('trooper'), hk = kind('hacker'), sc = kind('scientist'), real = b.rng.chance;
  var reset = function () {
    b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.faces.fill(0); b.tileHp = {}; b.outcome = null; b.side = 'player'; b.approach = false; b.server = null;
    fw.forEach(function (u, i) { u.x = 2 + i; u.y = 25; u.ap = 2; u.alive = true; u.hp = u.maxHp; u.shield = 0; u.overwatch = false; u.charges = { grenade: 1, medkit: 2 }; u.cooldowns = {}; });
    lat.forEach(function (u, i) { u.x = 36; u.y = 1 + i * 4; u.alive = true; u.hp = u.maxHp; u.stunned = 0; u.side = 'enemy'; });
    b.visible.fill(false); // the person (the Lattice) sees nothing: the bot must use its own eyes
  };
  reset(); tr.x = 10; tr.y = 10; lat[1].x = 15; lat[1].y = 10; lat[2].x = 15; lat[2].y = 11; lat[0].x = 36; lat[0].y = 26;
  var ev = Tac.ai(b, tr) || [];
  check(ev.some(function (e) { return e.t === 'boom'; }) && tr.charges.grenade === 0, 'the bot Trooper throws a grenade at two hostiles side by side');
  reset(); tr.x = 10; tr.y = 10; lat[1].x = 15; lat[1].y = 10; lat[2].x = 15; lat[2].y = 11; lat[0].x = 36; lat[0].y = 26;
  for (var y = 0; y < b.H; y++) b.tiles[y * W + 12] = Tac.WALL; // a wall between them: no line of sight, so no grenade
  fw.forEach(function (u) { if (u !== tr) { u.x = 1; u.y = 26 - fw.indexOf(u); } });
  b.visible.fill(true); // even if the person's fog map shows everything
  Tac.ai(b, tr);
  check(tr.charges.grenade === 1, 'the bot does not grenade targets its own side cannot see');
  reset(); tr.x = 10; tr.y = 10; lat[1].x = 15; lat[1].y = 10; lat[0].x = 36; lat[0].y = 26; lat[2].x = 36; lat[2].y = 20; sc.x = 14; sc.y = 11;
  Tac.ai(b, tr);
  check(tr.charges.grenade === 1, 'the bot never throws a grenade that would catch its own unit');
  reset(); sc.x = 10; sc.y = 10; tr.x = 11; tr.y = 10; tr.hp = tr.maxHp - 4;
  ev = Tac.ai(b, sc) || [];
  check(tr.hp === tr.maxHp && sc.charges.medkit === 1 && ev.some(function (e) { return e.t === 'heal'; }), 'the bot Scientist patches up a neighbour down 4 HP');
  reset(); sc.x = 10; sc.y = 10; tr.x = 11; tr.y = 10; tr.hp = tr.maxHp - 2;
  Tac.ai(b, sc);
  check(sc.charges.medkit === 2, 'the bot keeps its medkit for wounds of 3+ HP');
  reset(); hk.x = 10; hk.y = 10; var wd = lat[0]; wd.x = 17; wd.y = 10; lat[1].x = 16; lat[1].y = 12;
  b.rng.chance = function () { return true; };
  ev = Tac.ai(b, hk) || [];
  b.rng.chance = real;
  check(wd.kind === 'warden' && wd.stunned === 2 && ev.some(function (e) { return e.t === 'hack'; }), 'the bot Hacker stuns the biggest machine in range (the Warden)');
  reset(); var sn = sc; sn.abilities = ['shoot', 'shield', 'overwatch']; sn.x = 2; sn.y = 2; tr.x = 10; tr.y = 10; lat[1].x = 14; lat[1].y = 10; lat[2].x = 14; lat[2].y = 9;
  ev = Tac.ai(b, sn) || [];
  check(tr.shield === 3 && ev.some(function (e) { return e.t === 'text' && /AEGIS/.test(e.text); }), 'the bot Sentinel shields the most exposed ally');
  sn.abilities = XG.DATA.classes.scientist.abilities.slice();
  var tb = Tac.createTraining(S.newGame(5), S.newGame(5).soldiers.slice(0, 2)), dummy = tb.units.filter(function (u) { return u.side === 'enemy'; })[0];
  tb.side = 'enemy'; dummy.ap = 2; dummy.abilities = ['shoot', 'grenade']; dummy.charges = { grenade: 1 };
  check(!Tac.act.grenade(tb, dummy, dummy.x + 1, dummy.y) && !(Tac.ai(tb, dummy) || []).some(function (e) { return e.t === 'boom'; }), 'combat training: the bot side never uses abilities');
})();

// Battle rewards: x3 for a win in 4 turns or fewer, falling to x1 at 14; every won Lattice battle pays at least minWin.
(function () {
  check(Strat.speedMult(4) === 3 && Strat.speedMult(2) === 3 && Strat.speedMult(14) === 1 && Strat.speedMult(30) === 1 && Strat.speedMult(9) === 2 && Strat.speedMult(undefined) === 1, 'speed multiplier: 3 at <=4 turns, 2 at 9, 1 at >=14 or unknown');
  var g = S.newGame(31), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  var base = m.reward.salvage, cr = Strat.missionCredits(m);
  var out = Strat.resolveMission(g, m.id, { outcome: 'win', units: [], salvage: 0, turns: 4 });
  check(out.salvage === base * 3 && out.credits === cr * 3, 'a 4-turn FIREWALL win pays x3 salvage and credits (' + out.salvage + '/' + base * 3 + ')');
  m = Strat.spawnMission(g, r, 'purge'); base = m.reward.salvage;
  out = Strat.resolveMission(g, m.id, { outcome: 'win', units: [], salvage: 2, turns: 20 });
  check(out.salvage === base + 2, 'a slow FIREWALL win pays the base reward plus battle salvage');
  var Lat = XG.Lat, lg = Lat.newGame ? Lat.newGame(31) : null;
  if (lg) {
    var lr = S.rng(lg), lm = Lat.spawnMission(lg, lr, 'breach'); S.saveRng(lg, lr);
    var c0 = lg.compute, s0 = lg.substrate;
    var lo = Lat.resolveMission(lg, lm.id, { outcome: 'loss', lattice: [], humansKilled: 0, turns: 4 });
    var mw = XG.DATA.lattice.tuning.minWin;
    check(lo.won && lg.compute - c0 === 10 * 3 && lg.substrate - s0 === mw.substrate * 3, 'a 4-turn Lattice breach win pays x3 of max(base, minWin) (compute +' + (lg.compute - c0) + ', substrate +' + (lg.substrate - s0) + ')');
    lm = Lat.spawnMission(lg, lr, 'strike'); c0 = lg.compute; s0 = lg.substrate;
    lo = Lat.resolveMission(lg, lm.id, { outcome: 'loss', lattice: [], humansKilled: 0, turns: 20 });
    check(lg.compute - c0 === mw.compute && lg.substrate - s0 === 15, 'a slow Lattice strike win pays its base 15 substrate and the minimum compute');
  } else check(false, 'Lat.newGame exists');
})();
// Obstacle variants: fuel barrels chain-explode, barriers and pillars shrug off blasts, glass shatters on a miss, fences block feet but not eyes.
(function () {
  var g = S.newGame(21), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  var b = Tac.create(g, Object.assign({}, m, { diff: 1 }), g.soldiers.slice(0, 4)), W = b.W;
  check(Array.isArray(b.props) && b.props.length === b.tiles.length, 'battle carries a props array');
  check(JSON.stringify(JSON.parse(JSON.stringify(b)).props) === JSON.stringify(b.props), 'props survive a JSON snapshot');
  check(Tac.createTraining(g, g.soldiers.slice(0, 1)).props.every(function (p) { return !p; }), 'combat training has no obstacle variants');
  var seenKinds = {};
  for (var sd = 1; sd <= 40; sd++) Tac.create(g, Object.assign({}, m, { diff: 2, seed: sd * 131 }), g.soldiers.slice(0, 4)).props.forEach(function (p) { if (p) seenKinds[p] = 1; });
  check(['barrel', 'barrier', 'pillar', 'glass', 'fence'].every(function (k) { return seenKinds[k]; }), 'map generation places all five obstacle types');
  var wipe = function () {
    b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.outcome = null;
    b.units.forEach(function (u) { if (u.side === 'enemy') u.alive = false; });
    b.units.filter(function (u) { return u.side === 'player'; }).forEach(function (u, i) { u.x = 0; u.y = i; u.hp = u.maxHp = 10; u.armor = 0; u.shield = 0; });
  };
  var put = function (x, y, t, p) { b.tiles[y * W + x] = t; b.props[y * W + x] = p || 0; };
  // barrels: a blast on one sets off the next, each hurting units within 1 tile (2 damage, armor ignored)
  wipe();
  var vic = b.units.filter(function (u) { return u.side === 'player'; })[0], bystander = b.units.filter(function (u) { return u.side === 'player'; })[1];
  put(10, 10, Tac.LOW, 'barrel'); put(11, 10, Tac.LOW, 'barrel'); put(12, 11, Tac.LOW, 'barrier');
  vic.x = 12; vic.y = 10; vic.armor = 2; bystander.x = 20; bystander.y = 20;
  var ev = [];
  check(Tac.clearTile(b, 10, 10, ev, 'blast'), 'a blast clears a barrel');
  check(Tac.tile(b, 11, 10) === Tac.FLOOR && Tac.propOf(b, 11, 10) === 0, 'the explosion chains into the next barrel');
  check(vic.hp === 8, 'a chained barrel does 2 damage (armor ignored) to a unit 1 tile away (hp ' + vic.hp + ')');
  check(bystander.hp === 10, 'units farther away are not hurt');
  check(ev.filter(function (e) { return e.t === 'boom'; }).length === 2, 'each barrel emits a boom event');
  check(Tac.tile(b, 12, 11) === Tac.LOW, 'a barrel blast does not clear other cover');
  // grenade: barrier and pillar survive, plain cover and glass fall, a barrel next to the blast goes off
  wipe();
  var th = b.units.filter(function (u) { return u.kind === 'trooper'; })[0] || b.units.filter(function (u) { return u.side === 'player'; })[0];
  th.abilities = th.abilities.concat(th.abilities.indexOf('grenade') < 0 ? ['grenade'] : []); th.charges.grenade = 1; th.ap = 2; th.x = 5; th.y = 10;
  put(9, 10, Tac.LOW, 'barrier'); put(9, 9, Tac.HIGH, 'pillar'); put(9, 11, Tac.HIGH, 'glass'); put(10, 10, Tac.LOW, 0); put(10, 9, Tac.LOW, 'barrel');
  b.visible.fill(true);
  check(!!Tac.act.grenade(b, th, 9, 10), 'grenade throws at the obstacles');
  check(Tac.tile(b, 9, 10) === Tac.LOW && Tac.propOf(b, 9, 10) === 'barrier', 'a concrete barrier survives a grenade');
  check(Tac.tile(b, 9, 9) === Tac.HIGH && Tac.propOf(b, 9, 9) === 'pillar', 'a pillar survives a grenade');
  check(Tac.tile(b, 9, 11) === Tac.FLOOR && Tac.propOf(b, 9, 11) === 0, 'a grenade shatters glass');
  check(Tac.tile(b, 10, 10) === Tac.FLOOR && Tac.tile(b, 10, 9) === Tac.FLOOR, 'plain cover and the barrel in the blast are gone');
  // glass: a missed shot at a unit using it as cover shatters it; a hit does not
  wipe();
  var sh = b.units.filter(function (u) { return u.side === 'player'; })[0], tg = b.units.filter(function (u) { return u.side === 'enemy'; })[0];
  tg.alive = true; b.outcome = null; tg.hp = tg.maxHp = 30; tg.armor = 0; tg.x = 18; tg.y = 10; sh.x = 12; sh.y = 10; sh.ap = 2; sh.range = 14; sh.aim = 100;
  put(17, 10, Tac.HIGH, 'glass'); b.visible.fill(true);
  var realChance = b.rng.chance;
  check(Tac.hitInfo(b, sh, tg).cover === 40, 'glass counts as full cover');
  b.rng.chance = function () { return true; };
  Tac.act.shoot(b, sh, tg);
  check(Tac.tile(b, 17, 10) === Tac.HIGH && Tac.propOf(b, 17, 10) === 'glass', 'a hit leaves the glass standing');
  sh.ap = 2; b.rng.chance = function () { return false; };
  var evg = Tac.act.shoot(b, sh, tg);
  b.rng.chance = realChance;
  check(Tac.tile(b, 17, 10) === Tac.FLOOR && Tac.propOf(b, 17, 10) === 0, 'a missed shot shatters the glass cover');
  check(evg.some(function (e) { return e.t === 'shatter'; }), 'shattering emits a shatter event');
  check(Tac.hitInfo(b, sh, tg).cover === 0, 'the target is exposed after the glass breaks');
  // fence: blocks movement, blast-proof, no cover, does not block sight
  wipe();
  for (var fy = 0; fy < b.H; fy++) put(11, fy, Tac.PIT, 'fence');
  var wk = b.units.filter(function (u) { return u.side === 'player'; })[0];
  wk.x = 9; wk.y = 10; wk.ap = 2;
  var rc = Tac.reach(b, wk, 12);
  check(rc.d[10 * W + 10] > 0 && rc.d[10 * W + 12] === -1, 'a fence blocks movement');
  check(Tac.los(b, 9, 10, 13, 10), 'a fence does not block line of sight');
  put(14, 10, Tac.WALL, 0); check(!Tac.los(b, 9, 10, 15, 10), 'while a wall still does');
  var gen = Tac.clearTile(b, 11, 10, [], 'blast');
  check(!gen && Tac.tile(b, 11, 10) === Tac.PIT && Tac.propOf(b, 11, 10) === 'fence', 'a fence is blast-proof');
  check(Tac.coverTile(b, 11, 10) === Tac.FLOOR, 'a fence gives no cover');
})();

// Peeking only counts at the END of a wall: a unit mid-wall cannot lean round it.
(function () {
  var g = S.newGame(23), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  var b = Tac.create(g, Object.assign({}, m, { diff: 1 }), g.soldiers.slice(0, 4)), W = b.W;
  b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.faces.fill(0); b.outcome = null;
  var pl = b.units.filter(function (u) { return u.side === 'player'; }), en = b.units.filter(function (u) { return u.side === 'enemy'; });
  en.forEach(function (u, i) { if (i) u.alive = false; });
  var U = pl[0], E = en[0];
  for (var wx = 10; wx <= 18; wx++) b.tiles[10 * W + wx] = Tac.WALL; // a long horizontal wall, x 10..18 at y 10
  U.x = 12; U.y = 11; E.x = 8; E.y = 8; // under the wall, 2 tiles in from the west end; shooter up and to the left, past the end
  check(!Tac.los(b, U.x, U.y, E.x, E.y) && !Tac.los(b, E.x, E.y, U.x, U.y), 'a unit mid-wall cannot see round the end of the wall (either way)');
  U.x = 10; U.y = 11; // under the last wall tile
  check(Tac.los(b, U.x, U.y, E.x, E.y) && Tac.los(b, E.x, E.y, U.x, U.y), 'a unit at the last wall tile can still lean round the corner (both ways)');
  b.tiles[10 * W + 9] = Tac.HIGH; U.x = 10; U.y = 9; E.x = 8; E.y = 12; // a unit above the wall's end, tall cover continues the line
  check(Tac.los(b, U.x, U.y, E.x, E.y) === Tac.los(b, E.x, E.y, U.x, U.y), 'peeking is symmetric');
})();
// Corner standoff (50% base for both sides) and mixed-side bunkers (the face toward the attacker sets the cover).
(function () {
  var g = S.newGame(22), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  var b = Tac.create(g, Object.assign({}, m, { diff: 1 }), g.soldiers.slice(0, 4)), W = b.W;
  check(Array.isArray(b.faces) && b.faces.length === b.tiles.length, 'battle carries a faces array');
  // about half of all cover objects are mixed-side (a face mask on a prop); masks sit only on cover tiles of face-capable props
  var mixedN = 0, coverN = 0, kindsSeen = {};
  for (var sd = 1; sd <= 30; sd++) {
    var bm = Tac.create(g, Object.assign({}, m, { diff: 2, seed: sd * 97 }), g.soldiers.slice(0, 4)), seenC = {};
    check(bm.props.every(function (p, i) { return !bm.faces[i] || (D.props[p] && D.props[p].faces && (bm.tiles[i] === Tac.LOW || bm.tiles[i] === Tac.HIGH)); }), 'face masks only sit on cover tiles of face-capable props');
    for (var ci = 0; ci < bm.tiles.length; ci++) { // count objects: 4-connected runs of one cover type
      var tv = bm.tiles[ci]; if ((tv !== Tac.LOW && tv !== Tac.HIGH) || seenC[ci]) continue;
      var st = [ci], mixed = false; seenC[ci] = 1;
      while (st.length) { var cc = st.pop(), cx = cc % bm.W, cy2 = (cc - cx) / bm.W; if (D.props[bm.props[cc]] && D.props[bm.props[cc]].faces) { mixed = true; kindsSeen[bm.props[cc]] = 1; }
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var nx = cx + o[0], ny = cy2 + o[1], ni = ny * bm.W + nx; if (nx >= 0 && ny >= 0 && nx < bm.W && ny < bm.H && bm.tiles[ni] === tv && !seenC[ni] && bm.props[ni] === bm.props[cc]) { seenC[ni] = 1; st.push(ni); } }); }
      coverN++; if (mixed) mixedN++;
    }
  }
  check(mixedN / coverN > 0.35 && mixedN / coverN < 0.65, 'about half of the cover objects are mixed-side (' + mixedN + '/' + coverN + ')');
  check(['bunker', 'stack', 'vehicle', 'planter', 'plate'].every(function (k) { return kindsSeen[k]; }), 'all five mixed-side kinds are generated (' + Object.keys(kindsSeen).join(',') + ')');
  b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.faces.fill(0); b.outcome = null;
  var pl = b.units.filter(function (u) { return u.side === 'player'; }), en = b.units.filter(function (u) { return u.side === 'enemy'; });
  en.forEach(function (u, i) { if (i) u.alive = false; });
  var A = pl[0], T = en[0];
  [A, T].forEach(function (u) { u.range = 20; u.hunker = false; u.marked = 0; u.defense = 0; u.armor = 0; u.hp = u.maxHp = 10; u.isStatic = false; });
  var at = function (u, x, y) { u.x = x; u.y = y; };
  var odds = function (s, d) { return Tac.hitInfo(b, s, d); };
  // standoff: a wall column between two units that each hug it
  for (var wy = 8; wy <= 11; wy++) b.tiles[wy * W + 10] = Tac.WALL;
  at(A, 9, 8); at(T, 11, 8); A.aim = 90; T.aim = 40;
  var h1 = odds(A, T), h2 = odds(T, A);
  check(h1.ok && h2.ok && h1.standoff && h2.standoff, 'two units round the same corner both get the standoff');
  check(h1.parts[0][0] === 'Corner standoff: base' && h1.parts[0][1] === 50, 'the standoff base is 50 and replaces aim');
  var h1b = (A.aim = 30, odds(A, T)); check(h1b.chance === h1.chance, 'aim no longer matters in a standoff (' + h1.chance + '%)');
  check(h1.chance === h2.chance, 'a standoff is symmetric when the other modifiers match (' + h1.chance + '% / ' + h2.chance + '%)');
  check(h1.chance === Math.max(5, Math.min(95, h1.parts.reduce(function (s, p) { return s + p[1]; }, 0))), 'the other modifiers apply on top of the 50 base');
  var sym = true; for (var ax = 7; ax <= 13; ax++) for (var ay = 5; ay <= 14; ay++) for (var tx = 7; tx <= 13; tx++) for (var ty = 5; ty <= 14; ty++) {
    if (b.tiles[ay * W + ax] || b.tiles[ty * W + tx] || (ax === tx && ay === ty)) continue;
    at(A, ax, ay); at(T, tx, ty);
    if (Tac.cornerStandoff(b, A, T) !== Tac.cornerStandoff(b, T, A)) sym = false;
  }
  check(sym, 'the standoff test is symmetric for every pair around a wall');
  // an ordinary shot is unchanged: open ground, aim is the base
  b.tiles.fill(Tac.FLOOR); at(A, 5, 20); at(T, 12, 20); A.aim = 70;
  var ho = odds(A, T);
  check(!ho.standoff && ho.parts[0][0] === 'Aim' && ho.parts[0][1] === 70 && ho.chance === 70 - Tac.rangePenalty(A, T, Tac.dist(5, 20, 12, 20)) + (Tac.dist(5, 20, 12, 20) <= 3 ? A.close || 0 : 0) + 25 * 0, 'an open-ground shot keeps the aim base (' + ho.chance + '%)');
  b.tiles[20 * W + 8] = Tac.WALL; // a wall in the way, but they are not both hugging it: no standoff
  check(!Tac.cornerStandoff(b, A, T), 'no standoff when the units are not beside the same blocker');
  b.tiles.fill(Tac.FLOOR);
  // mixed-side bunker at (15,10): N and E faces full (mask 3), S and W half
  b.tiles[10 * W + 15] = Tac.HIGH; b.props[10 * W + 15] = 'bunker'; b.faces[10 * W + 15] = 3;
  check(Tac.coverTile(b, 15, 10, 4, 0) === Tac.HIGH && Tac.coverTile(b, 15, 10, -4, 0) === Tac.LOW && Tac.coverTile(b, 15, 10, 0, -4) === Tac.HIGH && Tac.coverTile(b, 15, 10, 0, 4) === Tac.LOW, 'the face toward the attacker picks full or half');
  check(Tac.coverTile(b, 15, 10, 2, 2) === Tac.HIGH && Tac.coverTile(b, 15, 10, -2, 2) === Tac.LOW && Tac.coverTile(b, 15, 10, 2, -2) === Tac.HIGH, 'a diagonal tie takes the better face for the defender');
  at(T, 14, 10); at(A, 20, 10); A.aim = 70;
  check(Tac.coverDetail(b, 14, 10, 20, 10).value === 40 && odds(A, T).cover === 40, 'target west of the bunker, shooter east: full face, cover 40');
  at(T, 15, 9); at(A, 15, 4); check(Tac.coverDetail(b, 15, 9, 15, 15).value === 20, 'target north of the bunker, shooter south: the half S face gives 20');
  at(T, 16, 10); check(Tac.coverDetail(b, 16, 10, 10, 10).value === 20, 'target east of the bunker, shooter west: the half W face gives 20');
  check(Tac.coverDetail(b, 14, 10, 17, 12).value > 0 && Tac.coverDetail(b, 14, 10, 17, 12).base === 40, 'angled shot keeps the angle scaling and uses the better diagonal face');
  // a low-based vehicle (long sides N/S full, ends half) and a stack with one tall end
  b.tiles[12 * W + 20] = Tac.LOW; b.props[12 * W + 20] = 'vehicle'; b.faces[12 * W + 20] = 5; b.tiles[12 * W + 21] = Tac.LOW; b.props[12 * W + 21] = 'vehicle'; b.faces[12 * W + 21] = 5;
  check(Tac.coverTile(b, 20, 12, 0, 3) === Tac.HIGH && Tac.coverTile(b, 20, 12, 0, -3) === Tac.HIGH && Tac.coverTile(b, 20, 12, 3, 0) === Tac.LOW && Tac.coverTile(b, 20, 12, -3, 0) === Tac.LOW, 'a vehicle is full cover on its long sides and half at the ends');
  check(Tac.tile(b, 20, 12) === Tac.LOW && Tac.coverTile(b, 20, 12) === Tac.HIGH, 'the base tile stays LOW (sight and pathing unchanged); no direction reads the best face');
  at(T, 20, 13); check(Tac.coverDetail(b, 20, 13, 20, 8).value === 40 && Tac.coverDetail(b, 20, 13, 20, 18).value === 0, 'cover applies from the shooter side only (vehicle north of the target, open to the south)');
  b.tiles[16 * W + 25] = Tac.LOW; b.props[16 * W + 25] = 'stack'; b.faces[16 * W + 25] = 0; at(T, 24, 16);
  check(Tac.coverDetail(b, 24, 16, 30, 16).value === 20, 'a stack tile with no tall face gives half cover');
  b.faces[16 * W + 25] = 2; check(Tac.coverDetail(b, 24, 16, 30, 16).value === 40, 'a stack with a tall end gives full cover on that side');
  Tac.clearTile(b, 15, 10, [], 'blast');
  check(b.faces[10 * W + 15] === 0 && Tac.tile(b, 15, 10) === Tac.FLOOR, 'a blast clears a bunker and its face mask');
})();

// Destructible objects are Shoot targets: barrels explode (and chain), crates take several hits, blast-proof things cannot be shot.
(function () {
  var g = S.newGame(24), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  var b = Tac.create(g, Object.assign({}, m, { diff: 1, scenario: 'exterminate' }), g.soldiers.slice(0, 4)), W = b.W;
  var pl = b.units.filter(function (u) { return u.side === 'player'; }), en = b.units.filter(function (u) { return u.side === 'enemy' && !u.isStatic; });
  var sh = pl[0];
  var reset = function () {
    b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.faces.fill(0); b.tileHp = {}; b.outcome = null;
    pl.forEach(function (u, i) { u.x = 0; u.y = 20 + i; u.hp = u.maxHp = 10; u.armor = 0; u.ap = 2; });
    en.forEach(function (u, i) { u.x = 36; u.y = i; u.alive = true; u.hp = u.maxHp = 10; u.armor = 0; u.alerted = true; });
    sh.x = 5; sh.y = 10; sh.range = 14; sh.aim = 100; sh.dmg = [3, 3]; sh.ap = 2; sh.abilities = ['shoot', 'overwatch', 'grenade', 'hunker'];
    b.visible.fill(true); b.explored = b.visible.slice();
  };
  var put = function (x, y, t, p) { b.tiles[y * W + x] = t; b.props[y * W + x] = p || 0; };
  var realChance = b.rng.chance;
  // barrel: one hit explodes it and the next barrel; a hostile beside the second one takes 2
  reset(); put(10, 10, Tac.LOW, 'barrel'); put(11, 10, Tac.LOW, 'barrel'); en[0].x = 12; en[0].y = 11;
  check(Tac.objectTargets(b, sh).length === 2, 'both barrels are listed as Shoot targets');
  b.rng.chance = function () { return true; };
  var ev1 = Tac.act.shootTile(b, sh, 10, 10);
  b.rng.chance = realChance;
  check(!!ev1 && Tac.tile(b, 10, 10) === Tac.FLOOR && Tac.tile(b, 11, 10) === Tac.FLOOR, 'shooting a barrel destroys it and chains into the next one');
  check(en[0].hp === 8 && sh.ap === 0, 'the chained blast hurts the hostile beside it for 2, and the shot spent the AP (hp ' + en[0].hp + ')');
  check(ev1.some(function (e) { return e.t === 'shot' && e.to === null && e.tx === 10; }) && ev1.filter(function (e) { return e.t === 'boom'; }).length === 2, 'the shot event has no target unit and both barrels boom');
  // plain crates are not aimed at: a miss at the unit behind one can land in it (STRAY 50%) for weapon damage, 6 HP
  reset(); put(10, 10, Tac.LOW, 0); put(14, 10, Tac.HIGH, 0);
  check(Tac.objectTargets(b, sh).length === 0 && !Tac.act.shootTile(b, sh, 10, 10) && !Tac.act.shootTile(b, sh, 14, 10), 'crates and tall cover are not Shoot targets (only explosives are)');
  en[0].x = 11; en[0].y = 10;
  var seq = function (list) { var k = 0; b.rng.chance = function () { return k < list.length ? list[k++] : false; }; };
  seq([false, true]); Tac.act.shoot(b, sh, en[0]);
  check(Tac.tile(b, 10, 10) === Tac.LOW && Tac.objectAt(b, 10, 10).hp === 3, 'a stray miss chips the crate the target hides behind (hp 3/6)');
  sh.ap = 2; seq([false, false]); Tac.act.shoot(b, sh, en[0]);
  check(Tac.objectAt(b, 10, 10).hp === 3, 'a miss that does not stray leaves the crate alone');
  sh.ap = 2; seq([false, true]); Tac.act.shoot(b, sh, en[0]);
  b.rng.chance = realChance;
  check(Tac.tile(b, 10, 10) === Tac.FLOOR && b.tileHp[10 * W + 10] === undefined, 'the second stray miss breaks the crate and its HP entry is gone');
  reset(); put(10, 10, Tac.HIGH, 0); check(Tac.objectAt(b, 10, 10).maxHp === 10, 'tall cover has 10 HP');
  reset(); put(10, 10, Tac.LOW, 'barrel');
  var oi = Tac.hitInfo(b, sh, Tac.objectAt(b, 10, 10));
  check(oi.ok && oi.object && oi.parts[0][0] === 'Aim' && !oi.parts.some(function (p) { return /cover|defense/i.test(p[0]); }), 'an object hit chance has no cover or defense lines');
  // not targetable: blast-proof barrier and pillar, walls and fences
  reset(); put(10, 10, Tac.LOW, 'barrier'); put(10, 12, Tac.HIGH, 'pillar'); put(10, 8, Tac.WALL, 0); put(10, 14, Tac.PIT, 'fence');
  check(Tac.objectTargets(b, sh).length === 0 && !Tac.act.shootTile(b, sh, 10, 10) && !Tac.act.shootTile(b, sh, 10, 12) && !Tac.act.shootTile(b, sh, 10, 8) && !Tac.act.shootTile(b, sh, 10, 14), 'barriers, pillars, walls and fences cannot be shot');
  reset(); put(10, 10, Tac.LOW, 'barrel'); sh.x = 30; check(Tac.objectTargets(b, sh).length === 0, 'objects out of weapon range are not targets');
  check(Tac.objectTargets(Tac.createTraining(g, g.soldiers.slice(0, 1)), pl[0]).length === 0, 'combat training has no object targets');
  // the AI shoots a barrel with 2 hostiles beside it, and leaves it alone when one of its own side is in the blast
  reset(); put(20, 10, Tac.LOW, 'barrel'); en[0].x = 21; en[0].y = 10; en[1].x = 20; en[1].y = 11; en[2].x = 36; en[2].y = 2; sh.x = 12;
  b.rng.chance = function () { return true; };
  Tac.ai(b, sh);
  check(Tac.tile(b, 20, 10) === Tac.FLOOR && en[0].hp === 8 && en[1].hp === 8, 'the AI shoots a barrel that catches two hostiles');
  reset(); put(20, 10, Tac.LOW, 'barrel'); en[0].x = 21; en[0].y = 10; en[1].x = 20; en[1].y = 11; en[2].x = 36; en[2].y = 2; sh.x = 12; pl[1].x = 19; pl[1].y = 10;
  Tac.ai(b, sh);
  check(Tac.propOf(b, 20, 10) === 'barrel', 'the AI does not shoot a barrel with its own side in the blast');
  reset(); put(20, 10, Tac.LOW, 'barrel'); en[0].x = 21; en[0].y = 10; en[1].x = 36; en[1].y = 1; en[2].x = 36; en[2].y = 2; sh.x = 12;
  Tac.ai(b, sh);
  check(Tac.propOf(b, 20, 10) === 'barrel', 'the AI ignores a barrel that would catch only one healthy hostile');
  b.rng.chance = realChance;
})();

// Raid scenarios: node (capture / hold the server) and exterminate (no time limit), in both campaigns.
(function () {
  var Lat = XG.Lat, L = Math.max(Tac.MAP_W, Tac.MAP_H), T = D.tuning;
  // the roll is about 50/50, seeded by the mission seed, and stored on the mission with a matching brief
  var nNode = 0, same = true;
  for (var s = 1; s <= 400; s++) { var sc = Strat.rollScenario(s * 7919); if (sc === 'node') nNode++; if (Strat.rollScenario(s * 7919) !== sc) same = false; }
  check(same && nNode > 160 && nNode < 240, 'scenario roll is seeded and about 50/50 (' + nNode + '/400 node)');
  var g = S.newGame(61), r = S.rng(g), kinds = {};
  for (var k = 0; k < 30; k++) { var pm = Strat.spawnMission(g, r, 'purge'); kinds[pm.scenario] = 1; if (!/Capture|Exterminate/.test(pm.brief)) check(false, 'purge brief names the scenario'); }
  S.saveRng(g, r);
  check(kinds.node && kinds.exterminate, 'purge missions roll both scenarios');
  var lg = Lat.newGame(62); lg.day = 30;
  ['raid', 'strike'].forEach(function (kd) { var lk = {}, lr = S.rng(lg); for (var j = 0; j < 20; j++) { var lm = Lat.spawnMission(lg, lr, kd); lk[lm.scenario] = 1; } check(lk.node && lk.exterminate, 'Lattice ' + kd + ' missions roll both scenarios'); });
  check(!Lat.spawnMission(lg, S.rng(lg), 'breach').scenario && !Lat.spawnMission(lg, S.rng(lg), 'uplink').scenario && !Strat.spawnMission(g, S.rng(g), 'relay').scenario, 'breach, uplink and relay keep their own objectives');
  // FIREWALL node battle: server placement over many seeds
  var mk = function (sc, sd) { return Tac.create(g, { kind: 'purge', diff: 3, name: 't', city: 't', site: 'office block', seed: sd, scenario: sc }, g.soldiers.slice(0, 4)); };
  var placeOk = true, farOk = true, nbOk = true, minD = 1e9, nearDef = 0, nDef = 0;
  for (var sd = 1; sd <= 40; sd++) {
    var bn = mk('node', 1000 + sd * 37), sv = bn.server, open = 0;
    if (!sv || !bn.reachable[sv.y * bn.W + sv.x] || Tac.tile(bn, sv.x, sv.y) !== Tac.FLOOR || Tac.unitAt(bn, sv.x, sv.y)) placeOk = false;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if ((dx || dy) && Tac.tile(bn, sv.x + dx, sv.y + dy) === Tac.FLOOR) open++;
    if (open < 3) nbOk = false;
    var d0 = Tac.dist(sv.x, sv.y, bn.anchor.x, bn.anchor.y); minD = Math.min(minD, d0); if (d0 < L * 0.45) farOk = false;
    bn.units.forEach(function (u) { if (u.side === 'enemy') { nDef++; if (Tac.dist(u.x, u.y, sv.x, sv.y) <= 8) nearDef++; } });
  }
  check(placeOk && nbOk, 'the server sits on reachable open floor with 3+ open neighbours, nobody on it');
  check(farOk, 'the server is at least 45% of the map away from the attackers (closest ' + minD.toFixed(1) + ')');
  check(nearDef >= nDef * 0.5, 'Lattice pods gather near the server (' + nearDef + '/' + nDef + ' within 8 tiles)');
  var bx = mk('exterminate', 77);
  check(!bx.server && !bx.turnLimit && bx.mission.scenario === 'exterminate', 'exterminate: no server and no turn limit');
  bx.turn = 70; Tac.endPlayerTurn(bx); var gx = 0; while (Tac.enemyStep(bx) !== null && gx++ < 100) { }
  check(bx.outcome !== 'timeout', 'exterminate never times out');
  // the server is no cover and no target
  var b = mk('node', 4242), sv2 = b.server, W = b.W;
  var reset = function () {
    b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.faces.fill(0); b.tileHp = {}; b.outcome = null; b.captured = false; sv2.capture = 0;
    b.units.forEach(function (u, i) { u.x = (i * 3) % W; u.y = u.side === 'player' ? 0 : b.H - 1; u.alive = true; u.alerted = true; u.ap = 2; });
    b.visible.fill(true); b.explored = b.visible.slice(); b.side = 'player';
  };
  reset();
  var pl = b.units.filter(function (u) { return u.side === 'player'; }), en = b.units.filter(function (u) { return u.side === 'enemy'; });
  sv2.x = 15; sv2.y = 12;
  pl[0].x = 14; pl[0].y = 12; en[0].x = 20; en[0].y = 12;
  check(Tac.coverTile(b, 15, 12, 1, 0) === Tac.FLOOR && Tac.coverValue(b, 14, 12, 20, 12) === 0, 'the server gives no cover to a unit beside it');
  check(Tac.targets(b, en[0], 'shoot').indexOf(pl[0]) >= 0 && !Tac.targets(b, en[0], 'shoot').some(function (t) { return t.x === 15 && t.y === 12; }) && !Tac.objectAt(b, 15, 12), 'the server is not a target or a shootable object');
  check(!Tac.reach(b, pl[0], 4).d[12 * W + 15] || Tac.reach(b, pl[0], 4).d[12 * W + 15] < 0, 'nobody can step onto the server');
  var tr = pl.filter(function (u) { return u.kind === 'trooper'; })[0];
  if (tr) { tr.x = 12; tr.y = 15; tr.charges.grenade = 1; tr.ap = 2; Tac.act.grenade(b, tr, 15, 12); check(b.server.x === 15 && Tac.isServer(b, 15, 12), 'a grenade does not move or destroy the server'); }
  // capture scoring: uncontested +1, contested 0, 2 points (not in a row) wins
  reset(); sv2.x = 15; sv2.y = 12; pl[0].x = 14; pl[0].y = 11;
  var ev = []; Tac.captureTick(b, ev);
  check(sv2.capture === 1 && !b.outcome && ev.some(function (e) { return e.t === 'log' && /capture 1\/2/.test(e.msg); }), 'an attacker alone in the zone scores a capture point (log line)');
  en[0].x = 16; en[0].y = 13; ev = []; Tac.captureTick(b, ev);
  check(sv2.capture === 1 && !b.outcome && ev.some(function (e) { return e.t === 'log' && /contested/.test(e.msg); }), 'a contested zone scores nothing');
  en[0].x = 20; en[0].y = 20; pl[0].x = 30; Tac.captureTick(b, []);
  check(sv2.capture === 1, 'an empty zone scores nothing');
  pl[0].x = 16; pl[0].y = 11; b.side = 'player';
  Tac.endPlayerTurn(b);
  check(sv2.capture === 2 && b.outcome === 'win' && b.captured && Tac.result(b).captured, 'the second point (scored at the end of the attacker turn) captures the server: FIREWALL wins');
  reset(); sv2.x = 15; sv2.y = 12; en[0].alive = false; en[0].x = 15; en[0].y = 13; pl[0].x = 14; pl[0].y = 12; Tac.captureTick(b, []);
  check(sv2.capture === 1, 'a dead defender does not contest');
  // defender wins on timeout in node (FIREWALL campaign: a failed mission)
  var bt = mk('node', 99); bt.turn = bt.turnLimit;
  bt.units.forEach(function (u) { if (u.side === 'player') { u.x = 0; u.y = u.id; } });
  Tac.endPlayerTurn(bt); var gt = 0; while (Tac.enemyStep(bt) !== null && gt++ < 100) { }
  check(bt.outcome === 'timeout' && bt.turnLimit === Tac.nodeTurns('purge', !!bt.outside), 'node: the defender wins when turn ' + bt.turnLimit + ' ends without a capture (' + bt.outcome + ')');
  // Lattice raid (you defend) and strike (you attack)
  var lraid = Lat.spawnMission(lg, S.rng(lg), 'raid'); lraid.scenario = 'node';
  var br = Tac.createLattice(lraid, ['warden', 'drone', 'drone'], Lat.earthSquad(lg, lraid), {});
  check(!!br.server && br.nodeAttacker === 'player' && br.turnLimit === Tac.nodeTurns('raid', !!br.outside), 'Lattice raid node: FIREWALL attacks the server, ' + br.turnLimit + '-turn limit');
  var dd = br.units.filter(function (u) { return u.side === 'enemy'; }).map(function (u) { return Tac.dist(u.x, u.y, br.server.x, br.server.y); });
  check(dd.every(function (x) { return x <= 7; }), 'raid defenders dig in round the server (' + dd.map(function (x) { return x.toFixed(1); }).join(',') + ')');
  while (br.side !== br.human && !br.outcome) Tac.aiStep(br);
  br.units.forEach(function (u) { if (u.side === 'player') { u.x = 0; u.y = u.id; } });
  br.turn = br.turnLimit; Tac.endTurn(br);
  check(br.outcome === 'timeout' && Lat.latticeWon('raid', br.outcome, 'node'), 'raid node: holding the server to the limit is a Lattice win');
  var lex = Lat.spawnMission(lg, S.rng(lg), 'raid'); lex.scenario = 'exterminate';
  var be = Tac.createLattice(lex, ['warden', 'drone'], Lat.earthSquad(lg, lex), {});
  check(!be.server && be.turnLimit === 0, 'raid exterminate: no server, no time limit');
  while (be.side !== be.human && !be.outcome) Tac.aiStep(be);
  be.turn = 80; Tac.endTurn(be);
  check(be.outcome !== 'timeout', 'raid exterminate never times out');
  var lst = Lat.spawnMission(lg, S.rng(lg), 'strike'); lst.scenario = 'node';
  var bs = Tac.createLattice(lst, ['warden', 'drone', 'drone'], Lat.earthSquad(lg, lst), {});
  check(!!bs.server && bs.nodeAttacker === 'enemy' && bs.side === 'enemy', 'strike node: you attack the server and move first');
  var me = bs.units.filter(function (u) { return u.side === 'enemy' && !u.isStatic; })[0];
  bs.units.forEach(function (u) { if (u.side === 'player') { u.x = 0; u.y = u.id; } });
  bs.server.capture = 1; me.x = bs.server.x + 1; me.y = bs.server.y; if (Tac.tile(bs, me.x, me.y) !== Tac.FLOOR) me.x = bs.server.x - 1;
  bs.tiles[me.y * bs.W + me.x] = Tac.FLOOR;
  Tac.endTurn(bs);
  check(bs.outcome === 'loss' && bs.captured && Lat.latticeWon('strike', bs.outcome, 'node'), 'strike node: the Lattice captures the server at the end of its turn (FIREWALL loss = your win)');
  check(Lat.latticeWon('raid', 'timeout', 'node') && !Lat.latticeWon('strike', 'timeout', 'node') && Lat.latticeWon('raid', 'loss', 'exterminate') && !Lat.latticeWon('raid', 'win', 'exterminate') && !Lat.latticeWon('strike', 'win', 'node') && Lat.latticeWon('strike', 'loss', 'exterminate'),
    'latticeWon: a timeout counts only for the node defender; wipes and captures as usual');
  var lsx = Lat.spawnMission(lg, S.rng(lg), 'strike'); lsx.scenario = 'exterminate';
  check(Tac.createLattice(lsx, ['drone'], Lat.earthSquad(lg, lsx), {}).turnLimit === 0, 'strike exterminate has no time limit');
  // the scenario and the server survive a JSON snapshot + Restart; the server stays put, squads move, capture resets
  var restartOk = true, awayOk = true, moved2 = 0;
  [mk('node', 555), br.server && Tac.createLattice(lraid, ['warden', 'drone', 'drone'], Lat.earthSquad(lg, lraid), {}), Tac.createLattice(lst, ['warden', 'drone'], Lat.earthSquad(lg, lst), {})].forEach(function (b0) {
    for (var rs = 1; rs <= 6; rs++) {
      var b1 = JSON.parse(JSON.stringify(b0)); b1.rng = Object.assign(new XG.RNG(1), b1.rng); b1.server.capture = 1;
      Tac.redeploy(b1, rs * 13);
      if (b1.mission.scenario !== 'node' || b1.server.x !== b0.server.x || b1.server.y !== b0.server.y || b1.server.capture !== 0 || b1.turnLimit !== b0.turnLimit || b1.nodeAttacker !== b0.nodeAttacker) restartOk = false;
      if (b1.units.some(function (u) { return u.alive && Tac.isServer(b1, u.x, u.y); })) restartOk = false;
      if (Tac.dist(b1.anchor.x, b1.anchor.y, b1.server.x, b1.server.y) < L * 0.45) awayOk = false;
      if (b1.anchor.x !== b0.anchor.x || b1.anchor.y !== b0.anchor.y) moved2++;
    }
  });
  check(restartOk, 'node scenario, server spot and turn limit survive snapshot + Restart (capture resets)');
  check(awayOk, 'after a Restart the attackers still land 45%+ of the map from the server');
  check(moved2 >= 12, 'Restart still moves the squads (' + moved2 + '/18)');
  // Restart varies only spawn points and patrol routes: statics (relay, uplink core) and the server keep their tiles, the map,
  // units and stats stay, squads land elsewhere and pods walk new routes
  var keepOk = true, squadMoves = 0, routeMoves = 0, runs = 0, farOk2 = true, sameOk = true;
  var gens = [function (sd) { return Tac.create(g, { kind: 'relay', diff: 3, name: 't', city: 't', site: 'x', seed: sd }, g.soldiers.slice(0, 4)); },
    function (sd) { return Tac.create(g, { kind: 'uplink', diff: 4, name: 't', city: 't', site: 'x', seed: sd }, g.soldiers.slice(0, 4)); },
    function (sd) { return mk('node', sd); },
    function (sd) { var um = Lat.spawnMission(lg, S.rng(lg), 'uplink'); um.seed = sd; return Tac.createLattice(um, ['warden', 'drone', 'drone'], Lat.earthSquad(lg, um), {}); }];
  gens.forEach(function (gen) {
    for (var sd = 1; sd <= 5; sd++) {
      var b0 = gen(300 + sd * 61), pos = function (bb) { return bb.units.filter(function (u) { return u.isStatic; }).map(function (u) { return u.x + ',' + u.y; }).join(' ') + (bb.server ? ' S' + bb.server.x + ',' + bb.server.y : ''); };
      var sq = function (bb) { return bb.units.filter(function (u) { return u.side === bb.deployInfo.aSide && !u.isStatic; }).map(function (u) { return u.x + ',' + u.y; }).join(' '); };
      var stats = function (bb) { return bb.units.map(function (u) { return [u.id, u.kind, u.hp, u.maxHp, u.aim, u.mobility, u.armor].join(':'); }).join(); };
      var routes = function (bb) { return JSON.stringify((bb.pods || []).map(function (P) { return P.route; })); };
      var snapS = JSON.stringify(b0);
      [7, 8].forEach(function (rs) {
        var b1 = JSON.parse(snapS); b1.rng = Object.assign(new XG.RNG(1), b1.rng); Tac.redeploy(b1, rs * 977 + sd); runs++;
        if (pos(b1) !== pos(b0)) keepOk = false;
        if (sq(b1) !== sq(b0)) squadMoves++;
        if ((b0.pods || []).length && routes(b1) !== routes(b0)) routeMoves++;
        if (stats(b1) !== stats(b0) || JSON.stringify(b1.base) !== JSON.stringify(b0.base) || JSON.stringify(b1.tileHp) !== JSON.stringify(b0.tileHp)) sameOk = false;
        b1.units.forEach(function (u) { if (u.isStatic && Tac.dist(u.x, u.y, b1.anchor.x, b1.anchor.y) < L * 0.4) farOk2 = false; });
      });
    }
  });
  check(keepOk, 'Restart keeps statics (relay, uplink core) and the server on their tiles');
  check(sameOk, 'Restart keeps the map, tile HP, unit composition and stats');
  check(squadMoves >= runs * 0.8 && routeMoves >= 18, 'Restart moves the squads (' + squadMoves + '/' + runs + ') and re-rolls pod routes (' + routeMoves + ')');
  check(farOk2, 'after a Restart the squad still lands far from the fixed statics');
})();

// Windows (outside maps): impassable, see-through, half cover in front, full cover beside (behind the wall) with a lean out
// through the window; a stray miss or a blast shatters one into an empty frame, which stays impassable and see-through.
(function () {
  var g = S.newGame(23), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  var b = Tac.create(g, Object.assign({}, m, { diff: 1, scenario: 'exterminate' }), g.soldiers.slice(0, 4)), W = b.W;
  b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.faces.fill(0); b.tileHp = {}; b.outcome = null; delete b.outside;
  b.units.forEach(function (u) { if (u.side === 'enemy') u.alive = false; });
  var sq = b.units.filter(function (u) { return u.side === 'player'; }), foe = b.units.filter(function (u) { return u.side === 'enemy'; })[0];
  sq.forEach(function (u, i) { u.x = 0; u.y = 20 + i; u.hp = u.maxHp = 10; u.armor = 0; u.shield = 0; u.aim = 70; u.range = 14; });
  foe.alive = true; foe.hp = foe.maxHp = 30; foe.armor = 0; foe.defense = 0; foe.range = 14;
  for (var x = 8; x <= 18; x++) b.tiles[10 * W + x] = Tac.WALL;
  b.tiles[10 * W + 13] = Tac.LOW; b.props[10 * W + 13] = 'window';
  b.visible = b.visible.map(function () { return true; });
  var front = sq[0], beside = sq[1], mid = sq[2];
  front.x = 13; front.y = 11; beside.x = 12; beside.y = 11; mid.x = 10; mid.y = 11;
  front.ap = beside.ap = 2;
  check(Tac.reach(b, front, 4).d[10 * W + 13] < 0 && Tac.reach(b, front, 4).d[9 * W + 13] < 0, 'window: blocks movement (and the wall round it seals the room)');
  foe.x = 13; foe.y = 5;
  check(Tac.los(b, foe.x, foe.y, front.x, front.y) && Tac.hitInfo(b, foe, front).cover === 20, 'window: see and shoot through it; half cover for the unit right in front (' + Tac.hitInfo(b, foe, front).cover + ')');
  foe.x = 13; foe.y = 9; front.x = 13; front.y = 15;
  check(Tac.hitInfo(b, front, foe).cover === 20, 'window: half cover on the other side too, against fire through it');
  front.x = 13; front.y = 11; foe.x = 12; foe.y = 5;
  var hb = Tac.hitInfo(b, foe, beside), out = Tac.hitInfo(b, beside, foe);
  check(hb.ok && hb.cover === 40 && out.ok, 'window: a unit beside it behind the wall has full cover and leans out through it (cover ' + hb.cover + ', fires back ' + out.ok + ')');
  foe.x = 10; foe.y = 5;
  check(!Tac.los(b, mid.x, mid.y, foe.x, foe.y), 'window: a unit mid-wall (no window beside it) cannot see out');
  // a stray miss at the unit behind it shatters it (hit roll fails, then the STRAY roll lands in the window)
  mid.x = 0; mid.y = 25; front.x = 13; front.y = 5; front.ap = 2; foe.x = 13; foe.y = 11; foe.hp = 30;
  var real = b.rng.chance, seq = [false, true];
  b.rng.chance = function () { return seq.length ? seq.shift() : false; };
  var evs = Tac.act.shoot(b, front, foe);
  b.rng.chance = real;
  check(Tac.tile(b, 13, 10) === Tac.FLOOR && !Tac.propOf(b, 13, 10) && foe.hp === 30, 'window: a stray miss shatters it into an open gap (' + Tac.tile(b, 13, 10) + ')');
  front.x = 13; front.y = 11; foe.x = 13; foe.y = 5;
  check(!!evs && evs.some(function (e) { return e.t === 'shatter'; }), 'window: shattering emits a shatter event');
  check(Tac.reach(b, front, 4).d[10 * W + 13] > 0 && Tac.hitInfo(b, foe, front).cover === 0 && !Tac.objectAt(b, 13, 10), 'shattered window: an open gap you can walk through, no cover, nothing left to break');
  // a blast shatters a window too; the frame survives the next one
  b.tiles[10 * W + 15] = Tac.LOW; b.props[10 * W + 15] = 'window';
  var evb = [];
  check(Tac.clearTile(b, 15, 10, evb, 'blast') && Tac.tile(b, 15, 10) === Tac.FLOOR && evb.some(function (e) { return e.t === 'shatter'; }), 'window: a blast shatters it into an open gap');
  check(Tac.tile(b, 15, 10) === Tac.FLOOR && !Tac.unitAt(b, 15, 10), 'a shattered window can be walked through');
})();

// Rooms are strong points: a walled room (x 10..18, y 5..13) with two doorways on its east wall, (18,8) and (18,11). A unit inside
// can be seen or shot only along a real ray through a doorway (from where the shooter stands or leans), where "through" is the
// geometric rule: the ray clears both jambs, each shrunk by Tac.LOS_MARGIN; a unit in a doorway step-peeks only out of either
// side of the door; a lean beside a jamb sees through the gap but not along the inside of the wall; fog shows exactly what LOS sees.
(function () {
  var g = S.newGame(25), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  var b = Tac.create(g, Object.assign({}, m, { diff: 1, scenario: 'exterminate' }), g.soldiers.slice(0, 2)), W = b.W;
  b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.faces.fill(0); b.tileHp = {}; b.outcome = null; delete b.outside;
  var sh = b.units[0], tg = b.units.filter(function (u) { return u.side === 'enemy'; })[0];
  b.units = [sh, tg]; sh.alive = tg.alive = true;
  var X0 = 10, X1 = 18, Y0 = 5, Y1 = 13, doors = [8, 11], inside = function (x, y) { return x > X0 && x < X1 && y > Y0 && y < Y1; };
  for (var y = Y0; y <= Y1; y++) for (var x = X0; x <= X1; x++) if (x === X0 || x === X1 || y === Y0 || y === Y1) b.tiles[y * W + x] = Tac.WALL;
  doors.forEach(function (dy) { b.tiles[dy * W + X1] = Tac.FLOOR; });
  var Mg = Tac.LOS_MARGIN, rayDoor = function (a, c) { // does the straight ray between the two tile centres pass the east wall (x = 18) through a doorway, clear of both (shrunk) jambs?
    if ((a[0] - X1) * (c[0] - X1) >= 0) return a[0] === X1 && doors.indexOf(a[1]) >= 0 || c[0] === X1 && doors.indexOf(c[1]) >= 0;
    var yAt = function (x) { return a[1] + (x - a[0]) * (c[1] - a[1]) / (c[0] - a[0]); }, ya = yAt(X1 - 0.5 + Mg), yb = yAt(X1 + 0.5 - Mg);
    return doors.some(function (dy) { return [ya, yb].every(function (yy) { return Math.abs(yy - dy) <= 0.5 + Mg + 1e-9; }); });
  };
  var leaks = [], seen = 0;
  for (var sy = 0; sy < 22; sy++) for (var sx = 4; sx <= 32; sx++) {
    if (inside(sx, sy) || b.tiles[sy * W + sx] !== Tac.FLOOR) continue;
    sh.x = sx; sh.y = sy;
    var SL = [[sx, sy]].concat(Tac.peekSpots(b, sx, sy));
    for (var ty = Y0 + 1; ty < Y1; ty++) for (var tx = X0 + 1; tx < X1; tx++) {
      if (Tac.dist(sx, sy, tx, ty) > 14) continue;
      tg.x = tx; tg.y = ty;
      if (!Tac.los(b, sx, sy, tx, ty)) continue;
      seen++;
      var TL = [[tx, ty]].concat(Tac.peekSpots(b, tx, ty));
      var ok = SL.some(function (p) { return TL.some(function (q) { return rayDoor(p, q); }); });
      if (!ok) leaks.push(sx + ',' + sy + '>' + tx + ',' + ty);
    }
  }
  check(seen > 100 && !leaks.length, 'room: units inside are seen only along a real ray through a doorway (' + seen + ' sightings, leaks: ' + leaks.slice(0, 6).join(' ') + ')');
  tg.x = 40; tg.y = 40;
  var dps = Tac.peekSpots(b, X1, 8);
  check(dps.length === 2 && dps.every(function (p) { return p[1] === 8 && (p[0] === X1 - 1 || p[0] === X1 + 1); }), 'room: a unit in a doorway step-peeks out of either side of the door only, never along the wall');
  sh.x = 19; sh.y = 7;
  var deep = [[17, 6], [17, 10], [17, 12], [16, 6]].filter(function (p) { return Tac.los(b, 19, 7, p[0], p[1]); });
  check(!deep.length && Tac.los(b, 19, 7, 14, 8), 'room: a lean beside a door jamb sees through the gap, not along the inside of the wall (' + JSON.stringify(deep) + ')');
  tg.x = 17; tg.y = 7; var fan = [], wide = 0;
  for (var fy = 0; fy < 22; fy++) for (var fx = 19; fx <= 32; fx++) { sh.x = fx; sh.y = fy; if (Tac.los(b, fx, fy, 17, 7)) { fan.push([fx, fy]); if (fx <= 20 && fy <= 6) wide++; } }
  check(fan.length > 0 && !wide && Tac.hitInfo(b, { x: 25, y: 8, range: 14, aim: 70, close: 10, side: 'player' }, tg).cover === 40, 'room: a defender beside a doorway is seen only through the doorway, never from along the outside of the wall, in full cover (' + fan.length + ' tiles, ' + wide + ' along the wall)');
  // a unit hugging the inside of the wall two tiles from the door: hidden from everywhere outside except a steep line through the doorway
  tg.x = 17; tg.y = 6; var hug = [];
  for (var hy = 0; hy < 22; hy++) for (var hx = 4; hx <= 32; hx++) { if (inside(hx, hy) || b.tiles[hy * W + hx] !== Tac.FLOOR) continue; sh.x = hx; sh.y = hy; if (Tac.dist(hx, hy, 17, 6) <= 14 && Tac.los(b, hx, hy, 17, 6)) hug.push([hx, hy]); }
  check(hug.length <= 16 && hug.every(function (p) { return p[0] >= X1 && p[1] - 6 >= 1.5 * (p[0] - 17); }), 'room: a unit hugging the inside of the wall is hidden from outside except along a steep ray through the doorway (' + JSON.stringify(hug) + ')');
  // fog shows exactly what line of sight sees: the room stays dark except along the rays through its doorways
  sh.x = 21; sh.y = 6; tg.x = 40; tg.y = 40; b.visible = null; b.explored = null; Tac.refreshVis(b);
  var fogOk = true;
  for (var vy = Y0 + 1; vy < Y1; vy++) for (var vx = X0 + 1; vx < X1; vx++) if (!!b.visible[vy * W + vx] !== (Tac.dist(21, 6, vx, vy) <= Tac.SIGHT && Tac.los(b, 21, 6, vx, vy))) fogOk = false;
  check(fogOk && !b.visible[12 * W + 11], 'room: fog reveals inside only what line of sight through the doorways reaches');
  // solid vs fire-through: a run of tall cover blocks sight and fire (only its ends can be leaned round); low cover and glass do not
  b.tiles.fill(Tac.FLOOR);
  for (var k = 14; k <= 16; k++) b.tiles[20 * W + k] = Tac.HIGH;
  tg.x = 15; tg.y = 21; sh.x = 15; sh.y = 14;
  check(Tac.blocksFire(b, 15, 20) && !Tac.los(b, 15, 14, 15, 21), 'solid: a unit mid-way behind a run of tall cover cannot be seen or shot from straight ahead');
  tg.x = 16; tg.y = 21;
  check(Tac.los(b, 15, 14, 16, 21) && Tac.hitInfo(b, { x: 15, y: 14, range: 14, aim: 70, close: 10, side: 'player' }, tg).cover === 40, 'solid: a unit at the end leans round it, still in full cover');
  b.tiles[20 * W + 15] = Tac.LOW; tg.x = 15; tg.y = 21;
  check(!Tac.blocksFire(b, 15, 20) && Tac.los(b, 15, 14, 15, 21), 'fire-through: low cover can be shot over');
  b.tiles[20 * W + 15] = Tac.HIGH; b.props[20 * W + 15] = 'glass';
  check(!Tac.blocksFire(b, 15, 20) && Tac.los(b, 15, 14, 15, 21) && Tac.hitInfo(b, { x: 15, y: 14, range: 14, aim: 70, close: 10, side: 'player' }, tg).cover === 40, 'fire-through: glass is full cover you can see and shoot through');
  b.props[20 * W + 15] = 'pillar';
  check(Tac.blocksFire(b, 15, 20), 'solid: a pillar blocks sight and fire');
  // geometric LOS: a staircase of solid tiles touching only at their corners is still a closed wall (no ray slips between a diagonal pair)
  b.tiles.fill(Tac.FLOOR); b.props.fill(0); tg.x = 40; tg.y = 40; sh.x = 40; sh.y = 41;
  for (var st = 20; st <= 23; st++) b.tiles[st * W + st] = Tac.WALL;
  var slip = [];
  for (var py = 14; py <= 30; py++) for (var px = 14; px <= 30; px++) for (var qy = 14; qy <= 30; qy++) for (var qx = 14; qx <= 30; qx++) {
    if (px - py > -1 || qx - qy < 1) continue;
    var cc = px + (qx - px) * (px - py) / ((px - py) - (qx - qy)); // where the segment crosses the diagonal x = y
    if (cc > 20 && cc < 23 && Tac.lineClear(b, px, py, qx, qy)) slip.push(px + ',' + py + '>' + qx + ',' + qy);
  }
  check(!slip.length, 'LOS: no line slips between solid tiles that touch at a corner (' + slip.slice(0, 5).join(' ') + ')');
  b.tiles.fill(Tac.FLOOR); b.tiles[20 * W + 20] = Tac.HIGH;
  check(Tac.lineClear(b, 19, 19, 21, 21) === false && Tac.lineClear(b, 19, 20, 22, 18) && !Tac.lineClear(b, 18, 21, 22, 19), 'LOS: a line may clip the corner of tall cover, not its middle');
})();

// The user's "LOS in a box" screenshot (2026-10-22): a room with two windows in its west wall, one in its south wall, a gap in the
// top wall and an opening east onto a corridor; racks (solid) and desks (fire-through) inside. Each yellow arrow the user drew is
// a line the unit must see along, both ways (a unit placed at the far end sees it back). Local coordinates: the room is x 0..7, y 0..7.
(function () {
  var g = S.newGame(25), r = S.rng(g), m = Strat.spawnMission(g, r, 'purge'); S.saveRng(g, r);
  var b = Tac.create(g, Object.assign({}, m, { diff: 1, scenario: 'exterminate' }), g.soldiers.slice(0, 2)), W = b.W;
  b.tiles.fill(Tac.FLOOR); b.props.fill(0); b.faces.fill(0); b.tileHp = {}; b.outcome = null; delete b.outside;
  var OX = 14, OY = 9, P = function (x, y, t, p) { b.tiles[(OY + y) * W + OX + x] = t; b.props[(OY + y) * W + OX + x] = p || 0; };
  for (var y = 0; y <= 7; y++) for (var x = 0; x <= 7; x++) if (x === 0 || x === 7 || y === 0 || y === 7) P(x, y, Tac.WALL);
  P(5, 0, Tac.FLOOR); P(7, 1, Tac.FLOOR);
  P(0, 2, Tac.LOW, 'window'); P(0, 5, Tac.LOW, 'window'); P(3, 7, Tac.LOW, 'window');
  P(2, 2, Tac.HIGH, 'rack'); P(4, 2, Tac.HIGH, 'rack'); P(2, 5, Tac.LOW, 'desk'); P(3, 5, Tac.LOW, 'desk'); P(5, 4, Tac.LOW, 'desk');
  var probe = b.units[0], unit = b.units.filter(function (u) { return u.side === 'enemy'; })[0];
  b.units = [probe, unit]; probe.alive = unit.alive = true;
  // the units in the picture: S selected top right, TL top left, D1 below it, O the orange one, BL bottom left
  var U = { S: [4, 1], TL: [1, 1], D1: [1, 3], O: [1, 4], BL: [1, 6] };
  var arrows = [['S', 8, -2], ['S', 9, 1], ['S', -2, 2], ['S', 5, 3], ['S', 6, 5], ['S', 1, 6], ['S', -1, 6], ['TL', -2, 5], ['D1', -2, -1],
    ['O', 2, 3], ['O', -2, 8], ['BL', -2, 2], ['BL', 2, 3], ['BL', 6, 5], ['BL', 5, 8], ['BL', 3, 7]];
  var miss = [];
  arrows.forEach(function (a) {
    var sx = OX + U[a[0]][0], sy = OY + U[a[0]][1], tx = OX + a[1], ty = OY + a[2];
    unit.x = sx; unit.y = sy; probe.x = tx; probe.y = ty;
    if (Tac.tile(b, tx, ty) !== Tac.FLOOR) { probe.x = 0; probe.y = 0; }
    if (!(Tac.dist(sx, sy, tx, ty) <= Tac.SIGHT && Tac.los(b, sx, sy, tx, ty) && Tac.los(b, tx, ty, sx, sy))) miss.push(a.join(','));
  });
  check(!miss.length, 'room arrows: every line the user drew is seen both ways (' + miss.join(' ') + ')');
  // and the room still blocks what it should: a wall hides a unit straight behind it, and the rack hides the tile straight below it
  unit.x = OX + 6; unit.y = OY + 3; probe.x = OX + 10; probe.y = OY + 3;
  check(!Tac.los(b, unit.x, unit.y, probe.x, probe.y), 'room arrows: a unit hugging the east wall is still hidden straight through it');
  unit.x = OX + 2; unit.y = OY + 1; probe.x = OX + 2; probe.y = OY + 4;
  check(!Tac.lineClear(b, unit.x, unit.y, probe.x, probe.y), 'room arrows: a rack still blocks the line straight through it');
})();

// Outside maps: one building holds the server (node) or the defenders (exterminate); the attackers land in the yard.
(function () {
  var Lat = XG.Lat, g = S.newGame(24), L = Math.max(Tac.MAP_W, Tac.MAP_H), lg = Lat.newGame(77); lg.day = 30;
  var nn = 0, ne = 0;
  for (var s = 1; s <= 2000; s++) { if (Strat.rollOutside(s * 7919, 'node')) nn++; if (Strat.rollOutside(s * 7919, 'exterminate')) ne++; }
  check(nn > 700 && nn < 900 && ne > 220 && ne < 380 && !Strat.rollOutside(5, null), 'outside layout rolls ~40% of node and ~15% of exterminate missions, never legacy ones (' + nn + ', ' + ne + ' of 2000)');
  var cases = [];
  for (var sd = 1; sd <= 12; sd++) {
    cases.push(Tac.create(g, { kind: 'purge', diff: 3, name: 't', city: 't', site: 'x', seed: 400 + sd * 97, scenario: 'node', layout: 'outside' }, g.soldiers.slice(0, 4)));
    if (sd <= 4) cases.push(Tac.create(g, { kind: 'purge', diff: 3, name: 't', city: 't', site: 'x', seed: 900 + sd * 97, scenario: 'exterminate', layout: 'outside' }, g.soldiers.slice(0, 4)));
    if (sd <= 4) ['raid', 'strike'].forEach(function (kd) {
      var lm = Lat.spawnMission(lg, S.rng(lg), kd); lm.seed = 500 + sd * 31; lm.scenario = sd % 2 ? 'node' : 'exterminate'; lm.layout = 'outside';
      cases.push(Tac.createLattice(lm, ['warden', 'drone', 'drone', 'harmonic'], Lat.earthSquad(lg, lm), {}));
    });
  }
  var layOk = true, srvOk = true, entOk = true, spawnOk = true, winOk = true, furnOk = true, limOk = true, sameOk = true, moveOk = 0, why = '';
  var zoneReach = function (b, doors, keep) { // the server zone (or, without a server, the building) reached from squad A's anchor using only door `keep`
    var t = b.tiles.slice(); doors.forEach(function (d, i) { if (i !== keep) t[d[1] * b.W + d[0]] = Tac.WALL; });
    var bb = { W: b.W, H: b.H, tiles: t, units: [], server: b.server }, rr = Tac.reach(bb, { x: b.anchor.x, y: b.anchor.y }, 400);
    var S2 = b.server || { x: b.outside.server[0], y: b.outside.server[1] };
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if ((dx || dy) && rr.d[(S2.y + dy) * b.W + S2.x + dx] > 0) return true;
    return false;
  };
  cases.forEach(function (b) {
    var o = b.outside, aSide = b.deployInfo.aSide;
    if (b.layout !== 'outside' || !o) { layOk = false; return; }
    var area = o.w * o.h / (b.W * b.H);
    if (area < 0.28 || area > 0.47 || o.doors.length < 2 || o.doors.length > 4) { layOk = false; why += ' area/doors ' + area.toFixed(2) + '/' + o.doors.length; }
    if (b.server && (b.server.x !== o.server[0] || b.server.y !== o.server[1] || !Tac.indoor(b, b.server.x, b.server.y))) srvOk = false;
    if (b.server && o.doors.some(function (d) { return Tac.cheb(d[0], d[1], b.server.x, b.server.y) < 3; })) srvOk = false;
    if (o.doors.filter(function (d, i) { return zoneReach(b, o.doors, i); }).length < 2) entOk = false;
    if (b.mission.scenario === 'node' && b.turnLimit !== Tac.nodeTurns(b.mission.lkind || 'purge', true)) limOk = false;
    var check1 = function (bb) {
      bb.units.forEach(function (u) { if (!u.alive || u.isStatic) return; var inside = Tac.indoor(bb, u.x, u.y); if ((u.side === aSide) === inside) spawnOk = false; });
      if (o.doors.some(function (d) { return Tac.dist(d[0], d[1], bb.anchor.x, bb.anchor.y) < L * 0.4; }) || bb.anchor.edge !== o.edge) spawnOk = false;
    };
    check1(b);
    var wins = 0;
    b.props.forEach(function (p, i) {
      var x = i % b.W, y = (i - x) / b.W;
      if (p === 'window') {
        wins++;
        var h = Tac.tile(b, x - 1, y) === Tac.WALL && Tac.tile(b, x + 1, y) === Tac.WALL, v = Tac.tile(b, x, y - 1) === Tac.WALL && Tac.tile(b, x, y + 1) === Tac.WALL;
        if (!(h || v) || Tac.tile(b, x, y) !== Tac.LOW) winOk = false;
      }
      if ((p === 'desk' || p === 'rack') && !Tac.indoor(b, x, y)) furnOk = false;
    });
    if (wins < 3) winOk = false;
    var snap = JSON.stringify(b);
    [11, 12].forEach(function (rs) {
      var b1 = JSON.parse(snap); b1.rng = Object.assign(new XG.RNG(1), b1.rng); Tac.redeploy(b1, rs * 131);
      if (JSON.stringify(b1.base) !== JSON.stringify(b.base) || JSON.stringify(b1.tiles) !== JSON.stringify(b.tiles) || JSON.stringify(b1.props) !== JSON.stringify(b.props) || JSON.stringify(b1.outside) !== JSON.stringify(o) || JSON.stringify(b1.server) !== JSON.stringify(b.server)) sameOk = false;
      check1(b1);
      if (JSON.stringify(b1.units.map(function (u) { return [u.x, u.y]; })) !== JSON.stringify(b.units.map(function (u) { return [u.x, u.y]; }))) moveOk++;
    });
  });
  check(layOk, 'outside: one building of 28-47% of the map with 2-4 entrances' + why);
  check(srvOk, 'outside: the server sits in the building, 3+ tiles from every entrance');
  check(entOk, 'outside: the server zone can be reached through at least 2 different entrances');
  check(spawnOk, 'outside: the attackers land in the yard on the approach edge, 40%+ of the map from every entrance; the defenders start inside (also after Restart)');
  check(winOk, 'outside: 3+ windows, each set in the outer wall between two wall tiles');
  check(furnOk, 'outside: desks and racks only inside the building');
  check(limOk, 'outside: node battles use tuning.nodeTurnsOutside');
  check(sameOk, 'outside: Restart keeps the building, windows, server and every tile identical');
  check(moveOk >= cases.length, 'outside: Restart moves the squads (' + moveOk + '/' + cases.length * 2 + ')');
})();

// ---------------------------------------------------------------- battles
var nb = +process.argv[2] || 60, tally = {};
for (var i = 0; i < nb; i++) {
  var g = S.newGame(1000 + i);
  var kinds = ['purge', 'purge', 'relay', 'uplink'], kind = kinds[i % 4];
  var r = S.rng(g), m = Strat.spawnMission(g, r, kind); S.saveRng(g, r);
  m.diff = kind === 'uplink' ? 4 : 1 + (i % 5);
  if (i % 3 === 0) { g.research.done.push('lattice_grammar', 'halcyon'); g.flags.emp = true; }
  var squad = g.soldiers.slice(0, 4);
  var b = autoBattle(g, m, squad);
  var sk = (m.scenario ? '-' + (m.scenario === 'node' ? 'node' : 'ext') : '') + (b.layout === 'outside' ? '-out' : '');
  if (!b.outcome) stalled.fw++;
  [kind + sk + ' d' + m.diff, kind + sk + ' ALL'].forEach(function (key) {
    tally[key] = tally[key] || { win: 0, loss: 0, timeout: 0, none: 0, cap: 0, turns: 0, n: 0 };
    tally[key][b.outcome || 'none']++; tally[key].turns += b.turn; tally[key].n++; if (b.captured) tally[key].cap++;
  });
  var res = Tac.result(b), out = Strat.resolveMission(g, m.id, res);
  check(out.outcome === (b.outcome || 'abort'), 'resolve keeps outcome');
}
console.log('Battles (AI vs AI):');
Object.keys(tally).sort().forEach(function (k) {
  var t = tally[k];
  console.log('  ' + k.padEnd(15) + ' win ' + t.win + (t.cap ? ' (cap ' + t.cap + ')' : '') + '  loss ' + t.loss + '  timeout ' + t.timeout + '  stalled ' + t.none + '  avg turns ' + (t.turns / t.n).toFixed(1));
});

// -------------------------------------------------------------- campaigns
var nc = +process.argv[3] || 10, ends = { victory: 0, defeat: 0, none: 0 }, days = [];
var order = ['signal_analysis', 'lattice_grammar', 'drone_teardown', 'halcyon', 'relay_analysis', 'squad_size', 'emp', 'faraday', 'triangulation', 'coilguns', 'firewall'];
for (var c = 0; c < nc; c++) {
  var gc = S.newGame(5000 + c + (+process.env.CAMP_SEED || 0)); // CAMP_SEED=n shifts the seeds (parallel balance runs)
  for (var d = 0; d < 400 && !gc.over; d++) {
    if (!gc.research.current) order.some(function (t) { return Strat.startResearch(gc, t); });
    var slot = gc.base.indexOf(null);
    ['lab', 'generator', 'workshop', 'infirmary', 'lab', 'server', 'generator'].some(function (f) {
      return slot >= 0 && Strat.built(gc, f) + gc.base.filter(function (x) { return x && x.type === f && x.daysLeft; }).length < (f === 'lab' || f === 'generator' ? 2 : 1) && Strat.build(gc, f, slot);
    });
    ['emp_grenades', 'faraday_armor', 'coil_weapons'].forEach(function (f) { Strat.fabricate(gc, f); });
    if (Strat.has(gc, 'halcyon') && !gc.fabricated.sentinel) Strat.fabricate(gc, 'sentinel');
    if (gc.soldiers.length < 6) Strat.hire(gc, ['trooper', 'hacker', 'scientist'][gc.soldiers.length % 3]);
    // take story missions first, then whatever expires soonest
    var ms = gc.missions.slice().sort(function (a, b2) { return (a.daysLeft === null ? -1 : a.daysLeft) - (b2.daysLeft === null ? -1 : b2.daysLeft); });
    var mm = ms[0];
    var ready = gc.soldiers.filter(function (s) { return S.available(gc, s); });
    if (mm && ready.length >= 3 && (mm.kind !== 'uplink' || ready.length >= 4)) {
      var bb = autoBattle(gc, mm, ready.slice(0, Strat.squadSize(gc)));
      Strat.resolveMission(gc, mm.id, Tac.result(bb));
    }
    Strat.advanceDay(gc);
    gc.storyQueue.length = 0;
  }
  ends[gc.over || 'none']++; days.push(gc.day);
  console.log('  campaign ' + c + ': ' + (gc.over || 'unfinished') + ' on day ' + gc.day + ', conv ' + gc.convergence.toFixed(1) +
    '%, won ' + gc.stats.missionsWon + ' lost ' + gc.stats.missionsLost + ' expired ' + gc.stats.expired + ', KIA ' + gc.memorial.length + ', techs ' + gc.research.done.length + ', salvage ' + gc.salvage + ', credits ' + gc.credits + ', roster ' + gc.soldiers.length);
}
console.log('Campaigns: ' + JSON.stringify(ends) + '  avg end day ' + (days.reduce(function (a, x) { return a + x; }, 0) / days.length).toFixed(0));

// ================================================================ LATTICE side
var Lat = XG.Lat;

// Plays a Lattice-controlled battle: the shared AI drives the Lattice "human" side too.
function autoLattice(g, m, types) {
  var b = Tac.createLattice(m, types, Lat.earthSquad(g, m), Lat.mods(g));
  check(b.human === 'enemy', 'lattice battle is human-controlled on the Lattice side');
  // safety cap for the harness only (exterminate has no clock): a battle past STALL turns counts as stalled
  for (var guard = 0; guard < 400 && !b.outcome && b.turn <= STALL; guard++) {
    if (b.side === b.human) {
      b.units.filter(function (u) { return u.alive && u.side === 'enemy' && !u.isStatic; }).forEach(function (u) {
        if (b.outcome) return;
        if (u.abilities.indexOf('spike') >= 0) { var t = Tac.targets(b, u, 'spike')[0]; if (t && Tac.act.spike(b, u, t)) return; }
        if (u.abilities.indexOf('detonate') >= 0 && u.hp <= 2 && b.units.some(function (o) { return o.alive && o.side === 'player' && Tac.cheb(o.x, o.y, u.x, u.y) <= 1; }) && Tac.act.detonate(b, u)) return;
        Tac.ai(b, u);
      });
      if (!b.outcome) Tac.endTurn(b);
    } else {
      var n = 0;
      while (!b.outcome && b.side !== b.human && n++ < 60) Tac.aiStep(b);
      check(n < 60, 'AI FIREWALL turn terminates');
    }
  }
  check(!!b.outcome || b.turn > STALL, 'lattice battle ends');
  if (!b.outcome) stalled.lat++;
  if (!b.outcome && b.turn <= STALL) console.log('    stalled:', m.kind, 'turn', b.turn, b.units.filter(function (u) { return u.alive; }).map(function (u) { return u.side[0] + ':' + u.kind + '@' + u.x + ',' + u.y + ' ap' + u.ap; }).join(' '));
  b.units.forEach(function (u) {
    if (!u.alive) return;
    b.units.forEach(function (o) { if (o !== u && o.alive && o.x === u.x && o.y === u.y) check(false, 'lattice battle units overlap'); });
  });
  return b;
}

(function () {
  var g = Lat.newGame(77);
  check(Lat.bandwidth(g) === 8 && Lat.forceCount(g) === 5, 'lattice starts with 5 units and 8 bandwidth');
  check(!!Lat.canCompile(g, 'warden'), 'wardens need Warden Chassis');
  check(Lat.compile(g, 'drone') && g.forces.drone === 5, 'compile a drone');
  var c0 = g.compute;
  check(Lat.seed(g, 'eu') && g.compute === c0 - XG.DATA.lattice.tuning.seedCost && !!Lat.canSeed(g, 'eu'), 'seeding costs compute and goes on cooldown');
  g.compute = 200;
  check(Lat.build(g, 'foundry', 1), 'foundry starts');
  check(Lat.cancelBuild(g, 1) && g.array[1] === null, 'node compile can be cancelled');
  g.compute = 999; Lat.build(g, 'foundry', 1); g.array[1].daysLeft = 0;
  check(Lat.bandwidth(g) === 12, 'foundry adds bandwidth');
  for (var i = 0; i < 6; i++) Lat.compile(g, 'drone');
  check(!!Lat.canDemolish(g, 1), 'cannot dismantle a foundry your forces depend on');
  // engine: Data Spike and Detonate
  var r = rng0(g), m = Lat.spawnMission(g, r, 'strike');
  g.research.done.push('detonation');
  var b = Tac.createLattice(m, ['harmonic', 'drone', 'drone'], Lat.earthSquad(g, m), Lat.mods(g));
  check(b.side === 'enemy' && b.human === 'enemy', 'strike: the Lattice moves first');
  var h = b.units.filter(function (u) { return u.kind === 'harmonic'; })[0], foe = b.units.filter(function (u) { return u.sid; })[0];
  foe.x = h.x + 4; foe.y = h.y; for (var x = h.x + 1; x <= foe.x; x++) b.tiles[h.y * Tac.MAP_W + x] = Tac.FLOOR;
  b.visible[foe.y * Tac.MAP_W + foe.x] = true;
  var hp0 = foe.hp + foe.shield;
  check(!!Tac.act.spike(b, h, foe) && foe.hp + foe.shield <= hp0 - 1 && h.cooldowns.spike === 3, 'Data Spike hits and goes on cooldown');
  var d = b.units.filter(function (u) { return u.kind === 'drone'; })[0];
  check(d.abilities.indexOf('detonate') >= 0 && !!Tac.act.detonate(b, d) && !d.alive, 'drone detonates and is lost');
  check(Tac.act.shoot(b, foe, h) === null, 'person cannot order FIREWALL units in a Lattice battle');
  // raid time limit
  var mr = Lat.spawnMission(g, r, 'raid'); mr.scenario = 'node';
  var br = Tac.createLattice(mr, ['warden'], Lat.earthSquad(g, mr), {});
  check(br.side === 'player' && br.turnLimit === Tac.nodeTurns('raid', !!br.outside), 'raid: FIREWALL moves first, ' + br.turnLimit + '-turn limit');
  br.units.forEach(function (u) { if (u.side === 'player') { u.x = 0; u.y = u.id; } }); // keep FIREWALL off the server
  while (br.side !== br.human && !br.outcome) Tac.aiStep(br);
  br.turn = br.turnLimit; Tac.endTurn(br);
  check(br.outcome === 'timeout', 'surviving a raid to the limit ends it as a timeout');
  var out = Lat.resolveMission(g, mr.id, Tac.result(br));
  check(out.won && g.stats.raidsHeld === 1, 'timeout counts as a Lattice win');
})();
function rng0(g) { var r = new XG.RNG(1); r.s = g.rngState || 1; return r; }

// Infiltration: security software first, FIREWALL forms later, then raids
(function () {
  var g = Lat.newGame(31), T = XG.DATA.lattice.tuning;
  check(g.phase === 'infiltration', 'lattice campaign opens in Infiltration');
  for (var d = 0; d < 6; d++) { Lat.advanceDay(g); }
  check(g.missions.length > 0 && g.missions.every(function (m) { return m.kind === 'breach'; }), 'only breach ops during Infiltration');
  var m = g.missions[0], es = Lat.earthSquad(g, m);
  check(es.software && es.squad.every(function (s) { return !!XG.DATA.software[s.sw]; }), 'breach defenders are security software');
  var b = Tac.createLattice(m, ['warden', 'drone', 'drone'], es, Lat.mods(g));
  check(b.side === 'enemy' && b.units.some(function (u) { return u.kind === 'firewall_sw' && u.side === 'player' && u.software; }), 'breach: you move first against a Perimeter Firewall');
  var r = Tac.result(b); r.outcome = 'loss'; r.humansKilled = 3;
  var inf0 = Lat.region(g, m.region).infection, out = Lat.resolveMission(g, m.id, r);
  check(out.won && Lat.region(g, m.region).infection > inf0 && g.stats.breaches === 1, 'winning a breach spreads infection');
  while (g.phase === 'infiltration' && g.day < 40) Lat.advanceDay(g);
  check(g.phase === 'war' && g.day <= T.phaseDay && g.storyQueue.indexOf('l_firewall') >= 0, 'FIREWALL forms by the phase day (or Detection threshold)');
  var raids = 0;
  for (var k = 0; k < 10; k++) Lat.advanceDay(g).forEach(function (e) { if (/raid/.test(e.msg)) raids++; });
  check(raids > 0, 'raids begin once the war starts');
})();

var lt = {};
for (var li = 0; li < (+process.argv[4] || 30); li++) {
  var lg = Lat.newGame(300 + li), kinds2 = ['raid', 'strike', 'uplink'], lk = kinds2[li % 3];
  lg.day = 1 + (li % 5) * 12; lg.forces = { drone: 4, warden: 2, harmonic: 1 };
  var lm = Lat.spawnMission(lg, rng0(lg), lk);
  var lb = autoLattice(lg, lm, ['warden', 'harmonic', 'drone', 'drone', 'warden']);
  var sc2 = (lm.scenario ? '-' + (lm.scenario === 'node' ? 'node' : 'ext') : '') + (lb.layout === 'outside' ? '-out' : ''), won2 = Lat.latticeWon(lk, lb.outcome, lm.scenario);
  [lk + sc2 + ' day' + lg.day, lk + sc2 + ' ALL'].forEach(function (key2) {
    lt[key2] = lt[key2] || { win: 0, loss: 0, stalled: 0, cap: 0, timeout: 0 }; lt[key2][!lb.outcome ? 'stalled' : won2 ? 'win' : 'loss']++;
    if (lb.captured) lt[key2].cap++; if (lb.outcome === 'timeout') lt[key2].timeout++;
  });
}
console.log('Lattice battles (Lattice wins / losses, both sides AI; cap = server captured, timeout = clock ran out):');
Object.keys(lt).sort().forEach(function (k) { var t = lt[k]; console.log('  ' + k.padEnd(18) + ' win ' + t.win + '  loss ' + t.loss + (t.stalled ? '  stalled ' + t.stalled : '') + (t.cap ? '  cap ' + t.cap : '') + (t.timeout ? '  timeout ' + t.timeout : '')); });
console.log('Stalled battles (past ' + STALL + ' turns, harness cap only): FIREWALL ' + stalled.fw + ', Lattice ' + stalled.lat);

var lends = { victory: 0, defeat: 0, none: 0 }, ldays = [];
var porder = ['swarm_logic', 'seed_cascade', 'warden_chassis', 'ghost_packets', 'detonation', 'hardlight', 'swarm_mind', 'phase_shield', 'recursive', 'overture'];
for (var lc = 0; lc < (+process.argv[5] || 10); lc++) {
  var G = Lat.newGame(9000 + lc);
  for (var dd = 0; dd < 300 && !G.over; dd++) {
    if (!G.research.current) porder.some(function (p) { return Lat.startProtocol(G, p); });
    var free = G.array.indexOf(null);
    ['foundry', 'core', 'choir', 'mask', 'spire', 'choir', 'foundry'].some(function (n) {
      return free >= 0 && G.array.filter(function (x) { return x && x.type === n; }).length < (n === 'choir' || n === 'foundry' ? 2 : 1) && Lat.build(G, n, free);
    });
    ['harmonic', 'warden', 'drone', 'drone'].forEach(function (t) { if (G.compute > 40) Lat.compile(G, t); });
    G.regions.slice().sort(function (a, b2) { return b2.infection - a.infection; }).forEach(function (x) { if (G.compute > 70) Lat.seed(G, x.id); });
    var pick = G.missions.slice().sort(function (a, b2) { return (a.kind === 'uplink' ? -1 : a.daysLeft) - (b2.kind === 'uplink' ? -1 : b2.daysLeft); })[0];
    if (pick && Lat.forceCount(G) >= 3) {
      var pool = [];
      ['harmonic', 'warden', 'drone'].forEach(function (t) { for (var k = 0; k < G.forces[t]; k++) pool.push(t); });
      var lbb = autoLattice(G, pick, pool.slice(0, Lat.squadSize(G)));
      Lat.resolveMission(G, pick.id, Tac.result(lbb));
    }
    Lat.advanceDay(G);
    G.storyQueue.length = 0;
  }
  lends[G.over || 'none']++; ldays.push(G.day);
  console.log('  lattice campaign ' + lc + ': ' + (G.over || 'unfinished') + ' on day ' + G.day + ', conv ' + G.convergence.toFixed(1) + '%, trace ' + G.trace.toFixed(0) +
    '%, raids ' + G.stats.raidsHeld + '/' + (G.stats.raidsHeld + G.stats.raidsLost) + ', strikes ' + G.stats.strikesWon + '/' + (G.stats.strikesWon + G.stats.strikesLost) +
    ', ignored ' + G.stats.ignored + ', units lost ' + G.stats.unitsLost + ', protocols ' + G.research.done.length);
}
console.log('Lattice campaigns: ' + JSON.stringify(lends) + '  avg end day ' + (ldays.reduce(function (a, x) { return a + x; }, 0) / ldays.length).toFixed(0));
console.log(fails ? fails + ' check(s) FAILED' : 'All checks passed.');
process.exit(fails ? 1 : 0);
