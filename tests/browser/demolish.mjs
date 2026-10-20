// Engineering: demolish a finished facility through the UI and confirm the 50% refund after half the build time.
export default async function ({ ev, shot, sleep }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g; XG.Strat.build(g,'lab',1); g.base[1].daysLeft=0; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="tab"][data-arg="engineering"]').click()`);
  await ev(`document.querySelector('[data-action="slot"][data-arg="1"]').click()`); await sleep(100);
  await shot('51-demolish-panel');
  const c0 = await ev(`XG.UI.g.credits`);
  await ev(`document.querySelector('[data-action="demolish"]').click()`); await sleep(100);
  await shot('52-demolish-confirm');
  await ev(`document.getElementById('dm-yes').click()`); await sleep(100);
  await ev(`document.querySelector('[data-action="slot"][data-arg="1"]').click()`); await sleep(100);
  await shot('53-demolishing');
  const mid = await ev(`JSON.stringify(XG.UI.g.base[1])`);
  await ev(`(function(){for(var i=0;i<3;i++) XG.Strat.advanceDay(XG.UI.g); XG.UI.g.storyQueue=[]; XG.UI.render();})()`);
  console.log(JSON.stringify({ c0, mid, after: await ev(`XG.UI.g.credits`), slot: await ev(`XG.UI.g.base[1]`), log: await ev(`XG.UI.g.log.slice(0,2).map(l=>l.msg)`) }));
}
