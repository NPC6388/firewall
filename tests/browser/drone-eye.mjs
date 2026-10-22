// A Swarm Drone's pupil follows the cursor: zoomed crops of one drone with the cursor at four sides of it.
import fs from 'fs';
export default async function ({ ev, sleep, send }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'purge'); m.diff=2; XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  // park a drone on open floor in the middle of the map, everything in sight
  const d = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, dr=b.units.find(x=>x.side==='enemy'&&x.kind==='drone'&&x.alive);
    for (var y=6;y<b.H-6;y++) for (var x=12;x<b.W-6;x++) if (XG.Tac.tile(b,x,y)===0&&!XG.Tac.unitAt(b,x,y)) { dr.x=x; dr.y=y; b.visible=b.visible.map(()=>true); b.explored=b.explored.map(()=>true); return [x,y]; }
    return null;})()`);
  if (!d) { console.log('no drone spot'); return; }
  const c = await ev(`XG.TacUI.tileToClient(${d[0]},${d[1]})`);
  const ts = 40;
  for (const [name, dx, dy] of [['east', 3, 0], ['north', 0, -3], ['west', -3, 0], ['south', 0, 3]]) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x + dx * ts, y: c.y + dy * ts });
    await sleep(150);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: c.x - ts * .6, y: c.y - ts * .7, width: ts * 1.2, height: ts * 1.2, scale: 5 } });
    fs.writeFileSync('tests/browser/shots/drone-eye-' + name + '.png', Buffer.from(res.result.data, 'base64'));
    console.log('shot drone-eye-' + name);
  }
}
