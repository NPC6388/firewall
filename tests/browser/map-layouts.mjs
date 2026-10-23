// One battle per map layout (cycling the biomes; 'outside' is a node mission with the server in a building), each with at least one pit, fog lifted. Hovers a pit tile and
// prints the panel, so the impassable-terrain text can be checked. Shots: layout-<name>-<biome>.png
export default async function ({ ev, shot, sleep, send }) {
  const hover = async (x, y) => { const p = await ev(`XG.TacUI.tileToClient(${x},${y})`); // scrolls the camera to the tile first
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await sleep(250); };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(500);
  await ev(`(function(){var c=document.getElementById('coach'); if (c) c.classList.add('hidden');})()`);
  const plan = [['compound', 'purge'], ['street', 'relay'], ['yard', 'uplink'], ['plaza', 'cyber'], ['blocks', 'purge'], ['outside', 'purge']]; // outside: a node mission (server inside the building)
  for (const [layout, kind] of plan) {
    const info = JSON.parse(await ev(`(function(){var s=XG.TacUI.debug(), g=s.g, T=XG.Tac, squad=s.b.units.filter(function(u){return u.side==='player'}).map(function(u){return u.soldier}).filter(Boolean);
      var mk = '${kind}' === 'cyber' ? 'purge' : '${kind}';
      for (var seed = 1; seed < 5000; seed++) {
        var out = '${layout}' === 'outside', b = T.create(g, { kind: mk, diff: 3, seed: seed * 104729, name: 'Layout test', city: 'Test', scenario: out ? 'node' : null, layout: out ? 'outside' : null }, g.soldiers.slice(0, 4));
        var pit = b.tiles.indexOf(T.PIT);
        if (b.layout === '${layout}' && pit >= 0) {
          if ('${kind}' === 'cyber') b.mission.lkind = 'breach';
          XG.TacUI.startWith(g, b, function(){});
          b.visible = b.visible.map(function(){return true});
          b.explored = b.explored.map(function(){return true});
          return JSON.stringify({ seed: seed, pit: [pit % b.W, Math.floor(pit / b.W)] });
        }
      }
      return JSON.stringify({ none: true });})()`));
    await sleep(600);
    if (info.none) { console.log(layout, kind, 'NO SEED FOUND'); continue; }
    await ev(`(function(){var c=document.getElementById('coach'); if (c) c.classList.add('hidden');})()`);
    await hover(0, 0); await hover(info.pit[0], info.pit[1]);
    console.log(layout, kind, 'seed', info.seed, 'pit', info.pit.join(','), '->', await ev(`document.getElementById('tac-hover').innerText.split('\\n').slice(0,2).join(' | ')`));
    await shot('layout-' + layout + '-' + kind);
    const r = await ev(`XG.TacUI.tileToClient(${info.pit[0]},${info.pit[1]})`), cv = await ev(`(function(){var c=document.getElementById('tac-canvas').getBoundingClientRect(); return [c.left,c.top];})()`);
    const cx = Math.max(cv[0], r.x - 3.5 * r.tile), cy = Math.max(cv[1], r.y - 2.5 * r.tile);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: cx, y: cy, width: r.tile * 7, height: r.tile * 5, scale: 2 } });
    const fs = await import('node:fs'); fs.writeFileSync('tests/browser/shots/pit-' + kind + '.png', Buffer.from(res.result.data, 'base64'));
  }
}
