// Sprint 5: settings, help/glossary, strategy tips, portraits, the first-battle tutorial, hit breakdown, and audio.
export default async function ({ ev, shot, sleep, send }) {
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const rclick = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', clickCount: 1 });
  };
  const tile = async (x, y) => {
    const p = await ev(`XG.TacUI.tileToClient(${x},${y})`); // scrolls the camera to the tile first
    return [p.x, p.y];
  };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await click(5, 5); await sleep(150); // a real gesture unlocks audio
  console.log('audio after gesture:', await ev(`JSON.stringify(XG.Audio._state())`));
  console.log('sfx errors:', await ev(`(function(){var bad=[]; Object.keys(XG.Audio.SFX).forEach(function(k){ try{ XG.Audio.SFX[k]({machine:true}); }catch(e){ bad.push(k+': '+e.message); } }); return JSON.stringify(bad);})()`));
  // settings
  await ev(`document.querySelector('#screen-title [data-action="settings"]').click()`); await sleep(200);
  await shot('s1-settings');
  await ev(`(function(){var s=document.querySelector('[data-set="speed"]'); s.value='2'; s.onchange(); var p=document.querySelector('[data-set="palette"]'); p.value='contrast'; p.onchange();})()`);
  console.log('settings saved:', await ev(`JSON.stringify({speed:XG.Settings.get('speed'), palette:XG.Settings.get('palette'), cb:document.body.classList.contains('cb'), stored:!!localStorage.getItem('firewall-settings-v1')})`));
  await ev(`(function(){var p=document.querySelector('[data-set="palette"]'); p.value='default'; p.onchange();})()`);
  await ev(`XG.UI.closeModal()`);
  // help
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'F1', code: 'F1' }); await sleep(200);
  await ev(`(function(){var q=document.getElementById('gl-q'); q.value='flank'; q.oninput();})()`); await sleep(100);
  console.log('glossary hits for "flank":', await ev(`document.querySelectorAll('#gl-list .gl').length`));
  await shot('s2-help');
  await ev(`XG.UI.closeModal()`);
  // new campaign: tips and portraits
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(300);
  console.log('command tip shown:', await ev(`!!document.querySelector('.tip')`));
  await shot('s3-tip');
  await ev(`document.querySelector('[data-action="tip-ok"]').click()`); await sleep(100);
  console.log('tip dismissed:', await ev(`!document.querySelector('.tip') && XG.Settings.tipSeen('fw:command')`));
  await ev(`document.querySelector('[data-action="tab"][data-arg="barracks"]').click()`); await sleep(200);
  console.log('portraits drawn:', await ev(`document.querySelectorAll('canvas.portrait').length`));
  await shot('s4-barracks');
  // first battle with the coach
  await ev(`(function(){var g=XG.UI.g, r=XG.State.rng(g); g.missions=[]; var m=XG.Strat.spawnMission(g,r,'purge'); m.diff=1; XG.State.saveRng(g,r); XG.UI.tab='command'; XG.UI.render();})()`);
  await ev(`document.querySelector('[data-action="deploy"]').click()`); await sleep(300);
  await shot('s5-picker');
  await ev(`document.getElementById('sq-go').click()`); await sleep(700);
  console.log('coach:', await ev(`JSON.stringify(XG.Tutorial.state())`), await ev(`document.querySelector('.coach-h') && document.querySelector('.coach-h').textContent`));
  await shot('s6-coach');
  const u = await ev(`(function(){var s=XG.TacUI.debug(), u=XG.Tac.unitById(s.b,s.sel); var r=XG.Tac.reach(s.b,u,u.mobility); for(var i=0;i<r.d.length;i++){ if(r.d[i]>=2&&r.d[i]<=4) return [i%s.b.W, Math.floor(i/s.b.W)]; } return null;})()`);
  const p = await tile(u[0], u[1]); await rclick(p[0], p[1]); await sleep(900);
  console.log('after a move:', await ev(`JSON.stringify(XG.Tutorial.state())`));
  // breakdown: put a drone in view and hover it
  const e = await ev(`(function(){var s=XG.TacUI.debug(), b=s.b, u=XG.Tac.unitById(s.b,s.sel)||b.units[0]; var d=b.units.filter(x=>x.side==='enemy'&&!x.isStatic)[0];
    var x=u.x+5, y=u.y; for(var k=u.x+1;k<=x;k++) b.tiles[y*22+k]=0; d.x=x; d.y=y; b.visible=b.visible.map(()=>true); s.reachCache=null; return [x,y];})()`);
  let q = await tile(e[0] + 1, e[1]); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1] }); await sleep(80);
  q = await tile(e[0], e[1]); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1] }); await sleep(250);
  console.log('breakdown:', await ev(`(document.querySelector('#tac-hover table.odds')||{}).innerText`));
  await shot('s7-breakdown');
  console.log('audio scene in battle:', await ev(`JSON.stringify(XG.Audio._state())`));
}
