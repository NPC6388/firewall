// A HALCYON Sentinel counts as half cover: hovering the tile west of one should show a half shield on its E side
// (training range: gunner drone at 17,12, to the south-east).
export default async function ({ ev, shot, sleep, send }) {
  const hover = async (x, y) => { const p = await ev(`XG.TacUI.tileToClient(${x},${y})`); // scrolls the camera to the tile first
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await sleep(250); };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('#screen-title [data-action="training"]').click()`); await sleep(800);
  await ev(`(function(){var c=document.getElementById('coach'); c.classList.add('hidden');})()`);
  const sx = 12, sy = 12;
  const res = await ev(`(function(){var b=XG.TacUI.debug().b, T=XG.Tac, u=b.units.filter(function(u){return u.side==='player'&&u.alive})[0];
    for (var y=${sy}-1;y<=${sy}+1;y++) for (var x=${sx}-2;x<=${sx};x++) b.tiles[y*b.W+x]=T.FLOOR;
    u.kind='sentinel'; u.x=${sx}; u.y=${sy}; b.visible.fill(true);
    return JSON.stringify({tile:T.coverTile(b,${sx},${sy}), cover:T.coverDetail(b,${sx}-1,${sy},17,12)});})()`);
  console.log('sentinel tile/cover:', res);
  await hover(0, 0); await hover(sx - 1, sy);
  console.log('hover:', await ev(`(document.querySelector('#tac-hover .dim')||{}).innerText`));
  await shot('sentinel-cover');
}
