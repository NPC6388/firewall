// Restart mission: from the Abort dialog and from the end-of-battle screen, on both campaigns.
// After a restart the battle matches turn 1 exactly (map, units, RNG), and finishing it still reports once.
export default async function ({ ev, sleep, shot }) {
  const sig = () => ev(`(function(){var b=XG.TacUI.debug().b; return JSON.stringify({turn:b.turn, side:b.side, rng:b.rng.s, units:b.units.map(u=>[u.kind,u.x,u.y,u.hp,u.ap,u.alive]), tiles:b.tiles.join('').length, log:b.log.length})})()`);
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  const missions0 = await ev(`XG.UI.g.missions.length`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(800);
  const s0 = await sig();
  // play a bit: move one unit, end the turn
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=b.units.find(x=>x.side==='player'); XG.Tac.act.move(b,u,u.x+3,u.y); })()`); await sleep(900);
  await ev(`document.getElementById('tac-endturn').click()`); await sleep(4000);
  console.log('changed after play:', (await sig()) !== s0);
  await ev(`document.getElementById('tac-abort').click()`); await sleep(200);
  console.log('abort dialog buttons:', await ev(`[...document.querySelectorAll('#modal-box button')].map(b=>b.innerText).join(' / ')`));
  await shot('restart-ask');
  await ev(`document.getElementById('ab-restart').click()`); await sleep(800);
  console.log('after restart matches turn 1:', (await sig()) === s0);
  // abort -> end screen offers Restart mission
  await ev(`XG.Tac.abort(XG.TacUI.debug().b)`); await ev(`XG.TacUI.debug().dirty=true`); await sleep(1800);
  console.log('end screen buttons:', await ev(`[...document.querySelectorAll('#modal-box button')].map(b=>b.innerText).join(' / ')`));
  await shot('restart-end');
  await ev(`document.getElementById('tac-again').click()`); await sleep(800);
  console.log('restart from end screen matches turn 1:', (await sig()) === s0);
  // finish for real: still reported once
  await ev(`XG.Tac.abort(XG.TacUI.debug().b)`); await ev(`XG.TacUI.debug().dirty=true`); await sleep(1800);
  await ev(`document.getElementById('tac-done').click()`); await sleep(600);
  console.log('back on strategy:', await ev(`!document.getElementById('screen-strategy').classList.contains('hidden')`), '| missions', missions0, '->', await ev(`XG.UI.g.missions.length`), '| failures logged', await ev(`(XG.UI.g.stats||{}).lost`));
  // Lattice battle
  await ev(`XG.UI.isModal() && XG.UI.closeModal(); localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="l-new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next') && document.getElementById('story-next').click()`); await sleep(300);
  for (let i = 0; i < 6 && !(await ev(`XG.UI.g.missions.length`)); i++) { await ev(`XG.UI.isModal() && XG.UI.closeModal()`); await ev(`document.querySelector('[data-action="l-advance"]').click()`); await sleep(300); }
  await ev(`XG.UI.isModal() && XG.UI.closeModal()`);
  await ev(`document.querySelector('[data-action="l-deploy"]').click()`); await sleep(300);
  await ev(`(document.getElementById('lsq-go')||document.getElementById('sq-go')).click()`); await sleep(1500);
  const l0 = await sig();
  await ev(`document.getElementById('tac-endturn').click()`); await sleep(4000);
  await ev(`document.getElementById('tac-abort').click()`); await sleep(200); await ev(`document.getElementById('ab-restart').click()`); await sleep(1500);
  console.log('Lattice restart matches turn 1:', (await sig()) === l0);
}
