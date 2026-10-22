// Tab (no ability armed) switches operative and centres the camera on the new one.
export default async function ({ ev, shot, sleep, send }) {
  const key = async (k) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k });
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'purge'); m.diff=1; XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(900);
  // zoom in so the camera has room to move, and spread two operatives far apart on open floor
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, sq=b.units.filter(function(u){return u.side===b.human&&u.alive;});
    s.cam.z=2; var spots=[[8,8],[b.W-9,b.H-9]];
    sq.slice(0,2).forEach(function(u,i){ var p=spots[i]; b.tiles[p[1]*b.W+p[0]]=0; u.x=p[0]; u.y=p[1]; });
    sq.slice(2).forEach(function(u){ u.ap=0; });
    s.sel=sq[1].id; s.reachCache=null;})()`);
  const read = `(function(){var s=XG.TacUI.debug(), u=XG.Tac.unitById(s.b,s.sel), c=document.querySelector('#tac-canvas')||document.querySelector('canvas');
    var TS=40, vw=c.clientWidth/s.cam.z, vh=c.clientHeight/s.cam.z;
    return { sel: s.sel, ux: u.x, uy: u.y, dx: Math.round((s.cam.x+vw/2)/TS - (u.x+.5)), dy: Math.round((s.cam.y+vh/2)/TS - (u.y+.5)) };})()`;
  const out = [];
  for (let i = 0; i < 3; i++) { await key('Tab'); await sleep(900); out.push(await ev(read)); }
  await shot('tab-center');
  console.log('tab-center:', JSON.stringify(out));
  const ok = out.every(o => Math.abs(o.dx) <= 1 && Math.abs(o.dy) <= 1) && out[0].sel !== out[1].sel;
  console.log(ok ? 'tab-center: ok' : 'tab-center: FAILED');
}
