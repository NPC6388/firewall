// With Shoot armed, Tab cycles enemy targets (selection stays on the same operative); without a mode, Tab cycles squadmates.
export default async function ({ ev, shot, sleep, send }) {
  const key = async (k, shift) => {
    const m = shift ? 8 : 0;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, modifiers: m, text: k.length === 1 ? k : undefined });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, modifiers: m });
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'purge'); m.diff=2; XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  // line up three enemies on open ground in front of the selected trooper
  await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=XG.Tac.unitById(b,s.sel);
    for (var y=u.y-3;y<=u.y+3;y++) for (var x=u.x+1;x<=u.x+7;x++) if(y>=0&&y<16) b.tiles[y*22+x]=0;
    b.units.filter(e=>e.side==='enemy').slice(0,3).forEach((e,i)=>{ e.x=u.x+5+i; e.y=u.y-2+i*2; e.alerted=true; });
    b.units.filter(e=>e.side==='enemy').slice(3).forEach(e=>{ e.alive=false; });
    b.visible=b.visible.map(()=>true); s.reachCache=null;})()`);
  const state = `(function(){var s=XG.TacUI.debug(); return s.sel+':'+s.mode+':'+s.aim;})()`;
  const sel0 = await ev(state);
  await key('1'); await sleep(60); const a = await ev(state);
  await key('Tab'); await sleep(60); const b = await ev(state);
  await key('Tab'); await sleep(60); const c = await ev(state);
  await key('Tab'); await sleep(60); const d = await ev(state);
  await key('Tab', true); await sleep(60); const e = await ev(state);
  await shot('80-tab-target');
  await key('Escape'); await sleep(60);
  await key('Tab'); await sleep(60); const f = await ev(state);
  console.log(JSON.stringify({ sel0, armed: a, tab1: b, tab2: c, tab3_wraps: d, shiftTab: e, noModeTab: f }));
}
