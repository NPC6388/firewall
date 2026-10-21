// The leader (most HP) is selected first: at battle start, after the selected unit spends its AP, and every new turn.
export default async function ({ ev, sleep, send }) {
  const key = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); };
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  // wound the squad unevenly so the leader isn't simply the first card, then restart selection as a new turn would
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, hp=[3,5,2,4]; b.units.filter(u=>u.side==='player').forEach(function(u,i){ u.hp=Math.min(u.maxHp,hp[i%4]); }); s.sel=null; s.dirty=true;})()`); await sleep(300);
  const who = () => ev(`(function(){var s=XG.TacUI.debug(), u=XG.Tac.unitById(s.b,s.sel); return u ? u.short+' hp '+u.hp : 'none';})()`);
  console.log('squad hp:', await ev(`XG.TacUI.debug().b.units.filter(u=>u.side==='player').map(u=>u.short+' '+u.hp).join(', ')`));
  console.log('selected at start:', await who());
  await ev(`(function(){var s=XG.TacUI.debug(), u=XG.Tac.unitById(s.b,s.sel); u.ap=0; s.dirty=true;})()`); await sleep(300);
  console.log('after leader is spent:', await who());
  const tabs = [];
  for (let i = 0; i < 3; i++) { await key('Tab', 'Tab', 9); await sleep(80); tabs.push(await who()); }
  console.log('Tab order:', tabs.join(' -> '));
  await key('Enter', 'Enter', 13); await sleep(6000);
  console.log('next turn starts on:', await who(), '| side', await ev(`XG.TacUI.debug().b.side`));
}
