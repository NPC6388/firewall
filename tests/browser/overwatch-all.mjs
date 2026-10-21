// Overwatch all (Y): asks first, Esc cancels, Space confirms and every unit with AP goes on overwatch.
// Also: 1 arms Shoot and Space fires it.
export default async function ({ ev, sleep, send, shot }) {
  const key = async (k, code) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: code || '', text: k === ' ' ? ' ' : k.length === 1 ? k : undefined }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: code || '' }); };
  const space = async () => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); };
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  const ow = () => ev(`XG.TacUI.debug().b.units.filter(u=>u.side==='player'&&u.alive).map(u=>u.overwatch?1:0).join('')`);
  await key('y'); await sleep(200);
  console.log('modal asks:', await ev(`document.querySelector('#modal-box h1').innerText`), '| focused:', await ev(`document.activeElement.id`));
  await shot('ow1-ask');
  await key('Escape', 'Escape'); await sleep(150);
  console.log('after Esc: modal open', await ev(`XG.UI.isModal()`), 'overwatch', await ow());
  await key('Y'); await sleep(200); await space(); await sleep(600);
  console.log('after Y + Space: modal open', await ev(`XG.UI.isModal()`), 'overwatch', await ow());
  await shot('ow2-all');
  // a fresh battle: 1 arms Shoot at the best target, Space fires
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b; b.units.forEach(u=>{ if(u.side==='player'){ u.overwatch=false; u.ap=2; } });
    var u=b.units.find(x=>x.side==='player'&&x.kind==='trooper'), d=b.units.find(x=>x.side==='enemy'&&!x.isStatic);
    for(var k=u.x+1;k<=u.x+4;k++) b.tiles[u.y*22+k]=0; d.x=u.x+4; d.y=u.y; b.visible=b.visible.map(()=>true); s.sel=u.id; s.reachCache=null; s.dirty=true;})()`); await sleep(200);
  const n0 = await ev(`XG.TacUI.debug().b.log.length`);
  await key('1'); await sleep(150);
  console.log('after 1: mode', await ev(`XG.TacUI.debug().mode`), 'aim set', await ev(`!!XG.TacUI.debug().aim`));
  await space(); await sleep(700);
  console.log('after Space: shot logged', await ev(`XG.TacUI.debug().b.log.slice(${n0}).some(l=>/→/.test(l.msg))`), 'mode', await ev(`XG.TacUI.debug().mode`));
}
