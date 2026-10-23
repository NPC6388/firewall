// Raid scenarios: starts a node and an exterminate battle in each campaign, screenshots the HUD and the server, forces a
// capture (or a hold) and checks the result screen headline. Shots: scen-<case>-hud, scen-<case>-server, scen-<case>-result.
export default async function ({ ev, shot, sleep }) {
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  // helpers in the page: start a battle; clear a side out of the server zone; put one unit of a side beside the server
  await ev(`window.SC = {
    fw: function (scen, seed) {
      var g = XG.State.newGame(seed), m = XG.Strat.spawnMission(g, XG.State.rng(g), 'purge'); m.scenario = scen; m.diff = 2;
      var b = XG.Tac.create(g, m, g.soldiers.slice(0, 4)); XG.TacUI.startWith(g, b, function () {}); return b;
    },
    lat: function (kind, scen, seed) {
      var g = XG.Lat.newGame(seed); g.day = 40; g.trace = 60; g.phase = 'war';
      var m = XG.Lat.spawnMission(g, XG.State.rng(g), kind); m.scenario = scen;
      var b = XG.Tac.createLattice(m, ['drone', 'warden', 'harmonic'], XG.Lat.earthSquad(g, m), {}); XG.TacUI.startWith(g, b, function () {}); return b;
    },
    away: function (b, side) {
      var s = b.server;
      b.units.forEach(function (u) {
        if (!u.alive || u.side !== side || XG.Tac.cheb(u.x, u.y, s.x, s.y) > 3) return;
        for (var r = 5; r < 30; r++) for (var y = 0; y < b.H; y++) for (var x = 0; x < b.W; x++)
          if (XG.Tac.cheb(x, y, s.x, s.y) === r && XG.Tac.tile(b, x, y) === 0 && !XG.Tac.unitAt(b, x, y) && !XG.Tac.isServer(b, x, y) && b.reachable[y * b.W + x]) { u.x = x; u.y = y; return; }
      });
    },
    beside: function (b, side) {
      var s = b.server, u = b.units.filter(function (x) { return x.alive && x.side === side && !x.isStatic; })[0];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var x = s.x + dx, y = s.y + dy;
        if ((dx || dy) && XG.Tac.tile(b, x, y) === 0 && !XG.Tac.unitAt(b, x, y)) { u.x = x; u.y = y; XG.Tac.refreshVis(b); return u.name; }
      }
    },
    top: function () { return document.getElementById('tac-top').innerText.replace(/\\s+/g, ' '); },
    head: function () { var h = document.querySelector('#modal-box h1'); return h ? h.innerText + ' [' + h.className + ']' : 'no result screen'; }
  }; 'ok'`);
  const cases = [
    ['fw-node', `SC.fw('node', 41)`, 'capture'],
    ['fw-ext', `SC.fw('exterminate', 42)`, null],
    ['raid-node', `SC.lat('raid', 'node', 43)`, 'hold'],
    ['raid-ext', `SC.lat('raid', 'exterminate', 44)`, null],
    ['strike-node', `SC.lat('strike', 'node', 45)`, 'capture'],
    ['strike-ext', `SC.lat('strike', 'exterminate', 46)`, null]
  ];
  for (const [name, start, force] of cases) {
    console.log(name + ':', await ev(`(function(){ var b = window.B = ${start}; return b.mission.scenario + ', turn limit ' + b.turnLimit + (b.server ? ', server @' + b.server.x + ',' + b.server.y + ', attacker ' + b.nodeAttacker : ', no server'); })()`));
    await sleep(name.startsWith('raid') ? 9000 : 2500); // a raid opens with FIREWALL's approach turn
    console.log('  HUD:', await ev(`SC.top()`));
    await shot('scen-' + name + '-hud');
    if (!force) continue;
    await ev(`XG.TacUI.centerOn(B.server.x, B.server.y)`); await sleep(400);
    console.log('  server hover:', await ev(`(function(){ var p = XG.TacUI.tileToClient(B.server.x, B.server.y); var c = document.getElementById('tac-canvas'); c.dispatchEvent(new MouseEvent('mousemove', { clientX: p.x, clientY: p.y, bubbles: true })); return document.getElementById('tac-hover').innerText.replace(/\\s+/g, ' ').slice(0, 160); })()`));
    if (force === 'capture') { // the person attacks: one unit beside the server, defenders out of the zone, one point already scored
      console.log('  placed:', await ev(`(function(){ var def = B.nodeAttacker === 'player' ? 'enemy' : 'player'; SC.away(B, def); B.server.capture = 1; var n = SC.beside(B, B.nodeAttacker); XG.TacUI.centerOn(B.server.x, B.server.y); return n + ' ; ' + SC.top(); })()`));
      await sleep(600);
      await shot('scen-' + name + '-server');
      await ev(`document.getElementById('tac-endturn').click()`);
    } else { // the person defends: run the clock out with FIREWALL kept away from the server
      console.log('  placed:', await ev(`(function(){ SC.away(B, 'player'); B.units.forEach(function (u) { if (u.side === 'player') u.ap = 0; }); B.turn = B.turnLimit; XG.Tac.refreshVis(B); XG.TacUI.centerOn(B.server.x, B.server.y); return SC.top(); })()`));
      await sleep(600);
      await shot('scen-' + name + '-server');
      await ev(`document.getElementById('tac-endturn').click()`);
    }
    for (let i = 0; i < 40 && (await ev(`SC.head()`)) === 'no result screen'; i++) await sleep(500);
    console.log('  outcome:', await ev(`B.outcome + (B.captured ? ' (captured)' : '') + ', capture ' + B.server.capture`), '| result:', await ev(`SC.head()`));
    await shot('scen-' + name + '-result');
    await ev(`XG.UI.closeModal()`); await sleep(300);
  }
  // the mission list shows the scenario tag
  await ev(`(function(){ var g = XG.State.newGame(7), r = XG.State.rng(g); for (var i = 0; i < 4; i++) XG.Strat.spawnMission(g, r, 'purge'); XG.State.saveRng(g, r); XG.UI.g = g; XG.UI.show('screen-strategy'); XG.UI.render(); })()`); await sleep(800);
  console.log('mission tags:', await ev(`[...document.querySelectorAll('.scen-tag')].map(function (e) { return e.innerText; }).join(', ') || 'none'`));
  await shot('scen-missions');
}
