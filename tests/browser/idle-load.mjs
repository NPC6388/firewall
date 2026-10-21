// How hard the page works while it waits for the player: main-thread busy % per screen. Regressions to look for:
// a full-rate canvas while idle (battle frame() throttles to 30/12 fps), or a blur over animated SVG (squad select).
export default async function ({ ev, sleep, send }) {
  await send('Performance.enable');
  const m = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map((x) => [x.name, x.value]));
  const busy = async (label) => { const a = await m(); await sleep(4000); const b = await m(); console.log(label.padEnd(16), 'main thread busy', (100 * (b.TaskDuration - a.TaskDuration) / 4).toFixed(1) + '%'); };
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1500);
  await busy('title');
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(500);
  await busy('strategy');
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(1000);
  console.log('modal backdrop-filter:', await ev(`getComputedStyle(document.getElementById('modal')).backdropFilter`));
  await busy('squad select');
  await ev(`document.getElementById('sq-go').click()`); await sleep(3500);
  await busy('battle (idle)');
  await sleep(12000);
  await busy('battle (15 s+)');
}
