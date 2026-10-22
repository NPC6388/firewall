// Obstacle variants gallery: a bare map with all five types (barrel, barrier, pillar, glass, fence) in each biome, one shot per biome.
// Run: node tests/browser/drive.mjs tests/browser/props-gallery.mjs   (shots land in tests/browser/shots/props-<biome>.png)
export default async function ({ ev, sleep, send }) {
  const zoom = async (name) => {
    const r = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()`);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1.6 } });
    const fs = await import('node:fs'); const path = await import('node:path');
    fs.writeFileSync(path.resolve('tests/browser/shots', name + '.png'), Buffer.from(res.result.data, 'base64')); console.log('zoom', name);
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  for (const kind of ['purge', 'relay', 'uplink', 'cyber']) {
    await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; var m=XG.Strat.spawnMission(g,r,'${kind === 'cyber' ? 'purge' : kind}'); m.diff=3; XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
    await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
    await ev(`document.getElementById('sq-go').click()`); await sleep(500);
    await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, T=XG.Tac, W=b.W;
      ${kind === 'cyber' ? "b.mission.lkind='breach';" : ''}
      b.units.forEach(function(u){ if(!u.isStatic && u.side==='enemy') u.alive=false; });
      b.tiles.fill(0); b.props.fill(0);
      var put=function(x,y,t,p){ b.tiles[y*W+x]=t; b.props[y*W+x]=p||0; };
      // row 1: barrel pair, plain crate for comparison, barrier run, plain tall cover, pillar, glass run
      put(8,6,T.LOW,'barrel'); put(9,6,T.LOW,'barrel'); put(11,6,T.LOW,0); put(13,6,T.LOW,'barrier'); put(14,6,T.LOW,'barrier'); put(15,6,T.LOW,'barrier');
      put(17,6,T.HIGH,0); put(19,6,T.HIGH,'pillar'); put(21,6,T.HIGH,'glass'); put(22,6,T.HIGH,'glass'); put(23,6,T.HIGH,'glass');
      // row 2: fences, horizontal and vertical, next to the squad for scale
      for (var i=0;i<5;i++) put(8+i,11,T.PIT,'fence'); for (var j=0;j<5;j++) put(16,9+j,T.PIT,'fence'); put(20,11,T.PIT,0); put(21,11,T.PIT,0);
      b.visible=b.visible.map(function(){return true;}); b.explored=b.visible.slice();
      var sq=b.units.filter(function(u){return u.side==='player';}); sq.forEach(function(u,k){u.x=10+k; u.y=8; });
      XG.TacUI.centerOn(15, 9);})()`);
    await sleep(800);
    await zoom('props-' + kind);
  }
}
