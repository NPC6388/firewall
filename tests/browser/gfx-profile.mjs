// Times each XG.Gfx stage over two seconds of a running battle (perf regressions in the renderer).
export default async function ({ ev, sleep }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'relay'); m.diff=3; XG.State.saveRng(g,r); XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(800);
  const out = await ev(`new Promise(function(res){
    var G=XG.Gfx, T={}, names=['terrain','ambient','motes','fog','lights','vignette','unit','particles','banner'];
    names.forEach(function(n){ var f=G[n]; T[n]=0; G[n]=function(){ var t=performance.now(); var r=f.apply(this,arguments); T[n]+=performance.now()-t; return r; }; });
    var n=0,t0=performance.now(); (function f(){ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else { Object.keys(T).forEach(function(k){T[k]=+(T[k]/n).toFixed(2);}); T.frames=n; res(JSON.stringify(T)); } })();
  })`);
  console.log('ms per frame:', out);
}
