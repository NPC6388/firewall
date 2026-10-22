// Battle bar: with eight squad cards, switching between a 3-ability and a 5-ability unit must not resize the map, and
// the squad cards, ability buttons and turn buttons must not overlap. Checked at two window widths. Shots: bar-<w>-<n>.png
export default async function ({ ev, sleep, send, shot }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(500);
  await ev(`(function(){var c=document.getElementById('coach'); if (c) c.classList.add('hidden');})()`);
  // four hacked drones on our side make eight cards, like a late-game squad
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b; b.units.filter(function(u){return u.side==='enemy'&&!u.isStatic}).slice(0,4).forEach(function(u){u.side='player'; u.override=2;});})()`);
  const ids = JSON.parse(await ev(`JSON.stringify((function(){var b=XG.TacUI.debug().b, p=b.units.filter(function(u){return u.side==='player'&&u.alive&&!u.override});
    var few=p.filter(function(u){return u.abilities.length<=3})[0]||p[0], many=p.reduce(function(m,u){return u.abilities.length>m.abilities.length?u:m}, p[0]); return [few.id, few.abilities.length, many.id, many.abilities.length];})())`));
  for (const w of [1900, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 950, deviceScaleFactor: 1, mobile: false }); await sleep(500);
    const sizes = [];
    for (const [id, n] of [[ids[0], ids[1]], [ids[2], ids[3]]]) {
      await ev(`document.querySelector('[data-unit="${id}"]').click()`); await sleep(300);
      const m = JSON.parse(await ev(`JSON.stringify((function(){var R=function(q){var r=document.querySelector(q).getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};
        var cv=document.getElementById('tac-canvas').getBoundingClientRect(), bar=document.querySelector('.tac-bar').getBoundingClientRect();
        return {canvas: Math.round(cv.width)+'x'+Math.round(cv.height), bar: Math.round(bar.height), squad: R('#tac-squad'), abil: R('#tac-abilities'), end: R('.tac-end'), card: R('.sq')};})())`));
      const overlap = m.squad[2] > m.abil[0] || m.abil[2] > m.end[0];
      console.log(w + 'px, ' + n + ' abilities: map ' + m.canvas + ', bar ' + m.bar + 'px, card ' + (m.card[2] - m.card[0]) + 'x' + (m.card[3] - m.card[1]) + ', overlap ' + overlap);
      sizes.push(m.canvas + '/' + m.bar);
      const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 950 - m.bar - 60, width: w, height: m.bar + 60, scale: 1 } });
      (await import('node:fs')).writeFileSync('tests/browser/shots/bar-' + w + '-' + n + '.png', Buffer.from(res.result.data, 'base64'));
    }
    console.log(w + 'px: map and bar size ' + (sizes[0] === sizes[1] ? 'stable' : 'CHANGED ' + sizes.join(' vs ')));
  }
  // an armed ability's hint floats above the bar
  await ev(`document.querySelector('[data-unit="${ids[2]}"]').click()`); await sleep(200);
  await ev(`document.querySelector('#tac-abilities [data-ab="hunker"]') && document.querySelector('#tac-abilities [data-ab="hunker"]').click()`); await sleep(300);
  console.log('hint:', await ev(`(function(){var h=document.querySelector('.ab-hint'); if(!h) return 'none'; var r=h.getBoundingClientRect(), b=document.querySelector('.tac-bar').getBoundingClientRect(); return (r.bottom <= b.top ? 'above the bar' : 'INSIDE the bar') + ': ' + h.textContent.slice(0, 50);})()`));
  await shot('bar-hint');
  await send('Emulation.clearDeviceMetricsOverride', {});
}
