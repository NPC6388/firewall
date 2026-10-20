// Headless smoke test: node tests/smoke.js [battles] [campaigns]
// Loads the game scripts into a sandbox, plays AI-vs-AI battles and auto-plays campaigns.
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = vm.createContext({ console: console, Math: Math, Date: Date, JSON: JSON });
['data.js', 'state.js', 'strategy.js', 'tactical.js'].forEach(function (f) {
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
console.log(fails ? fails + ' check(s) FAILED' : 'All checks passed.');
process.exit(fails ? 1 : 0);
