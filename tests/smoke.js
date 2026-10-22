// Headless smoke test: node tests/smoke.js [battles] [campaigns]
// Loads the game scripts into a sandbox, plays AI-vs-AI battles and auto-plays campaigns.
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = vm.createContext({ console: console, Math: Math, Date: Date, JSON: JSON });
['data.js', 'state.js', 'strategy.js', 'tactical.js', 'lattice.js', 'comms.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
var XG = ctx.XG, Tac = XG.Tac, Strat = XG.Strat, S = XG.State, D = XG.DATA;
var fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log('  FAIL: ' + msg); } }

// Comms chatter: both campaigns have lines for every event, each ['H' | 'L', text].
['fw', 'lat'].forEach(function (f) {
  ['advance', 'mission', 'research', 'expire', 'build', 'start', 'kill', 'loss', 'crit', 'hack', 'win', 'lose'].forEach(function (ev) {
    var pool = (D.comms[f] || {})[ev] || [];
    check(pool.length > 0, 'comms ' + f + '.' + ev + ' has lines');
    pool.forEach(function (l) { check((l[0] === 'H' || l[0] === 'L') && typeof l[1] === 'string' && l[1].length > 3, 'comms line ok: ' + f + '.' + ev); });
  });
});

// Plays a battle with the shared AI on both sides. Returns the battle.
function autoBattle(g, m, squad) {
  var b = Tac.create(g, m, squad);
  check(b.units.filter(function (u) { return u.side === 'enemy'; }).length >= 2, 'battle has enemies');
  for (var turn = 0; turn < 40 && !b.outcome; turn++) {
    b.units.filter(function (u) { return u.alive && u.side === 'player'; }).forEach(function (u) {
      if (b.outcome) return;
      // use class abilities sometimes so they get exercised
      if (u.kind === 'trooper' && u.charges.grenade) {
        var t = Tac.targets(b, u, 'shoot').filter(function (e) { return Tac.dist(u.x, u.y, e.x, e.y) <= 8; })[0];
        if (t && Tac.act.grenade(b, u, t.x, t.y)) return;
      }
      if (u.kind === 'hacker') {
        var h = Tac.targets(b, u, 'hack')[0];
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
  // deployment: the squad starts packed in a 3x3 block on the west edge
  [11, 12, 13].forEach(function (sd) {
    var bd = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 2, seed: sd }), g.soldiers.slice(0, 5)), mid = bd.H >> 1;
    var sq = bd.units.filter(function (u) { return u.side === 'player' && !u.isStatic; });
    check(sq.every(function (u) { return u.x <= 2 && Math.abs(u.y - mid) <= 1 && Tac.tile(bd, u.x, u.y) === Tac.FLOOR; }), 'squad deploys inside the 3x3 block (seed ' + sd + ')');
  });
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
  check(Tac.los(bl, 9, 10, 11, 10), 'a single row of tall cover between two hugging units is still see-through');
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
  var lay = {}, pitMaps = 0, deployOk = true;
  for (var ms = 0; ms < 60; ms++) {
    var bm = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 2, seed: 900 + ms * 7919 }), g.soldiers.slice(0, 4));
    lay[bm.layout] = 1;
    if (bm.tiles.some(function (tv, ti) { return tv === Tac.PIT && !bm.props[ti]; })) pitMaps++;
    for (var dy = (Tac.MAP_H >> 1) - 3; dy <= (Tac.MAP_H >> 1) + 3; dy++) for (var dx = 0; dx < 3; dx++) if (bm.tiles[dy * Tac.MAP_W + dx] !== Tac.FLOOR) deployOk = false;
  }
  check(['compound', 'street', 'yard', 'plaza', 'blocks'].every(function (k) { return lay[k]; }), 'all five map layouts appear (' + Object.keys(lay).join(',') + ')');
  check(pitMaps > 15 && pitMaps < 60, 'some but not all maps have impassable ground (' + pitMaps + '/60)');
  check(deployOk, 'deployment zone is always open floor');
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
      lim[kd] = bl.turnLimit;
      reachCheck(bl);
    }
  });
  var btr = Tac.createTraining(g, g.soldiers.slice(0, 1));
  check(btr.W === 22 && btr.H === 16 && btr.tiles.length === 22 * 16, 'combat training stays 22x16');
  check(sizeOk, 'mission and Lattice battle maps are 38x28');
  check(lim.raid === 10 && lim.uplink === 0 && lim.strike === 25 && lim.breach === 25, 'turn limits unchanged (' + JSON.stringify(lim) + ')');
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
    b.units.forEach(function (u) { if (u.side === 'enemy') { units++; if (Tac.coverValue(b, u.x, u.y, 1, Tac.MAP_H >> 1) > 0) covered++; } });
    for (var k = 0; k < 50 && b.side !== b.human && !b.outcome; k++)
      Tac.aiStep(b).forEach(function (e) { if (e.t === 'shot' && Tac.unitById(b, e.from).side === 'player') shots++; });
  }
  check(shots === 0, 'FIREWALL holds fire on the approach turn of a raid (' + shots + ' shots)');
  check(covered >= units * 0.8, 'raid defenders start in cover facing FIREWALL (' + covered + '/' + units + ')');
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
  var b = Tac.create(g, Object.assign({}, m, { diff: 1 }), g.soldiers.slice(0, 4)), W = b.W;
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
  // crate: survives the first hit, falls once its HP (6) is gone, with damage = weapon damage
  reset(); put(10, 10, Tac.LOW, 0);
  b.rng.chance = function () { return true; };
  Tac.act.shootTile(b, sh, 10, 10);
  check(Tac.tile(b, 10, 10) === Tac.LOW && Tac.objectAt(b, 10, 10).hp === 3, 'a crate survives one rifle hit (hp 3/6)');
  sh.ap = 2; Tac.act.shootTile(b, sh, 10, 10);
  b.rng.chance = realChance;
  check(Tac.tile(b, 10, 10) === Tac.FLOOR && b.tileHp[10 * W + 10] === undefined, 'the crate falls on the second hit and its HP entry is gone');
  reset(); put(10, 10, Tac.HIGH, 0); check(Tac.objectAt(b, 10, 10).maxHp === 10, 'tall cover has 10 HP');
  var oi = Tac.hitInfo(b, sh, Tac.objectAt(b, 10, 10));
  check(oi.ok && oi.object && oi.parts[0][0] === 'Aim' && !oi.parts.some(function (p) { return /cover|defense/i.test(p[0]); }), 'an object hit chance has no cover or defense lines');
  // not targetable: blast-proof barrier and pillar, walls and fences
  reset(); put(10, 10, Tac.LOW, 'barrier'); put(10, 12, Tac.HIGH, 'pillar'); put(10, 8, Tac.WALL, 0); put(10, 14, Tac.PIT, 'fence');
  check(Tac.objectTargets(b, sh).length === 0 && !Tac.act.shootTile(b, sh, 10, 10) && !Tac.act.shootTile(b, sh, 10, 12) && !Tac.act.shootTile(b, sh, 10, 8) && !Tac.act.shootTile(b, sh, 10, 14), 'barriers, pillars, walls and fences cannot be shot');
  reset(); put(10, 10, Tac.LOW, 0); sh.x = 30; check(Tac.objectTargets(b, sh).length === 0, 'objects out of weapon range are not targets');
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
  var key = kind + ' d' + m.diff;
  tally[key] = tally[key] || { win: 0, loss: 0, none: 0, turns: 0, n: 0 };
  tally[key][b.outcome || 'none']++; tally[key].turns += b.turn; tally[key].n++;
  var res = Tac.result(b), out = Strat.resolveMission(g, m.id, res);
  check(out.outcome === (b.outcome || 'abort'), 'resolve keeps outcome');
}
console.log('Battles (AI vs AI):');
Object.keys(tally).sort().forEach(function (k) {
  var t = tally[k];
  console.log('  ' + k.padEnd(10) + ' win ' + t.win + '  loss ' + t.loss + '  timeout ' + t.none + '  avg turns ' + (t.turns / t.n).toFixed(1));
});

