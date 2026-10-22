// Plays one mission through the real UI (canvas clicks, End Turn button) and walks the debrief.
export default async function ({ ev, shot, sleep, send }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  // give the game some toys so more systems get exercised
  await ev(`(function(){var g=XG.UI.g; g.research.done.push('signal_analysis','lattice_grammar','halcyon'); g.flags.emp=false;
    var r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'${process.env.KIND || 'purge'}'); m.diff=${process.env.DIFF || 2}; XG.State.saveRng(g,r); XG.UI.render(); return m.id;})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);

  const clickTile = async (x, y) => {
    const p = await ev(`XG.TacUI.tileToClient(${x},${y})`), cx = p.x, cy = p.y; // scrolls the camera to the tile first
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
  };
  const idle = `(function(){var s=XG.TacUI.debug(); return !!s && !s.cur && !s.queue.length && s.b.side==='player';})()`;
  const waitIdle = async () => { for (let i = 0; i < 200; i++) { if (await ev(idle)) return true; if (await ev(`!XG.TacUI.debug()`)) return false; await sleep(100); } return false; };

  for (let turn = 0; turn < 25; turn++) {
    if (!(await waitIdle())) break;
    if (await ev(`XG.TacUI.debug().b.outcome || ''`)) break;
    // each player unit: move with a real click toward the AI's chosen tile, then let AI finish its action
    const ids = await ev(`XG.TacUI.debug().b.units.filter(u=>u.alive&&u.side==='player').map(u=>u.id)`);
    for (const id of ids) {
      if (!(await waitIdle())) break;
      const plan = await ev(`(function(){var s=XG.TacUI.debug(),b=s.b,u=XG.Tac.unitById(b,${id}); if(!u||!u.alive||u.ap<=0) return null;
        var foes=b.units.filter(o=>o.alive&&o.side!=='player'&&XG.Tac.isVisible(b,o));
        if (XG.Tac.targets(b,u,'shoot').length) return {shoot:true};
        var r=XG.Tac.reach(b,u,u.mobility), best=null, bd=1e9, tx=foes[0]||{x:b.W-2,y:b.H>>1};
        for (var i=0;i<r.d.length;i++){ if(r.d[i]<=0) continue; var x=i%b.W,y=(i-x)/b.W, d=Math.hypot(x-tx.x,y-tx.y)-XG.Tac.coverValue(b,x,y,tx.x,tx.y)/20; if(d<bd){bd=d;best=[x,y];} }
        return {sel:u.id, to:best};})()`);
      if (!plan) continue;
      if (plan.to) {
        await ev(`(function(){var s=XG.TacUI.debug(); var el=document.querySelector('[data-unit="${id}"]'); if(el) el.click();})()`);
        await clickTile(plan.to[0], plan.to[1]);
        await sleep(50);
        if (!(await waitIdle())) break;
      }
      // fire via ability button if a target exists: click 1 (aims best), then click the aimed enemy twice-confirm via canvas
      const tgt = await ev(`(function(){var s=XG.TacUI.debug(),b=s.b,u=XG.Tac.unitById(b,${id}); if(!u||!u.alive||u.ap<=0) return null; var t=XG.Tac.targets(b,u,'shoot')[0]; return t?[t.x,t.y]:null;})()`);
      if (tgt) {
        await ev(`(function(){var el=document.querySelector('[data-unit="${id}"]'); if(el) el.click();})()`);
        await clickTile(tgt[0], tgt[1]); await sleep(30);
        if (turn === 1) await shot('10-aiming');
        await clickTile(tgt[0], tgt[1]);
      }
    }
    if (!(await waitIdle())) break;
    if (turn === 1 || turn === 3) await shot('11-turn' + turn);
    if (turn === 1) { // camera: hold the right arrow to pan, then zoom out with the wheel, then C recentres
      const cam0 = await ev(`JSON.stringify(XG.TacUI.debug().cam)`);
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await sleep(700);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await sleep(100);
      const cam1 = await ev(`JSON.stringify(XG.TacUI.debug().cam)`);
      await shot('11-panned');
      const mid = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2];})()`);
      for (let k = 0; k < 6; k++) await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: mid[0], y: mid[1], deltaX: 0, deltaY: 120 });
      await sleep(150);
      const cam2 = await ev(`JSON.stringify(XG.TacUI.debug().cam)`);
      await shot('11-zoomed-out');
      for (let k = 0; k < 6; k++) await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: mid[0], y: mid[1], deltaX: 0, deltaY: -120 });
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'c', code: 'KeyC', text: 'c', windowsVirtualKeyCode: 67 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67 });
      await sleep(500);
      console.log('camera: start ' + cam0 + ' panned ' + cam1 + ' zoomed out ' + cam2 + ' recentred ' + await ev(`JSON.stringify(XG.TacUI.debug().cam)`));
    }
    await ev(`document.getElementById('tac-endturn').click()`);
    await sleep(200);
    if (turn === 2) await shot('12-enemy-turn');
  }
  await sleep(1500);
  const sum = await ev(`(function(){var s=XG.TacUI.debug(); if(!s) return 'battle closed'; var b=s.b; return {outcome:b.outcome, turn:b.turn, alive:b.units.filter(u=>u.alive).map(u=>u.side[0]+':'+u.kind+':'+u.hp)};})()`);
  console.log(JSON.stringify(sum));
  await shot('13-end');
  if (await ev(`!!document.getElementById('tac-done')`)) {
    await ev(`document.getElementById('tac-done').click()`); await sleep(400);
    await shot('14-results');
    await ev(`document.getElementById('res-ok') && document.getElementById('res-ok').click()`); await sleep(300);
    await shot('15-after');
    console.log(await ev(`JSON.stringify({day:XG.UI.g.day, salvage:XG.UI.g.salvage, missions:XG.UI.g.missions.length, soldiers:XG.UI.g.soldiers.map(s=>s.hp+'/'+s.xp), log:XG.UI.g.log.slice(0,3)})`));
  }
}
