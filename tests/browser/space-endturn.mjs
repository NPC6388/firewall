// Space ends the turn once every unit is out of AP (a normal battle), and does nothing while someone can still act.
export default async function ({ ev, shot, sleep, send }) {
  const press = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k.length === 1 ? k : undefined, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); };
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  await ev(`(function(){ var g=XG.State.newGame(7), sq=g.soldiers.slice(0,4); var b=XG.Tac.create(g, {kind:'purge', diff:1, name:'Space test', city:'Test', site:'city', seed: 7}, sq); XG.TacUI.startWith(g, b, function(){}); })()`); await sleep(1500);
  const turn = () => ev(`XG.TacUI.debug().b.turn + '/' + XG.TacUI.debug().b.side`);
  console.log('start', await turn(), '| button', await ev(`document.getElementById('tac-endturn').innerText`));
  await press(' ', 'Space', 32); await sleep(400); console.log('space with AP left ->', await turn());
  await ev(`(function(){ var s=XG.TacUI.debug(); s.b.units.forEach(function(u){ if (u.side===s.b.human) u.ap=0; }); s.dirty=true; })()`);
  await press('Escape', 'Escape', 27); await sleep(300);
  console.log('all spent, button', await ev(`document.getElementById('tac-endturn').innerText + ' | ' + document.getElementById('tac-endturn').className`)); await shot('space-spent');
  await press(' ', 'Space', 32); await sleep(6000); console.log('space with all spent ->', await turn());
}
