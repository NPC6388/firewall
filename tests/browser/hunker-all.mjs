// Hunker all (H): asks first, then every unit with AP left hunkers down and the turn ends.
export default async function ({ ev, shot, sleep, send }) {
  const press = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k.length === 1 ? k : undefined, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); };
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  await ev(`(function(){ var g=XG.State.newGame(7), sq=g.soldiers.slice(0,4); var b=XG.Tac.create(g, {kind:'purge', diff:1, name:'Hunker test', city:'Test', site:'city', seed: 7}, sq); XG.TacUI.startWith(g, b, function(){}); })()`); await sleep(1500);
  const state = () => ev(`(function(){ var b=XG.TacUI.debug().b; return 'turn ' + b.turn + '/' + b.side + ' hunkered ' + b.units.filter(function(u){ return u.alive && u.side===b.human && u.hunker; }).length; })()`);
  console.log('start', await state());
  await press('h', 'KeyH', 72); await sleep(400);
  console.log('modal:', await ev(`document.getElementById('modal-box').innerText.replace(/\\s+/g, ' ')`)); await shot('hunker-all-ask');
  await press('Escape', 'Escape', 27); await sleep(300);
  console.log('after Esc', await state(), '| modal open', await ev(`XG.UI.isModal()`));
  await ev(`document.getElementById('tac-hkall').click()`); await sleep(300);
  await ev(`document.getElementById('owa-yes').click()`); await sleep(1500);
  console.log('after confirm', await state());
  console.log('log:', await ev(`XG.TacUI.debug().b.log.map(function(l){ return l.msg; }).filter(function(m){ return /unker/.test(m); }).join(' | ')`)); await shot('hunker-all-done');
}
