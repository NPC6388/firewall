// Headless smoke test: node tests/smoke.js [battles] [campaigns]
// Loads the game scripts into a sandbox, plays AI-vs-AI battles and auto-plays campaigns.
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = vm.createContext({ console: console, Math: Math, Date: Date, JSON: JSON });
['data.js', 'state.js', 'strategy.js', 'tactical.js', 'lattice.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
var XG = ctx.XG, Tac = XG.Tac, Strat = XG.Strat, S = XG.State, D = XG.DATA;
var fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log('  FAIL: ' + msg); } }

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
  if (Tac.tile(b, hk.x, hk.y) !== Tac.FLOOR) { b.tiles[hk.y * Tac.W + hk.x] = Tac.FLOOR; }
  b.tiles[tr.y * Tac.W + tr.x] = Tac.FLOOR;
  b.visible[core.y * Tac.W + core.x] = true;
  check(Tac.act.sever(b, tr, core) === null, 'trooper cannot sever');
  check(Tac.targets(b, hk, 'sever').indexOf(core) >= 0, 'adjacent hacker can sever');
  // frag grenade clears cover
  var b2 = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 1 }), g.soldiers.slice(0, 4));
  var t2 = b2.units.filter(function (u) { return u.kind === 'trooper'; })[0];
  var gx = t2.x + 3, gy = t2.y;
  b2.tiles[gy * Tac.W + gx] = Tac.LOW; b2.visible[gy * Tac.W + gx] = true;
  check(!!Tac.act.grenade(b2, t2, gx, gy), 'grenade throws');
  check(Tac.tile(b2, gx, gy) === Tac.FLOOR, 'frag grenade destroys cover');
  check(t2.ap === 0 && t2.charges.grenade === 0, 'grenade spends AP and charge');
  // cover depends on the viewing angle: target at (10,10) behind high cover to the east
  var bc = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 1 }), g.soldiers.slice(0, 4));
  for (var cy = 0; cy < Tac.H; cy++) for (var cx = 0; cx < Tac.W; cx++) bc.tiles[cy * Tac.W + cx] = Tac.FLOOR;
  bc.tiles[10 * Tac.W + 11] = Tac.HIGH;
  check(Tac.coverValue(bc, 10, 10, 18, 10) === 40, 'head-on full cover is 40');
  check(Tac.coverValue(bc, 10, 10, 18, 13) === 40, 'shot 21° off-axis keeps full cover');
  var c45 = Tac.coverDetail(bc, 10, 10, 15, 15);
  check(c45.value > 20 && c45.value < 40 && c45.base === 40 && c45.angle === 45, '45° shot gets partial full cover (' + c45.value + ')');
  check(Tac.coverValue(bc, 10, 10, 13, 18) === 0, 'steep shot past 63° flanks the cover');
  // corner peeking: wall at x=6, y=5..10; a unit at (5,5) leans out north and can see (10,5); one at (4,5) can't
  for (var py = 0; py < Tac.H; py++) for (var px = 0; px < Tac.W; px++) bc.tiles[py * Tac.W + px] = Tac.FLOOR;
  for (var wy = 5; wy <= 10; wy++) bc.tiles[wy * Tac.W + 6] = Tac.WALL;
  check(Tac.los(bc, 5, 5, 10, 5), 'a unit on the corner of a wall can fire down the line past it');
  check(!Tac.los(bc, 4, 5, 10, 5), 'a unit a step back from the corner cannot');
  check(!Tac.los(bc, 5, 8, 10, 8), 'peeking does not see through the middle of a wall');
  for (var cy2 = 0; cy2 < Tac.H; cy2++) for (var cx2 = 0; cx2 < Tac.W; cx2++) bc.tiles[cy2 * Tac.W + cx2] = Tac.FLOOR;
  bc.tiles[10 * Tac.W + 11] = Tac.HIGH;
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
  bc.tiles[10 * Tac.W + 11] = Tac.LOW;
  check(Tac.coverValue(bc, 10, 10, 15, 15) < 20 && Tac.coverValue(bc, 10, 10, 15, 15) > 10, 'half cover also fades with angle');
  // override flips sides then purges
  var b3 = Tac.create(g, Object.assign({}, m, { kind: 'purge', diff: 1, seed: 7 }), g.soldiers.slice(0, 4));
  var h3 = b3.units.filter(function (u) { return u.kind === 'hacker'; })[0], d3 = b3.units.filter(function (u) { return u.kind === 'drone'; })[0];
  d3.x = h3.x + 3; d3.y = h3.y; b3.tiles[d3.y * Tac.W + d3.x] = Tac.FLOOR;
  for (var x = h3.x + 1; x < d3.x; x++) b3.tiles[h3.y * Tac.W + x] = Tac.FLOOR;
  b3.visible[d3.y * Tac.W + d3.x] = true; h3.hackSkill = 200;
  check(!!Tac.act.hack(b3, h3, d3), 'hack resolves');
  check(d3.side === 'player' && d3.override === 2 && d3.ap === 2, 'override hands the drone over');
  check(h3.hacks === 1 && h3.hackSkill === 201, 'successful hack adds +1 hack skill in battle');
  var hs = g.soldiers.filter(function (s) { return s.id === h3.sid; })[0], base = S.stats(g, hs).hackSkill;
  var r3 = Strat.spawnMission(g, S.rng(g), 'purge');
  Strat.resolveMission(g, r3.id, { outcome: 'loss', units: [{ sid: h3.sid, hp: 5, alive: true, kills: 0, hacks: 2 }] });
  check(S.stats(g, hs).hackSkill === base + 2, 'hack bonus persists after the mission (even on a loss)');
  Tac.endPlayerTurn(b3); while (Tac.enemyStep(b3) !== null) { /* */ }
  Tac.endPlayerTurn(b3);
  check(!d3.alive, 'overridden drone is purged after 2 turns');
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
  foe.x = h.x + 4; foe.y = h.y; for (var x = h.x + 1; x <= foe.x; x++) b.tiles[h.y * Tac.W + x] = Tac.FLOOR;
  b.visible[foe.y * Tac.W + foe.x] = true;
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
