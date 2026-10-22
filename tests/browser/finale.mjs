// Uplink finale: EMP the (weakened) core, then walk the victory story to the end screen.
export default async function ({ ev, shot, sleep, send }) {
  const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }); };
  const waitIdle = async () => { for (let i = 0; i < 200; i++) { if (await ev(`(function(){var s=XG.TacUI.debug(); return !s || (!s.cur && !s.queue.length && s.b.side==='player');})()`)) return; await sleep(80); } };
  const clickTile = async (x, y, press = true) => {
    const p = await ev(`XG.TacUI.tileToClient(${x},${y})`), cx = p.x, cy = p.y; // scrolls the camera to the tile first
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    if (press) { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 }); }
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g; g.research.done.push('signal_analysis','emp'); g.flags.emp=true; var r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'uplink'); XG.State.saveRng(g,r); g.storyQueue=[]; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  const pos = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, core=b.units.find(u=>u.kind==='core'); core.hp=1;
    var tr=b.units.find(u=>u.kind==='trooper');
    // place trooper 4 tiles left of the core on open floor with clear LOS
    for (var dx=4; dx<=7; dx++){ var x=core.x-dx, y=core.y; if (x>=0 && XG.Tac.tile(b,x,y)===0 && !XG.Tac.unitAt(b,x,y)) { tr.x=x; tr.y=y; break; } }
    b.visible=b.visible.map(()=>true); s.reachCache=null; s.sel=tr.id; return {tr:[tr.x,tr.y], core:[core.x,core.y], los: XG.Tac.los(b,tr.x,tr.y,core.x,core.y)};})()`);
  console.log(JSON.stringify(pos));
  await ev(`document.querySelector('[data-unit="'+XG.TacUI.debug().sel+'"]').click()`);
  await key('3'); await sleep(80);
  await clickTile(pos.core[0], pos.core[1], false); await sleep(80);
  await shot('40-emp-preview');
  await clickTile(pos.core[0], pos.core[1]); await sleep(170);
  await shot('41-emp-boom');
  await waitIdle(); await sleep(1500);
  console.log('outcome:', await ev(`(XG.TacUI.debug()||{b:{outcome:'closed'}}).b.outcome`));
  if (await ev(`!!document.getElementById('tac-done')`)) {
    await ev(`document.getElementById('tac-done').click()`); await sleep(300);
    await shot('42-results');
    await ev(`document.getElementById('res-ok').click()`); await sleep(300);
    await shot('43-victory-story');
    await ev(`document.getElementById('story-next') && document.getElementById('story-next').click()`); await sleep(300);
    await shot('44-gameover');
    await ev(`document.querySelector('[data-action="to-title"]').click()`); await sleep(300);
    console.log('continue hidden on title:', await ev(`document.getElementById('btn-continue').classList.contains('hidden')`));
  }
}
