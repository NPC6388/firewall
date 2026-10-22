// Lattice raid defence: your Lattice units start dug in behind cover facing FIREWALL, which lands on a random edge;
// FIREWALL's approach turn holds fire. Three game seeds, one screenshot each (raid-start-<seed>).
export default async function ({ ev, shot, sleep }) {
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  for (const seed of [31, 8, 17]) {
    console.log(await ev(`(function(){
      var g = XG.Lat.newGame(${seed}); g.day = 60; g.trace = 80;
      var m = XG.Lat.spawnMission(g, XG.State.rng(g), 'raid'), es = XG.Lat.earthSquad(g, m);
      var b = XG.Tac.createLattice(m, ['drone', 'warden', 'harmonic'], es, {});
      XG.TacUI.startWith(g, b, function(){});
      var fw = b.units.filter(function(u){ return u.side === 'player'; }), lat = b.units.filter(function(u){ return u.side === 'enemy'; });
      return 'seed ${seed}: FIREWALL lands on the ' + b.anchor.edge + ' edge at ' + b.anchor.x + ',' + b.anchor.y + ' (' + fw.length + ' units); earth level ' + es.level + ': ' + lat.map(function(u){ return u.name + ' ' + u.maxHp + 'hp @' + u.x + ',' + u.y; }).join(', ');
    })()`));
    await sleep(9000);
    console.log('info:', await ev(`document.getElementById('tac-info').innerText.replace(/\s+/g, ' ')`));
    await shot('raid-start-' + seed);
  }
}
