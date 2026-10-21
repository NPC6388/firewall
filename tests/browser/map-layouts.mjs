// One battle per map layout (cycling the biomes), each with at least one pit, fog lifted. Hovers a pit tile and
// prints the panel, so the impassable-terrain text can be checked. Shots: layout-<name>-<biome>.png
export default async function ({ ev, shot, sleep, send }) {
  const hover = async (x, y) => { const p = JSON.parse(await ev(`JSON.stringify((function(){var r=document.querySelector('#screen-tactical canvas').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width/XG.Tac.W,h:r.height/XG.Tac.H}})())`));
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.l + (x + .5) * p.w, y: p.t + (y + .5) * p.h }); await sleep(250); };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(500);
  await ev(`(function(){var c=document.getElementById('coach'); if (c) c.classList.add('hidden');})()`);
  const plan = [['compound', 'purge'], ['street', 'relay'], ['yard', 'uplink'], ['plaza', 'cyber'], ['blocks', 'purge']];
  for (const [layout, kind] of plan) {
    const info = JSON.parse(await ev(`(function(){var s=XG.TacUI.debug(), g=s.g, T=XG.Tac, squad=s.b.units.filter(function(u){return u.side==='player'}).map(function(u){return u.soldier}).filter(Boolean);
      var mk = '${kind}' === 'cyber' ? 'purge' : '${kind}';
      for (var seed = 1; seed < 5000; seed++) {
        var b = T.create(g, { kind: mk, diff: 3, seed: seed * 104729, name: 'Layout test', city: 'Test' }, g.soldiers.slice(0, 4));
        var pit = b.tiles.indexOf(T.PIT);
        if (b.layout === '${layout}' && pit >= 0) {
          if ('${kind}' === 'cyber') b.mission.lkind = 'breach';
          XG.TacUI.startWith(g, b, function(){});
          b.visible = b.visible.map(function(){return true});
          return JSON.stringify({ seed: seed, pit: [pit % T.W, Math.floor(pit / T.W)] });
        }
      }
      return JSON.stringify({ none: true });})()`));
    await sleep(600);
    if (info.none) { console.log(layout, kind, 'NO SEED FOUND'); continue; }
    await ev(`(function(){var c=document.getElementById('coach'); if (c) c.classList.add('hidden');})()`);
    await hover(0, 0); await hover(info.pit[0], info.pit[1]);
    console.log(layout, kind, 'seed', info.seed, 'pit', info.pit.join(','), '->', await ev(`document.getElementById('tac-hover').innerText.split('\\n').slice(0,2).join(' | ')`));
    await shot('layout-' + layout + '-' + kind);
    const r = JSON.parse(await ev(`JSON.stringify((function(){var r=document.getElementById('tac-canvas').getBoundingClientRect();return [r.left,r.top,r.width/XG.Tac.W]})())`));
    const cx = r[0] + Math.max(0, info.pit[0] - 3) * r[2], cy = r[1] + Math.max(0, info.pit[1] - 2) * r[2];
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: cx, y: cy, width: r[2] * 7, height: r[2] * 5, scale: 2 } });
    const fs = await import('node:fs'); fs.writeFileSync('tests/browser/shots/pit-' + kind + '.png', Buffer.from(res.result.data, 'base64'));
  }
}
