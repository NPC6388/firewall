// Cover fades with the viewing angle: the hover panel names the angle when cover is reduced.
export default async function ({ ev, shot, sleep, send }) {
  const hover = async (x, y) => {
    const p = await ev(`XG.TacUI.tileToClient(${x},${y})`); // scrolls the camera to the tile first
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'purge'); m.diff=1; XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  // open floor; soldier at (5,5), drone at (10,10) behind high cover on its west side
  const pos = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, T=XG.Tac, u=T.unitById(b,s.sel);
    for (var i=0;i<b.tiles.length;i++) b.tiles[i]=T.FLOOR;
    b.units.forEach(function(x){ if(x!==u && x.side===u.side){ x.x=1; x.y=1+b.units.indexOf(x)%14; } });
    var es=b.units.filter(x=>x.side==='enemy'); es.forEach(function(x,i){ x.x=20; x.y=1+i; });
    var e=es[0]; e.x=10; e.y=10; b.tiles[10*b.W+9]=T.HIGH; u.x=2; u.y=10;
    b.visible=b.visible.map(()=>true); s.reachCache=null; return [u.x,u.y,e.x,e.y];})()`);
  await hover(pos[2], pos[3]); await sleep(150);
  console.log('head-on: ' + await ev(`document.getElementById('tac-hover').innerText`));
  await ev(`(function(){var s=XG.TacUI.debug(), u=XG.Tac.unitById(s.b,s.sel); u.x=5; u.y=5; s.reachCache=null;})()`);
  await hover(pos[2] + 2, pos[3]); await sleep(100);
  await hover(pos[2], pos[3]); await sleep(150); await shot('72-cover-angle');
  console.log('45 deg: ' + await ev(`document.getElementById('tac-hover').innerText`));
}
