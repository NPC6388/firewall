// Pressing an ability key twice fires it: 1,1 shoots the auto-aimed target; 3 then hover + 3 throws a grenade.
export default async function ({ ev, shot, sleep, send }) {
  const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }); };
  const hover = async (x, y) => {
    const p = await ev(`XG.TacUI.tileToClient(${x},${y})`); // scrolls the camera to the tile first
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  };
  const waitIdle = async () => { for (let i = 0; i < 100; i++) { if (await ev(`(function(){var s=XG.TacUI.debug(); return !s.cur && !s.queue.length;})()`)) return; await sleep(80); } };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  // put a drone 4 tiles in front of the selected trooper with clear ground
  const setup = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=XG.Tac.unitById(b,s.sel), d=b.units.find(x=>x.kind==='drone');
    for (var x=u.x+1;x<=u.x+5;x++) b.tiles[u.y*22+x]=0; d.x=u.x+4; d.y=u.y; d.alerted=true; b.visible=b.visible.map(()=>true);
    return {kind:u.kind, u:[u.x,u.y], d:[d.x,d.y]};})()`);
  console.log(JSON.stringify(setup));
  await key('1'); await sleep(80);
  const m1 = await ev(`JSON.stringify({mode:XG.TacUI.debug().mode, aim:!!XG.TacUI.debug().aim})`);
  await key('1'); await sleep(80);
  const shot1 = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b; return JSON.stringify({mode:s.mode, log:b.log[b.log.length-1].msg});})()`);
  console.log('after 1:', m1, ' after 1,1:', shot1);
  await waitIdle(); await sleep(300);
  // next trooper: grenade via 3, hover, 3
  const t2 = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=b.units.find(x=>x.kind==='trooper'&&x.ap>0); if(!u) return null; document.querySelector('[data-unit="'+u.id+'"]').click(); return [u.x,u.y];})()`);
  await key('3'); await sleep(60); await hover(t2[0] + 3, t2[1]); await sleep(60);
  await shot('60-grenade-armed');
  await key('3'); await sleep(80);
  console.log('after 3,hover,3:', await ev(`(function(){var b=XG.TacUI.debug().b; return b.log.slice(-3).map(l=>l.msg).join(' | ');})()`));
}
