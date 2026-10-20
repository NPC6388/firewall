// Engineering: start a build, cancel it from the slot panel, confirm the refund.
export default async function ({ ev, shot, sleep }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  const before = await ev(`XG.UI.g.credits`);
  await ev(`document.querySelector('[data-action="tab"][data-arg="engineering"]').click()`);
  await ev(`document.querySelector('[data-action="slot"][data-arg="1"]').click()`);
  await ev(`document.querySelector('[data-action="build"][data-arg="lab"]').click()`); await sleep(100);
  const during = await ev(`XG.UI.g.credits`);
  await ev(`document.querySelector('[data-action="slot"][data-arg="1"]').click()`); await sleep(100);
  await shot('50-cancel-panel');
  await ev(`document.querySelector('[data-action="cancel-build"]').click()`); await sleep(100);
  const after = await ev(`XG.UI.g.credits`);
  console.log(JSON.stringify({ before, during, after, slot: await ev(`XG.UI.g.base[1]`), log: await ev(`XG.UI.g.log[0].msg`) }));
}
