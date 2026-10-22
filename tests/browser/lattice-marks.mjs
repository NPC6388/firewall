// Lattice campaign, late game: your machines deploy at the FIREWALL squad's mark (name, HP in the info panel).
export default async function ({ ev, shot, sleep }) {
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  console.log(await ev(`(function(){
    var g = XG.Lat.newGame(31); g.day = 60; g.trace = 80;
    var m = XG.Lat.spawnMission(g, XG.State.rng(g), 'strike'), es = XG.Lat.earthSquad(g, m);
    var b = XG.Tac.createLattice(m, ['drone', 'warden', 'harmonic'], es, {});
    XG.TacUI.startWith(g, b, function(){});
    return 'earth level ' + es.level + ': ' + b.units.filter(function(u){ return u.side === 'enemy'; }).map(function(u){ return u.name + ' ' + u.maxHp + 'hp'; }).join(', ');
  })()`));
  await sleep(1500);
  console.log('info:', await ev(`document.getElementById('tac-info').innerText.replace(/\\s+/g, ' ')`));
  await shot('lattice-marks');
}
