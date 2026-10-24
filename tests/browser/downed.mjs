// Downed, not dead: a soldier dropped to 0 HP lies on its tile with a BLEED badge, a squadmate next to it gets a Stabilize
// button (the battle bar keeps its height), stabilizing shows STABLE, and after a win the debrief lists the soldier as
// downed and carried out (not KIA) and the Barracks shows Critical. Then a Lattice battle with a disabled machine.
// Shots: downed-bleed.png, downed-stable.png, downed-results.png, downed-barracks.png, downed-lattice.png
export default async function ({ ev, shot, sleep, send }) {
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 950, deviceScaleFactor: 1, mobile: false }); await sleep(300);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; var m=XG.Strat.spawnMission(g,r,'purge'); m.scenario='exterminate'; XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await ev(`document.getElementById('sq-go').click()`); await sleep(800);
  await ev(`(function(){var c=document.getElementById('coach'); if (c) c.classList.add('hidden');})()`);
  const barH = () => ev(`Math.round(document.querySelector('.tac-bar').getBoundingClientRect().height) + '/' + Math.round(document.getElementById('tac-canvas').getBoundingClientRect().height)`);
  const before = await barH(); // bar and map height before anyone is down
  // drop the first soldier with a sure hit from a hostile next to it (the engine's own path: damage -> down)
  const setup = await ev(`(function(){var b=XG.TacUI.debug().b, T=XG.Tac, sq=b.units.filter(function(u){return u.sid}), a=sq[0], c=sq[1];
    var e=b.units.filter(function(u){return u.side==='enemy'&&!u.isStatic})[0];
    // find an open spot for a: the tile of the squad member nearest to the middle is fine; put the hostile 2 east and c beside a later
    var spot=null; for (var r=0;r<6&&!spot;r++) for (var dx=-r;dx<=r&&!spot;dx++) { var x=a.x+dx, y=a.y; if (T.tile(b,x+2,y)===0&&!T.unitAt(b,x+2,y)) spot=[x+2,y]; }
    e.x=spot[0]; e.y=spot[1]; e.alerted=true; a.hp=1; a.shield=0; var real=b.rng.chance; b.rng.chance=function(){return true}; e.aim=200; e.dmg=[1,1];
    b.side='enemy'; e.ap=2; var ev=T.ai(b,e); b.side='player'; b.rng.chance=real; e.ap=0;
    e.alive=false; e.hp=0; // the shooter leaves the picture; the others stay far away
    T.refreshVis(b); b.explored = b.explored || b.visible.slice();
    return JSON.stringify({down: a.downed, alive: a.alive, bleed: a.bleed, name: a.short, events: ev.map(function(x){return x.t}).filter(function(t){return t==='down'||t==='death'})});})()`);
  console.log('setup:', setup);
  await ev(`(function(){var b=XG.TacUI.debug().b, sq=b.units.filter(function(u){return u.sid}); document.querySelector('[data-unit="'+sq[1].id+'"]').click(); XG.TacUI.centerOn(sq[0].x, sq[0].y);})()`); await sleep(400);
  console.log('squad card:', await ev(`document.querySelector('.sq.downed') ? document.querySelector('.sq.downed').textContent : 'NO downed card'`));
  console.log('stabilize button for the second soldier before moving it:', await ev(`!!document.querySelector('#tac-abilities [data-ab="stabilize"]')`));
  await shot('downed-bleed');
  // bring the second soldier next to it (diagonal) and stabilize
  await ev(`(function(){var b=XG.TacUI.debug().b, T=XG.Tac, sq=b.units.filter(function(u){return u.sid}), a=sq[0], c=sq[1];
    for (var dy=-1;dy<=1;dy++) for (var dx=-1;dx<=1;dx++) if (dx&&dy&&T.tile(b,a.x+dx,a.y+dy)===0&&!T.unitAt(b,a.x+dx,a.y+dy)) { c.x=a.x+dx; c.y=a.y+dy; dy=9; break; }
    c.ap=2; T.refreshVis(b); document.querySelector('[data-unit="'+sq[0].id+'"]'); document.querySelector('[data-unit="'+sq[2].id+'"]').click(); document.querySelector('[data-unit="'+c.id+'"]').click();})()`); await sleep(300);
  const btn = await ev(`(function(){var e=document.querySelector('#tac-abilities [data-ab="stabilize"]'); return e ? e.textContent + (e.disabled?' (disabled)':'') : 'NO stabilize button'})()`);
  console.log('stabilize button:', btn);
  const withBtn = await barH();
  console.log('1280px bar/map height without and with the Stabilize button: ' + before + ' vs ' + withBtn + ' -> ' + (before === withBtn ? 'stable' : 'CHANGED'));
  // hover the downed soldier: the side panel says it is bleeding
  const at = JSON.parse(await ev(`(function(){var b=XG.TacUI.debug().b, a=b.units.filter(function(u){return u.sid})[0]; var p=XG.TacUI.tileToClient(a.x,a.y); return JSON.stringify(p);})()`));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y }); await sleep(250);
  console.log('hover:', await ev(`document.getElementById('tac-hover').textContent.slice(0, 120)`));
  await ev(`document.querySelector('#tac-abilities [data-ab="stabilize"]').click()`); await sleep(900);
  console.log('after stabilize:', await ev(`(function(){var a=XG.TacUI.debug().b.units.filter(function(u){return u.sid})[0]; return JSON.stringify({stable:a.stable, downed:a.downed}) + ' card: ' + document.querySelector('.sq.downed').textContent;})()`));
  console.log('log:', await ev(`[].slice.call(document.querySelectorAll('#tac-log div')).slice(-3).map(function(d){return d.textContent}).join(' | ')`));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x + 40, y: at.y }); await sleep(100);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y }); await sleep(250);
  await shot('downed-stable');
  // win: every hostile gone
  await ev(`(function(){var b=XG.TacUI.debug().b; b.units.forEach(function(u){ if (u.side==='enemy') { u.alive=false; u.hp=0; } }); XG.Tac.checkOutcome(b);})()`); await sleep(1500);
  await ev(`document.getElementById('tac-done') && document.getElementById('tac-done').click()`); await sleep(800);
  console.log('debrief:', await ev(`document.getElementById('modal-box') ? document.getElementById('modal-box').textContent.replace(/\\s+/g,' ').slice(0, 260) : 'no modal'`));
  await shot('downed-results');
  await ev(`document.getElementById('res-ok') && document.getElementById('res-ok').click()`); await sleep(400);
  await ev(`(function(){XG.UI.closeModal && XG.UI.isModal && XG.UI.isModal() && XG.UI.closeModal(); XG.UI.tab='barracks'; XG.UI.render();})()`); await sleep(400);
  console.log('barracks:', await ev(`[].slice.call(document.querySelectorAll('td span.bad')).map(function(s){return s.textContent}).join(', ') || 'no Critical row'`));
  await shot('downed-barracks');
  // Lattice: a disabled machine in battle
  await ev(`(function(){var g=XG.Lat.newGame(5); g.day=40; g.trace=60; g.phase='war'; var m=XG.Lat.spawnMission(g, XG.State.rng(g), 'strike'); m.scenario='exterminate';
    var b=XG.Tac.createLattice(m, ['drone','warden','harmonic'], XG.Lat.earthSquad(g, m), {}); XG.TacUI.startWith(g, b, function(){}); window.LB=b;})()`); await sleep(1200);
  console.log('lattice:', await ev(`(function(){var b=LB, T=XG.Tac, mine=b.units.filter(function(u){return u.deployed}), d=mine[0], f=b.units.filter(function(u){return u.side==='player'})[0];
    var spot=null; for (var r=2;r<8&&!spot;r++) [[r,0],[-r,0],[0,r],[0,-r]].forEach(function(o){ if (!spot&&T.tile(b,d.x+o[0],d.y+o[1])===0&&!T.unitAt(b,d.x+o[0],d.y+o[1])) spot=[d.x+o[0],d.y+o[1]]; });
    f.x=spot[0]; f.y=spot[1]; d.hp=1; d.shield=0; d.armor=0; f.dmg=[1,1]; var real=b.rng.chance; b.rng.chance=function(){return true}; f.aim=200; var s0=b.side; b.side='player'; f.ap=2; T.ai(b,f); b.side=s0; b.rng.chance=real; f.alive=false; f.hp=0;
    T.refreshVis(b); document.querySelector('[data-unit="'+mine[1].id+'"]').click(); XG.TacUI.centerOn(d.x, d.y);
    return JSON.stringify({downed: d.downed, bleed: d.bleed}) + ' card: ' + (document.querySelector('.sq.downed') ? document.querySelector('.sq.downed').textContent : 'none');})()`)); await sleep(500);
  await shot('downed-lattice');
  await send('Emulation.clearDeviceMetricsOverride', {});
}
