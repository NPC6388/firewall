// Units on the top row: HP bars and odds labels stay on the map. Also: armed Hunker shows each hostile's odds on you.
export default async function ({ ev, sleep, send }) {
  const key = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); };
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b; for(var i=0;i<b.tiles.length;i++) b.tiles[i]=0;
    var ds=b.units.filter(u=>u.side==='enemy'&&!u.isStatic); ds[0].x=9; ds[0].y=0; ds[0].alerted=true; if(ds[1]){ ds[1].x=11; ds[1].y=0; ds[1].alerted=true; }
    var t=b.units.find(u=>u.kind==='trooper'); t.x=6; t.y=1; s.sel=t.id; b.visible=b.visible.map(()=>true); s.reachCache=null; s.dirty=true; XG.Gfx.terrain(b,1); })()`); await sleep(300);
  await key('1', 'Digit1', 49); await sleep(300);
  const r = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()`);
  const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2] * .6, height: r[3] * .3, scale: 2 } });
  const fs = await import('node:fs'); fs.writeFileSync('tests/browser/shots/tr-top-row.png', Buffer.from(res.result.data, 'base64'));
  await key('Escape', 'Escape', 27); await sleep(100);
  const hk = await ev(`XG.TacUI.debug().b.units.find(u=>u.kind==='trooper').abilities.indexOf('hunker')+1`);
  await key(String(hk), 'Digit' + hk, 48 + hk); await sleep(250);
  console.log('hunker hint:', await ev(`document.querySelector('#tac-abilities .dim') && document.querySelector('#tac-abilities .dim').innerText`));
  const res2 = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2] * .6, height: r[3] * .3, scale: 2 } });
  fs.writeFileSync('tests/browser/shots/tr-hunker.png', Buffer.from(res2.result.data, 'base64'));
}
