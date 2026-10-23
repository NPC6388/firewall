// Obstacle variants gallery: a bare map with every prop type (barrel, barrier, pillar, glass, fence, mixed-side objects, and the outside-map
// window, shattered frame, desk and rack) in each biome. Shots per biome: props-<biome>.png, -hover, -bunkers, -windows.
// Run: node tests/browser/drive.mjs tests/browser/props-gallery.mjs   (shots land in tests/browser/shots/props-<biome>.png)
export default async function ({ ev, shot, sleep, send }) {
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
      var foe=b.units.filter(function(u){return u.side==='enemy';})[0]; foe.alive=true; foe.x=24; foe.y=15; foe.alerted=true;
      b.tiles.fill(0); b.props.fill(0);
      var put=function(x,y,t,p){ b.tiles[y*W+x]=t; b.props[y*W+x]=p||0; };
      // row 1: barrel pair, plain crate for comparison, barrier run, plain tall cover, pillar, glass run
      put(8,6,T.LOW,'barrel'); put(9,6,T.LOW,'barrel'); put(11,6,T.LOW,0); put(13,6,T.LOW,'barrier'); put(14,6,T.LOW,'barrier'); put(15,6,T.LOW,'barrier');
      put(17,6,T.HIGH,0); put(19,6,T.HIGH,'pillar'); put(21,6,T.HIGH,'glass'); put(22,6,T.HIGH,'glass'); put(23,6,T.HIGH,'glass');
      // row 2: fences, horizontal and vertical, next to the squad for scale
      for (var i=0;i<5;i++) put(8+i,11,T.PIT,'fence'); for (var j=0;j<5;j++) put(16,9+j,T.PIT,'fence'); put(20,11,T.PIT,0); put(21,11,T.PIT,0);
      // row 3: mixed-side bunkers (mask bits N=1 E=2 S=4 W=8 = full face): 1 full, an L of 2, 3 full, 2 opposite full
      [[9,1],[12,3],[15,7],[18,5]].forEach(function(q){ put(q[0],15,T.HIGH,'bunker'); b.faces[15*W+q[0]]=q[1]; });
      // row 4: stack (one tall end), horizontal and vertical vehicles (long sides full), planter (raised back), plated barrier (one plate side)
      var pf=function(x,y,t,k,m){ put(x,y,t,k); b.faces[y*W+x]=m; };
      pf(9,18,T.LOW,'stack',8); pf(10,18,T.LOW,'stack',0); pf(13,18,T.LOW,'vehicle',5); pf(14,18,T.LOW,'vehicle',5); pf(15,18,T.LOW,'vehicle',5);
      pf(18,17,T.HIGH,'vehicle',10); pf(18,18,T.HIGH,'vehicle',10); pf(21,18,T.LOW,'planter',1); pf(24,18,T.LOW,'plate',4); pf(25,18,T.LOW,'plate',4);
      // row 5 (outside maps): a wall with a window and a shattered frame, a vertical wall with a window, a free glass panel to compare, desks and a rack
      for (var wx=8; wx<=16; wx++) put(wx,22,T.WALL,0); put(10,22,T.LOW,'window'); put(14,22,T.LOW,'frame');
      for (var wy=20; wy<=24; wy++) put(19,wy,T.WALL,0); put(19,22,T.LOW,'window');
      put(22,21,T.HIGH,'glass'); put(22,23,T.LOW,'desk'); put(23,23,T.LOW,'desk'); put(25,23,T.HIGH,'rack');
      b.visible=b.visible.map(function(){return true;}); b.explored=b.visible.slice();
      var sq=b.units.filter(function(u){return u.side==='player';}); sq.forEach(function(u,k){u.x=10+k; u.y=8; });
      XG.TacUI.centerOn(15, 9);})()`);
    await sleep(800);
    await zoom('props-' + kind);
    // hover the tile west of the 2-full-face L bunker: its cover shields show each face toward the enemy in the east
    const p = await ev(`XG.TacUI.tileToClient(11, 15)`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x - 200, y: p.y - 200 }); await sleep(150);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await sleep(350);
    console.log(kind, 'hover:', await ev(`(document.getElementById('tac-hover')||{}).innerText`));
    await zoom('props-' + kind + '-hover');
    await ev(`XG.TacUI.centerOn(17, 16)`); await sleep(600); // the mixed-side rows, framed
    await zoom('props-' + kind + '-bunkers');
    const p2 = await ev(`XG.TacUI.tileToClient(12, 15)`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p2.x, y: p2.y }); await sleep(350);
    console.log(kind, 'bunker hover:', await ev(`(document.getElementById('tac-hover')||{}).innerText`));
    if (kind === 'purge') await shot('props-bunker-hover');
    await ev(`XG.TacUI.centerOn(17, 22)`); await sleep(600); // windows, frame, glass panel, desks, rack
    await zoom('props-' + kind + '-windows');
    const p3 = await ev(`XG.TacUI.tileToClient(10, 22)`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p3.x - 200, y: p3.y - 200 }); await sleep(150);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p3.x, y: p3.y }); await sleep(350);
    console.log(kind, 'window hover:', await ev(`(document.getElementById('tac-hover')||{}).innerText`));
  }
}
