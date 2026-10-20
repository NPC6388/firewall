// Lattice campaign through the real UI: title -> new Lattice game -> every tab -> compile/build/protocol ->
// advance to the first breach (security software) -> deploy -> battle (person = Lattice; the shared AI moves for us, turns end via the button) -> debrief.
export default async function ({ ev, shot, sleep, send }) {
  const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }); };
  const click = (sel) => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'missing ${sel.replace(/'/g, '')}'; e.click(); return 'ok';})()`);
  const story = async (tag) => { let n = 0; while (await ev(`!!document.getElementById('story-next')`) && n < 8) { if (tag && n === 0) await shot(tag); await ev(`document.getElementById('story-next').click()`); await sleep(150); n++; } return n; };
  const waitIdle = async () => { for (let i = 0; i < 300; i++) { if (await ev(`(function(){var s=XG.TacUI.debug(); return !s || s.b.outcome || (!s.cur && !s.queue.length && s.b.side===s.b.human);})()`)) return; await sleep(80); } };

  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await shot('90-title');
  console.log('new:', await click('[data-action="l-new-game"]')); await sleep(300);
  console.log('intro beats:', await story('91-intro'));
  await shot('92-network');
  for (const t of ['protocols', 'array', 'forces', 'archive']) { await click(`[data-action="tab"][data-arg="${t}"]`); await sleep(150); await shot('93-' + t); }
  await click('[data-action="tab"][data-arg="forces"]'); console.log('compile:', await click('[data-action="l-compile"][data-arg="drone"]'));
  await click('[data-action="tab"][data-arg="array"]'); await click('[data-action="slot"][data-arg="1"]'); console.log('build:', await click('[data-action="l-build"][data-arg="foundry"]'));
  await click('[data-action="tab"][data-arg="protocols"]'); console.log('protocol:', await click('[data-action="l-protocol"][data-arg="swarm_logic"]'));
  await click('[data-action="tab"][data-arg="network"]'); console.log('seed:', await click('[data-action="l-seed"][data-arg="eu"]'));
  for (let i = 0; i < 8; i++) {
    await click('[data-action="l-advance"]'); await sleep(200); await story();
    if (await ev(`XG.UI.g.missions.length > 0`)) break;
  }
  await shot('94-network-breach');
  console.log('state:', await ev(`JSON.stringify({day:XG.UI.g.day, compute:Math.floor(XG.UI.g.compute), forces:XG.UI.g.forces, conv:XG.UI.g.convergence.toFixed(1), trace:XG.UI.g.trace.toFixed(1), missions:XG.UI.g.missions.map(m=>m.kind), phase:XG.UI.g.phase})`));
  await ev(`document.querySelector('[data-action="l-deploy"][data-arg="'+XG.UI.g.missions[0].id+'"]').click()`); await sleep(250);
  await shot('95-pick');
  await click('#lp-go'); await sleep(600);
  await shot('96-battle-start');
  await waitIdle();
  await shot('97-your-turn');
  for (let t = 0; t < 14; t++) {
    await waitIdle();
    if (await ev(`(function(){var s=XG.TacUI.debug(); return !s || !!s.b.outcome;})()`)) break;
    await ev(`(function(){var s=XG.TacUI.debug(), b=s.b; b.units.filter(u=>u.alive&&u.side==='enemy'&&!u.isStatic).forEach(u=>{ if(!b.outcome) XG.Tac.ai(b,u); }); XG.Tac.checkOutcome(b); s.dirty=true; })()`);
    await sleep(100);
    if (t === 1) await shot('98-mid');
    await click('#tac-endturn'); await sleep(200);
  }
  await waitIdle(); await sleep(1500);
  console.log('battle:', await ev(`(function(){var s=XG.TacUI.debug(); return s ? s.b.outcome + ' turn ' + s.b.turn : 'closed';})()`));
  await shot('99-battle-end');
  if (await ev(`!!document.getElementById('tac-done')`)) {
    await click('#tac-done'); await sleep(300); await shot('99b-results');
    await click('#lres-ok'); await sleep(300); await story();
    console.log('after:', await ev(`JSON.stringify({forces:XG.UI.g.forces, stats:XG.UI.g.stats, log:XG.UI.g.log[0].msg, saved: !!localStorage.getItem('firewall-lattice-save-v1')})`));
  }
  await click('[data-action="tab"][data-arg="archive"]'); await click('[data-action="to-title"]'); await sleep(200);
  console.log('title continue buttons:', await ev(`JSON.stringify({fw:!document.getElementById('btn-continue').classList.contains('hidden'), lat:!document.getElementById('btn-l-continue').classList.contains('hidden'), theme:document.body.className})`));
}
