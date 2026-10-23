// Lattice campaign, CHALLENGE F/E screens: a raid brief with its "Ignoring this costs" line, the strike reward choice on the
// result screen (and on the Network when left unclaimed), protocol cards with crept cycle costs and substrate, an offline node.
export default async function ({ ev, shot, sleep }) {
  const click = (sel) => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'missing ${sel.replace(/'/g, '')}'; e.click(); return 'ok';})()`);
  const story = async () => { let n = 0; while (await ev(`!!document.getElementById('story-next')`) && n < 8) { await ev(`document.getElementById('story-next').click()`); await sleep(150); n++; } };

  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await click('[data-action="l-new-game"]'); await sleep(300); await story();
  // jump to the war: a raid and a strike on the board, a finished Core and a protocol history
  await ev(`(function(){var g=XG.UI.g, r=new XG.RNG(7); g.phase='war'; g.day=30; g.trace=40; g.substrate=20; g.nextRaidIn=99; g.nextStrikeIn=99;
    g.array[1]={type:'core',daysLeft:0}; g.array[2]={type:'foundry',daysLeft:0,offline:3};
    g.research.done.push('swarm_logic','seed_cascade','warden_chassis');
    XG.Lat.spawnMission(g, r, 'raid'); XG.Lat.spawnMission(g, r, 'strike'); XG.UI.render(); })()`);
  await sleep(200);
  console.log('raid ignore line:', await ev(`(function(){var e=document.querySelector('.ignore-cost'); return e ? e.textContent : 'missing';})()`));
  await shot('ls-1-network');
  await ev(`document.querySelector('[data-action="l-deploy"][data-arg="'+XG.UI.g.missions[0].id+'"]').click()`); await sleep(250);
  console.log('picker ignore line:', await ev(`!!document.querySelector('#modal-box .ignore-cost')`));
  await shot('ls-2-pick');
  await click('#lp-cancel'); await sleep(150);
  await click('[data-action="tab"][data-arg="protocols"]'); await sleep(150);
  console.log('hard-light card:', await ev(`(function(){var c=[].slice.call(document.querySelectorAll('.card')).filter(function(x){return /Hard-Light/.test(x.textContent);})[0]; return c ? c.querySelector('.meta').textContent + ' | ' + c.querySelector('button,span:last-child').outerHTML.slice(0,80) : 'missing';})()`));
  await shot('ls-3-protocols');
  await click('[data-action="tab"][data-arg="array"]'); await sleep(150);
  console.log('offline slot:', await ev(`(function(){var e=[].slice.call(document.querySelectorAll('.slot')).filter(function(x){return /Offline/.test(x.textContent);})[0]; return e ? e.textContent : 'missing';})()`));
  await shot('ls-4-array');
  await click('[data-action="tab"][data-arg="network"]'); await sleep(150);
  // a won strike: the result screen asks for the reward
  await ev(`(function(){var g=XG.UI.g, m=g.missions.filter(function(x){return x.kind==='strike';})[0];
    var out=XG.Lat.resolveMission(g, m.id, {outcome:'loss', lattice:[], humansKilled:2, turns:9, scenario:m.scenario}); XG.UI.render();
    window.__done=0; XG.LUI.results(out, function(){ window.__done++; XG.UI.render(); }); })()`);
  await sleep(250);
  console.log('choice buttons:', await ev(`!!document.getElementById('lres-trace') && !!document.getElementById('lres-sub') && !document.getElementById('lres-ok')`));
  await shot('ls-5-strike-result');
  const s0 = await ev(`XG.UI.g.substrate`);
  await click('#lres-sub'); await sleep(250);
  console.log('after claim:', await ev(`JSON.stringify({sub0:${s0}, sub:XG.UI.g.substrate, pending:!!XG.UI.g.pendingReward, done:window.__done, modal:XG.UI.isModal()})`));
  // an unclaimed reward waits on the Network, and its button claims it
  await ev(`(function(){var g=XG.UI.g, r=new XG.RNG(9), m=XG.Lat.spawnMission(g, r, 'strike'); XG.Lat.resolveMission(g, m.id, {outcome:'loss', lattice:[], humansKilled:0, turns:9, scenario:m.scenario}); XG.UI.render(); })()`);
  await sleep(200);
  await shot('ls-6-network-pending');
  const t0 = await ev(`XG.UI.g.trace`);
  await click('[data-action="l-claim"][data-arg="trace"]'); await sleep(250);
  console.log('network claim:', await ev(`JSON.stringify({trace0:${t0}, trace:XG.UI.g.trace, pending:!!XG.UI.g.pendingReward, panel:!!document.querySelector('[data-action="l-claim"]')})`));
}
