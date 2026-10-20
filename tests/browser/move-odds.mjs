// Hovering a move tile shows hit odds vs each visible hostile from that tile.
export default async function ({ ev, shot, sleep, send }) {
  const hover = async (x, y) => {
    const box = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box[0] + (x + .5) * box[2] / 22, y: box[1] + (y + .5) * box[3] / 16 });
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'purge'); m.diff=2; XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  const e = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=XG.Tac.unitById(b,s.sel);
    var es=b.units.filter(x=>x.side==='enemy'); es.forEach((x,i)=>{ var spots=[[9,u.y-2],[10,u.y+2],[12,u.y]]; var p=spots[i%3]; if(XG.Tac.tile(b,p[0],p[1])===0&&!XG.Tac.unitAt(b,p[0],p[1])){x.x=p[0];x.y=p[1];} });
    b.visible=b.visible.map(()=>true); s.reachCache=null; return [u.x,u.y];})()`);
  await hover(e[0] + 4, e[1]); await sleep(120); await shot('70-move-odds');
  console.log(await ev(`document.getElementById('tac-hover').innerText`));
  await hover(e[0] + 8, e[1] + 2); await sleep(120); await shot('71-move-odds-dash');
  console.log(await ev(`document.getElementById('tac-hover').innerText`));
}
