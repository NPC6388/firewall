// Restart mission: from the Abort dialog and from the end-of-battle screen, on both campaigns.
// After a restart the battle matches turn 1 (map, units, HP, RNG) except that both squads land on NEW spawn points,
// and finishing it still reports once.
export default async function ({ ev, sleep, shot }) {
  const sig = () => ev(`(function(){var b=XG.TacUI.debug().b; return JSON.stringify({turn:b.turn, side:b.side, rng:b.rng.s, units:b.units.map(u=>[u.kind,u.hp,u.ap,u.alive]), base:b.base.tiles.join(''), props:b.base.props.join(','), log:b.log.length})})()`);
  const pos = () => ev(`(function(){var b=XG.TacUI.debug().b; return JSON.stringify(b.units.map(u=>[u.x,u.y]))})()`);
  const camOk = () => ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=b.units.filter(x=>x.side===b.human); var cx=u.reduce((a,x)=>a+x.x,0)/u.length, cy=u.reduce((a,x)=>a+x.y,0)/u.length; var p=XG.TacUI.tileToClient(cx,cy); return p.x>0&&p.y>0&&p.x<innerWidth&&p.y<innerHeight})()`);
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  const missions0 = await ev(`XG.UI.g.missions.length`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(800);
  const s0 = await sig(), p0 = await pos();
  console.log('camera shows the squad at start:', await camOk());
  // play a bit: move one unit, end the turn
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=b.units.find(x=>x.side==='player'); XG.Tac.act.move(b,u,u.x+3,u.y); })()`); await sleep(900);
  await ev(`document.getElementById('tac-endturn').click()`); await sleep(4000);
  console.log('changed after play:', (await sig()) !== s0);
  await ev(`document.getElementById('tac-abort').click()`); await sleep(200);
  console.log('abort dialog buttons:', await ev(`[...document.querySelectorAll('#modal-box button')].map(b=>b.innerText).join(' / ')`));
  await shot('restart-ask');
  await ev(`document.getElementById('ab-restart').click()`); await sleep(800);
  const p1 = await pos();
  console.log('after restart matches turn 1 (same map and units):', (await sig()) === s0, '| spawn points changed:', p1 !== p0, '| camera on squad:', await camOk());
  // abort -> end screen offers Restart mission
  await ev(`XG.Tac.abort(XG.TacUI.debug().b)`); await ev(`XG.TacUI.debug().dirty=true`); await sleep(1800);
  console.log('end screen buttons:', await ev(`[...document.querySelectorAll('#modal-box button')].map(b=>b.innerText).join(' / ')`));
  await shot('restart-end');
  await ev(`document.getElementById('tac-again').click()`); await sleep(800);
  const p2 = await pos();
  console.log('restart from end screen matches turn 1:', (await sig()) === s0, '| spawn points changed again:', p2 !== p1 && p2 !== p0);
  await shot('restart-2');
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
  await ev(`(document.getElementById('lp-go')||document.getElementById('lsq-go')||document.getElementById('sq-go')).click()`); await sleep(1500);
  const l0 = await sig(), lp0 = await pos();
  await ev(`document.getElementById('tac-endturn').click()`); await sleep(4000);
  await ev(`document.getElementById('tac-abort').click()`); await sleep(200); await ev(`document.getElementById('ab-restart').click()`); await sleep(1500);
  console.log('Lattice restart matches turn 1:', (await sig()) === l0, '| spawn points changed:', (await pos()) !== lp0);
}
