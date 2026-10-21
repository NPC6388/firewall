// Combat training from the title screen: walk every lesson (aim, angle, flank, shoot, defend, end turn) and finish.
export default async function ({ ev, shot, sleep, send }) {
  const press = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k.length === 1 ? k : undefined, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); };
  const step = () => ev(`(XG.Tutorial.state()||{}).step`);
  const next = async () => { await ev(`document.getElementById('coach-next').click()`); await sleep(120); };
  const moveTo = async (x, y) => ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=b.units[0]; var e=XG.Tac.act.move(b,u,${x},${y}); return !!e;})()`);
  const goal = () => ev(`JSON.stringify(XG.Tutorial.goal())`);
  const moveGoal = async () => { const g = JSON.parse(await goal() || 'null'); console.log('goal tile', g); return g ? moveTo(g.x, g.y) : false; };
  const hudTick = () => ev(`(function(){ var s=XG.TacUI.debug(); s.dirty=true; })()`);
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('#screen-title [data-action="training"]').click()`); await sleep(800);
  console.log('step', await step(), await ev(`document.querySelector('.coach-h span').textContent`)); await shot('ct0-welcome');
  await next(); console.log('step', await step()); await shot('ct1-cover');
  await next();
  await press('1', 'Digit1', 49); await sleep(300);
  console.log('after arming Shoot, step', await step()); await shot('ct3-breakdown');
  console.log('breakdown text:', await ev(`document.querySelector('.coach-t').innerText`));
  await next(); await press('Escape', 'Escape', 27); await sleep(300); await shot('ct4-goal');
  console.log('move to goal:', await moveGoal()); await sleep(900); await hudTick(); await sleep(300);
  console.log('after angled move, step', await step(), '|', await ev(`document.querySelector('.coach-t').innerText.split('Now:')[1]`)); await shot('ct5-angle');
  console.log('move to goal:', await moveGoal()); await sleep(900); await hudTick(); await sleep(300);
  console.log('after flank, step', await step(), '| ap', await ev(`XG.TacUI.debug().b.units[0].ap`)); await shot('ct6-flank');
  await next();
  await press('1', 'Digit1', 49); await sleep(150); await press(' ', 'Space', 32); await sleep(1200); await hudTick(); await sleep(300);
  console.log('after shot, step', await step(), '| target hp', await ev(`XG.TacUI.debug().b.units[1].hp`));
  console.log('defense text:', await ev(`document.querySelector('.coach-t').innerText.slice(0,120)`)); await shot('ct8-defense');
  console.log('move to goal:', await moveGoal()); await sleep(1500); await hudTick(); await sleep(300);
  console.log('in cover, step', await step(), '|', await ev(`document.querySelector('.coach-t').innerText.slice(0,90)`)); await shot('ct9-cover');
  await press('Enter', 'Enter', 13); await sleep(2500); await hudTick(); await sleep(300);
  console.log('after end turn, step', await step(), '| log', await ev(`XG.TacUI.debug().b.log.slice(-3).map(l=>l.msg).join(' / ')`));
  await shot('ct10-summary');
  await ev(`document.getElementById('coach-ok').click()`); await sleep(1200);
  console.log('result modal:', await ev(`document.querySelector('#modal-box h1') && document.querySelector('#modal-box h1').innerText`));
  await ev(`document.getElementById('tac-done').click()`); await sleep(400);
  console.log('back on title:', await ev(`!document.getElementById('screen-title').classList.contains('hidden')`), '| combat flag', await ev(`XG.Settings.get('tutorial').combat`));
}
