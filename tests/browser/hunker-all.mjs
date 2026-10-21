// Every unit but the HALCYON Sentinel can hunker. The scientist's five abilities still fit the battle bar on one row.
export default async function ({ ev, sleep, send }) {
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  console.log('hunker by kind:', await ev(`JSON.stringify(XG.TacUI.debug().b.units.filter(u=>!u.isStatic).map(u=>u.kind+':'+(u.abilities.indexOf('hunker')>=0)))`));
  for (const kind of ['scientist', 'hacker', 'trooper']) {
    const ok = await ev(`(function(){var s=XG.TacUI.debug(), u=s.b.units.find(u=>u.kind==='${kind}'); if(!u) return 'none'; s.sel=u.id; s.dirty=true; XG.TacUI.render && XG.TacUI.render(); return 'ok';})()`);
    await sleep(300);
    const bar = await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('#tac-abilities button')); var tops={}; bs.forEach(b=>tops[Math.round(b.getBoundingClientRect().top)]=1); return bs.map(b=>b.innerText.replace(/\s+/g,' ').trim()).join(' | ')+'  rows='+Object.keys(tops).length;})()`);
    console.log(kind, ok, bar);
  }
  const r = await ev(`(function(){var r=document.getElementById('tac-bar')||document.getElementById('tac-abilities'); r=r.getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()`);
  const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: Math.max(0, r[1] - 10), width: 1400, height: r[3] + 20, scale: 1 } });
  const fs = await import('node:fs'); fs.writeFileSync('tests/browser/shots/hunker-all.png', Buffer.from(res.result.data, 'base64'));
}
