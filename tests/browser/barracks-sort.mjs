// Barracks headers sort the roster; a second click reverses.
export default async function ({ ev, sleep, shot }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){ var g=XG.UI.g; g.soldiers.forEach(function(s,i){ s.kills=(i*7)%5; s.missions=i%3; }); XG.UI.tab='barracks'; XG.UI.render(); })()`); await sleep(150);
  const col = (n) => ev(`[...document.querySelectorAll('table.sortable tr')].slice(1).map(r=>r.children[${n}].innerText.trim()).join(', ')`);
  for (const [key, n] of [['kills', 8], ['aim', 5], ['name', 0], ['cls', 1]]) {
    await ev(`document.querySelector('th[data-arg="${key}"]').click()`); await sleep(80);
    const a = await col(n);
    await ev(`document.querySelector('th[data-arg="${key}"]').click()`); await sleep(80);
    console.log(key.padEnd(6), '|', a, '|| reversed:', await col(n));
  }
  console.log('header shows arrow:', await ev(`document.querySelector('th.on').innerText`));
  await shot('bs-sorted');
}
