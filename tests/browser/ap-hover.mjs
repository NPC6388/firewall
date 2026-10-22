// Hovering one of your units shows its AP left as diamonds under the sprite (and "N AP left" in the hover panel).
// Zoomed crops at 2, 1, 0 and 3 (overclocked) AP: ap-hover-<n>.png
export default async function ({ ev, sleep, send }) {
  const fs = await import('node:fs');
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(500);
  await ev(`(function(){var c=document.getElementById('coach'); if (c) c.classList.add('hidden');})()`);
  const u = JSON.parse(await ev(`JSON.stringify((function(){var s=XG.TacUI.debug(), u=s.b.units.filter(function(u){return u.side==='player'})[1]; return {id:u.id,x:u.x,y:u.y};})())`));
  const hover = async (x, y) => { const p = await ev(`XG.TacUI.tileToClient(${x},${y})`); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await sleep(300); };
  for (const ap of [2, 1, 0, 3]) {
    await ev(`(function(){var s=XG.TacUI.debug(); XG.Tac.unitById(s.b, ${u.id}).ap=${ap};})()`);
    await hover(u.x + 3, u.y + 3); await hover(u.x, u.y);
    console.log('ap', ap, '->', await ev(`document.getElementById('tac-hover').innerText.split('\\n').slice(0,2).join(' | ')`));
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0] + (u.x - 1) * r[2], y: r[1] + (u.y - 1) * r[2], width: r[2] * 3, height: r[2] * 3, scale: 3 } });
    fs.writeFileSync('tests/browser/shots/ap-hover-' + ap + '.png', Buffer.from(res.result.data, 'base64'));
  }
}
