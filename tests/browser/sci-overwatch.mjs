// Field Scientist has Overwatch on key 4: the first press arms it, Space confirms.
export default async function ({ ev, sleep, send }) {
  const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }); };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  const sci = await ev(`XG.TacUI.debug().b.units.find(u=>u.kind==='scientist').id`);
  await ev(`document.querySelector('[data-unit="${sci}"]').click()`); await sleep(60);
  const btns = await ev(`[...document.querySelectorAll('#tac-abilities button')].map(b=>b.innerText).join(' | ')`);
  await key('4'); await sleep(150);
  const armedOnly = await ev(`XG.Tac.unitById(XG.TacUI.debug().b, ${sci}).overwatch`);
  await key(' '); await sleep(400); // second step: Space confirms
  const ow = await ev(`XG.Tac.unitById(XG.TacUI.debug().b, ${sci}).overwatch`);
  console.log(JSON.stringify({ btns, afterFirstPress: armedOnly, overwatchSet: ow, log: await ev(`XG.TacUI.debug().b.log.slice(-1)[0].msg`) }));
}
