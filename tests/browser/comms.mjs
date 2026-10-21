// Comms chatter: HALCYON / LATTICE voice cards on time advance and in battle, on both campaigns; the setting turns it off.
export default async function ({ ev, shot, sleep }) {
  const card = () => ev(`(function(){var c=document.getElementById('comms'); return c && !c.classList.contains('hidden') ? c.innerText.split(String.fromCharCode(10)).join(' | ') : '(none)';})()`);
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  let seen = 0;
  for (let i = 0; i < 4; i++) {
    await ev(`XG.UI.isModal() && XG.UI.closeModal()`); await ev(`document.querySelector('[data-action="advance-day"]').click()`); await sleep(400);
    const c = await card(); if (c !== '(none)') seen++; console.log('FW day advance', i + 1, '->', c);
    await ev(`XG.Comms.clear()`);
  }
  await shot('comms-fw');
  // late game: Convergence 85% should make HALCYON afraid and the Lattice smug (mood 'dire')
  await ev(`XG.UI.g.convergence = 85`);
  for (let i = 0; i < 4; i++) {
    await ev(`XG.UI.isModal() && XG.UI.closeModal()`); await ev(`document.querySelector('[data-action="advance-day"]').click()`); await sleep(400);
    console.log('FW at', await ev(`Math.round(XG.UI.g.convergence)`) + '%, mood', await ev(`XG.Comms.mood(XG.UI.g)`), '->', await card());
    await ev(`XG.Comms.clear()`);
  }
  await ev(`XG.UI.g.convergence = 20`);
  await ev(`XG.UI.isModal() && XG.UI.closeModal(); (function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  console.log('FW battle start ->', await card()); await shot('comms-battle');
  await ev(`XG.Comms.clear(); localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="l-new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next') && document.getElementById('story-next').click()`); await sleep(300);
  for (let i = 0; i < 3; i++) {
    await ev(`XG.UI.isModal() && XG.UI.closeModal()`); await ev(`document.querySelector('[data-action="l-advance-day"]').click()`); await sleep(400);
    console.log('Lattice day advance', i + 1, '->', await card()); await ev(`XG.Comms.clear()`);
  }
  await ev(`XG.UI.isModal() && XG.UI.closeModal()`); await ev(`document.querySelector('[data-action="l-advance-day"]').click()`); await sleep(400);
  await shot('comms-lat');
  await ev(`XG.Comms.clear(); XG.Settings.set('comms', false)`);
  await ev(`XG.UI.isModal() && XG.UI.closeModal()`); await ev(`document.querySelector('[data-action="l-advance-day"]').click()`); await sleep(400);
  console.log('with comms off ->', await card(), '| FW advances with a line:', seen + '/4');
}
