// Combat training is guided: off-script moves, shots and end-turns are refused with a nudge, and the lesson still advances.
export default async function ({ ev, shot, sleep, send }) {
  const press = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k.length === 1 ? k : undefined, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }); };
  const state = () => ev(`(function(){var b=XG.TacUI.debug().b;return JSON.stringify({step:(XG.Tutorial.state()||{}).step, turn:b.turn, units:b.units.map(u=>[u.short||u.name,u.x,u.y,u.hp,u.ap])})})()`);
  const nudge = () => ev(`(document.querySelector('.coach-nudge')||{}).innerText||''`);
  const clickTile = async (x, y) => { const p = JSON.parse(await ev(`JSON.stringify((function(){var r=document.querySelector('#screen-tactical canvas').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width/XG.Tac.W,h:r.height/XG.Tac.H}})())`));
    const X = p.l + (x + .5) * p.w, Y = p.t + (y + .5) * p.h;
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: X, y: Y, button: 'left', clickCount: 1 }); await sleep(1200); };
  const goal = async () => JSON.parse(await ev(`JSON.stringify(XG.Tutorial.goal())`));
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('#screen-title [data-action="training"]').click()`); await sleep(800);
  await clickTile(7, 8); console.log('move at step 0 refused:', await state(), '|', await nudge());
  await press('1', 'Digit1', 49); await sleep(300); console.log('arm at step 0 refused, mode', await ev(`XG.TacUI.debug().mode`), '|', await nudge());
  await press('Enter', 'Enter', 13); await sleep(500); console.log('end turn refused:', await state());
  await press(' ', 'Space', 32); await sleep(150); await press(' ', 'Space', 32); await sleep(150);
  await press('1', 'Digit1', 49); await sleep(300); console.log('aim step ->', await state());
  await press('1', 'Digit1', 49); await sleep(800); console.log('fire at breakdown step refused:', await state(), '|', await nudge());
  await press(' ', 'Space', 32); await sleep(150); await press('Escape', 'Escape', 27);
  await clickTile(4, 8); console.log('off-marker move refused:', await state(), '|', await nudge());
  let g = await goal(); await clickTile(g.x, g.y); console.log('marker move ok ->', await state());
  g = await goal(); await clickTile(g.x, g.y); console.log('flank ok ->', await state());
  await press(' ', 'Space', 32); await sleep(150);
  await press('Tab', 'Tab', 9); await sleep(100);
  console.log('aim', await ev(`XG.TacUI.debug().aim`));
  await press('1', 'Digit1', 49); await sleep(200); await press('1', 'Digit1', 49); await sleep(1500); console.log('shot step ->', await state(), '|', await nudge());
  await shot('offplan');
}
