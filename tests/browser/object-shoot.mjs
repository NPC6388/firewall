// Shooting destructible objects: aim at a fuel barrel with Shoot armed, read the hover panel, fire, and check it exploded.
// Run: node tests/browser/drive.mjs tests/browser/object-shoot.mjs   (shots: object-aim, object-fired)
export default async function ({ ev, shot, sleep, send }) {
  const click = async (x, y) => {
    const p = await ev(`XG.TacUI.tileToClient(${x},${y})`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await sleep(120);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(250);
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; var m=XG.Strat.spawnMission(g,r,'purge'); m.diff=2; XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(500);
  await ev(`(function(){var c=document.getElementById('coach'); if(c) c.classList.add('hidden');})()`);
  const info = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, T=XG.Tac, W=b.W;
    b.tiles.fill(0); b.props.fill(0); b.faces.fill(0); b.tileHp={};
    var foes=b.units.filter(function(u){return u.side==='enemy'&&!u.isStatic;});
    var put=function(x,y,t,p){ b.tiles[y*W+x]=t; b.props[y*W+x]=p||0; };
    put(8,10,T.LOW,'barrel'); put(9,10,T.LOW,'barrel'); put(8,12,T.LOW,0);
    foes.forEach(function(f,i){ f.x=9+(i%2); f.y=11+Math.floor(i/2)*2; f.alerted=true; });
    var sq=b.units.filter(function(u){return u.side==='player';}); sq.forEach(function(u,k){u.x=1+k; u.y=10;});
    b.visible=b.visible.map(function(){return true;}); b.explored=b.visible.slice(); T.refreshVis(b); b.visible=b.visible.map(function(){return true;});
    s.sel=sq[0].id; XG.TacUI.centerOn(6,10); return foes.map(function(f){return f.hp;});})()`);
  console.log('foe hp before', JSON.stringify(info));
  await sleep(400);
  await ev(`document.querySelector('[data-ab="shoot"]').click()`); await sleep(300); // arm Shoot
  await click(8, 10); // first click aims at the barrel
  console.log('aim hover:', await ev(`(document.getElementById('tac-hover')||{}).innerText`));
  await shot('object-aim');
  await ev(`(function(){var b=XG.TacUI.debug().b; b.rng.chance=function(){return true;};})()`);
  await click(8, 10); // second click fires
  await sleep(1500);
  const after = await ev(`(function(){var b=XG.TacUI.debug().b, W=b.W; return {barrel1:b.props[10*W+8], barrel2:b.props[10*W+9], tile1:b.tiles[10*W+8], tile2:b.tiles[10*W+9], hps:b.units.filter(function(u){return u.side==='enemy'&&!u.isStatic;}).map(function(u){return u.hp;})};})()`);
  console.log('after:', JSON.stringify(after));
  await shot('object-fired');
  // a crate takes several hits: hover shows durability
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b; var u=b.units.filter(function(u){return u.side==='player';})[1]; s.sel=u.id; u.ap=2;})()`);
  await click(8, 12); // select-only click on empty ground is fine; just hover the crate for its panel
  console.log('crate hover:', await ev(`(document.getElementById('tac-hover')||{}).innerText`));
}
