// Battle side panel: compact selected-unit box, and a two-column hover (target | you vs target) at 1280 and 1600 widths.
// Shots: side-<w>.png (the right-hand panel). Fails if the box is tall or column B is missing.
export default async function ({ ev, shot, sleep, send }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'purge'); m.diff=2; XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  const e = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=XG.Tac.unitById(b,s.sel);
    var x=b.units.filter(z=>z.side==='enemy'&&z.alive)[0], best=null;
    for (var dx=-6;dx<=6;dx++) for (var dy=-6;dy<=6;dy++) { var px=u.x+dx, py=u.y+dy; if (Math.max(Math.abs(dx),Math.abs(dy))<4) continue;
      if (px<0||py<0||px>=b.W||py>=b.H||XG.Tac.tile(b,px,py)!==0||XG.Tac.unitAt(b,px,py)) continue; if (XG.Tac.los(b,u.x,u.y,px,py)) { best=[px,py]; break; } }
    if (!best) return null; x.x=best[0]; x.y=best[1];
    b.visible=b.visible.map(()=>true); if (b.explored) b.explored=b.explored.map(()=>true); s.reachCache=null; return best;})()`);
  if (!e) { console.log('FAIL: no free tile with line of sight'); return; }
  for (const w of [1280, 1600]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 950, deviceScaleFactor: 1, mobile: false }); await sleep(500);
    const p = await ev(`XG.TacUI.tileToClient(${e[0]},${e[1]})`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await sleep(100);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); await sleep(200);
    const m = await ev(`(function(){var R=function(s){var r=document.querySelector(s); if(!r) return null; r=r.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
      return {info:R('#tac-info'), hover:R('#tac-hover'), duel:R('table.duel'), cv:R('#tac-canvas'), side:R('.tac-side')};})()`);
    console.log(w, JSON.stringify(m));
    console.log(await ev(`document.getElementById('tac-hover').innerText`));
    if (!m.duel) console.log('FAIL: no duel table at ' + w);
    else console.log(w + ' duel table ' + m.duel.w + 'px wide', 'info height', m.info.h);
    const s = m.side;
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: s.x, y: s.y, width: s.w, height: Math.min(s.h, 700), scale: 1 } });
    await ev(`1`);
    const fs = await import('node:fs'), path = await import('node:path'), url = await import('node:url');
    const dir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'shots');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'side-' + w + '.png'), Buffer.from(res.result.data, 'base64'));
  }
  await send('Emulation.clearDeviceMetricsOverride', {});
}
