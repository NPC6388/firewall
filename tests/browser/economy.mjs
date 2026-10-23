// FIREWALL economy (challenge phase 1b): mission card shows the expiry cost and a threat past 5, research cards show the
// crept cost, Barracks shows the rising hire cost and the roster cap, a stalled Sentinel repair, and the restock line.
export default async function ({ ev, sleep, shot }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){ var g=XG.UI.g; g.day=100; var r=XG.State.rng(g); var m=XG.Strat.spawnMission(g,r,'purge'); XG.State.saveRng(g,r);
    XG.UI.tab='command'; XG.UI.render(); })()`); await sleep(200);
  console.log('mission card:', await ev(`[...document.querySelectorAll('.mission')].map(e=>e.innerText.replace(/\\s+/g,' ')).join(' || ')`));
  await shot('eco-mission');
  await ev(`(function(){ var g=XG.UI.g; g.research.done.push('signal_analysis','drone_teardown','lattice_grammar'); XG.UI.tab='research'; XG.UI.render(); })()`); await sleep(200);
  console.log('research metas:', await ev(`[...document.querySelectorAll('.card')].map(c=>c.querySelector('h3').innerText+': '+c.querySelector('.meta').innerText).join(' | ')`));
  await shot('eco-research');
  await ev(`(function(){ var g=XG.UI.g; g.credits=500; XG.Strat.hire(g,'trooper'); g.research.done.push('halcyon'); g.base[1]={type:'workshop',daysLeft:0}; g.salvage=80;
    XG.Strat.fabricate(g,'sentinel'); var s=g.soldiers[g.soldiers.length-1]; s.hp=2; g.salvage=0; XG.UI.tab='barracks'; XG.UI.render(); })()`); await sleep(200);
  console.log('hire row:', await ev(`document.querySelector('.advance-row').innerText.replace(/\\s+/g,' ')`));
  console.log('sentinel status:', await ev(`[...document.querySelectorAll('table.sortable tr')].filter(r=>/Sentinel/.test(r.innerText)).map(r=>r.innerText.replace(/\\s+/g,' ')).join(' | ')`));
  await shot('eco-barracks');
  await ev(`(function(){ var g=XG.UI.g; g.credits=500; XG.Strat.hire(g,'hacker'); XG.UI.render(); })()`); await sleep(150);
  console.log('full roster:', await ev(`document.querySelector('.advance-row').innerText.replace(/\\s+/g,' ')`), 'disabled:', await ev(`document.querySelector('[data-action="hire"]').disabled`));
  await ev(`(function(){ var g=XG.UI.g; g.salvage=30; var m=g.missions[0]; XG.UI.results({ mission: m, outcome: 'win', deaths: [], promotions: [], salvage: 20, credits: 15, infection: -12, mult: 1, restock: 7, used: { grenade: 1, medkit: 1 } }, function(){}); })()`); await sleep(200);
  console.log('results:', await ev(`document.getElementById('modal-box').innerText.replace(/\\s+/g,' ')`));
  await shot('eco-results');
}
