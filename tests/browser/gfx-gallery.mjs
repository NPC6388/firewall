// Graphics gallery: every unit sprite in each biome, plus effects mid-flight. Zoomed canvas captures.
export default async function ({ ev, shot, sleep, send }) {
  const zoom = async (name) => {
    const r = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()`);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1.6 } });
    const fs = await import('node:fs'); const path = await import('node:path');
    const dir = path.resolve('tests/browser/shots'); fs.writeFileSync(path.join(dir, name + '.png'), Buffer.from(res.result.data, 'base64')); console.log('zoom', name);
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  for (const kind of ['purge', 'relay', 'uplink', 'cyber']) {
    await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; var m=XG.Strat.spawnMission(g,r,'${kind === 'cyber' ? 'purge' : kind}'); m.diff=3; XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
    await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
    await ev(`document.getElementById('sq-go').click()`); await sleep(500);
    const info = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, T=XG.Tac, D=XG.DATA;
      ${kind === 'cyber' ? "b.mission.lkind='breach';" : ''}
      var base=b.units[0], kinds=['trooper','hacker','scientist','sentinel','drone','warden','harmonic','firewall_sw','antivirus','ids'];
      var col={trooper:'#4fd1ff',hacker:'#7dff9b',scientist:'#ffd166',sentinel:'#c792ff'};
      b.units.forEach(function(u){ if(!u.isStatic){ u.alive=false; } });
      kinds.forEach(function(k,i){ var E=D.classes[k]||D.enemies[k]||D.software[k]; var x=2+i*2, y=6;
        while(T.tile(b,x,y)!==0) y++;
        b.units.push(Object.assign({}, base, {id:500+i, kind:k, name:E.name, color:E.color||col[k], glyph:E.glyph, side: D.enemies[k]?'enemy':'player', alive:true, x:x, y:y,
          hp:4, maxHp:6, shield: k==='warden'?2:0, overwatch: i===0, hunker: i===5, marked: i===4?1:0, stunned: i===6?1:0, alerted: i!==5, machine: !!E.machine, isStatic:false, ap:2 })); });
      b.visible=b.visible.map(()=>true); s.sel=500; return b.units.length;})()`);
    await sleep(700);
    await zoom('g-' + kind);
  }
  // effects: explosion, shot, scan in the last battle
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b; var now=performance.now();
    s.queue.push({t:'boom', fx:4,fy:6,x:8,y:9,r:1,kind:'frag'}, {t:'shot', from:500,to:505,fx:2,fy:6,tx:12,ty:6,hit:true,kind:'bullet'});})()`);
  await sleep(150); await zoom('g-fx-boom');
  await sleep(600); await zoom('g-fx-after');
  await ev(`(function(){var s=XG.TacUI.debug(); s.queue.push({t:'boom', fx:4,fy:6,x:14,y:10,r:1,kind:'emp'},{t:'scan',x:6,y:8,r:5},{t:'hack',from:501,to:505,fx:4,fy:6,tx:12,ty:6});})()`);
  await sleep(200); await zoom('g-fx-emp');
  await sleep(500); await zoom('g-fx-scan');
  await sleep(450); await zoom('g-fx-hack');
  const fps = await ev(`new Promise(function(res){var n=0,t0=performance.now();function f(){n++; if(performance.now()-t0<1000) requestAnimationFrame(f); else res(n);} requestAnimationFrame(f);})`);
  console.log('frames in 1s:', fps);
}