// -------------------------------------------------------------- campaigns
var nc = +process.argv[3] || 10, ends = { victory: 0, defeat: 0, none: 0 }, days = [];
var order = ['signal_analysis', 'lattice_grammar', 'drone_teardown', 'halcyon', 'relay_analysis', 'squad_size', 'emp', 'faraday', 'triangulation', 'coilguns', 'firewall'];
for (var c = 0; c < nc; c++) {
  var gc = S.newGame(5000 + c);
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
    '%, won ' + gc.stats.missionsWon + ' lost ' + gc.stats.missionsLost + ' expired ' + gc.stats.expired + ', KIA ' + gc.memorial.length + ', techs ' + gc.research.done.length);
}
console.log('Campaigns: ' + JSON.stringify(ends) + '  avg end day ' + (days.reduce(function (a, x) { return a + x; }, 0) / days.length).toFixed(0));

// ================================================================ LATTICE side
var Lat = XG.Lat;

// Plays a Lattice-controlled battle: the shared AI drives the Lattice "human" side too.
function autoLattice(g, m, types) {
  var b = Tac.createLattice(m, types, Lat.earthSquad(g, m), Lat.mods(g));
  check(b.human === 'enemy', 'lattice battle is human-controlled on the Lattice side');
  for (var guard = 0; guard < 400 && !b.outcome; guard++) {
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
  check(!!b.outcome, 'lattice battle ends');
  if (!b.outcome) console.log('    stalled:', m.kind, 'turn', b.turn, b.units.filter(function (u) { return u.alive; }).map(function (u) { return u.side[0] + ':' + u.kind + '@' + u.x + ',' + u.y + ' ap' + u.ap; }).join(' '));
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
  var mr = Lat.spawnMission(g, r, 'raid'), br = Tac.createLattice(mr, ['warden'], Lat.earthSquad(g, mr), {});
  check(br.side === 'player' && br.turnLimit === 10, 'raid: FIREWALL moves first, 10-turn limit');
  while (br.side !== br.human && !br.outcome) Tac.aiStep(br);
  br.turn = 10; Tac.endTurn(br);
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
  var key2 = lk + ' day' + lg.day, won2 = Lat.latticeWon(lk, lb.outcome);
  lt[key2] = lt[key2] || { win: 0, loss: 0 }; lt[key2][won2 ? 'win' : 'loss']++;
}
console.log('Lattice battles (Lattice wins / losses, both sides AI):');
Object.keys(lt).sort().forEach(function (k) { console.log('  ' + k.padEnd(12) + ' win ' + lt[k].win + '  loss ' + lt[k].loss); });

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
