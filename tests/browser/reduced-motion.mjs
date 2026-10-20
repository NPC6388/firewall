// With prefers-reduced-motion: no shake, fewer particles, static title globe; everything still renders without errors.
export default async function ({ ev, shot, sleep, send }) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await ev(`localStorage.clear(); location.reload()`); await sleep(1400);
  console.log('reduced flag:', await ev(`XG.Gfx.REDUCED`));
  await shot('r0-title');
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'relay'); m.diff=2; XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(800);
  await ev(`(function(){var s=XG.TacUI.debug(); s.queue.push({t:'boom', fx:2,fy:7,x:6,y:8,r:1,kind:'frag'});})()`); await sleep(200);
  console.log('shake:', await ev(`JSON.stringify(XG.TacUI.debug().shake)`), 'particles:', await ev(`XG.TacUI.debug().parts.length`));
  await shot('r1-battle');
}
