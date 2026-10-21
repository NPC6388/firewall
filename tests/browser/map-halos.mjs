// World-map infection halos: area proportional to infection, on both campaigns.
export default async function ({ ev, sleep, send }) {
  const fs = await import('node:fs');
  const grab = async (name) => {
    const r = await ev(`(function(){var r=document.querySelector('.worldmap').getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()`);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1 } });
    fs.writeFileSync('tests/browser/shots/' + name + '.png', Buffer.from(res.result.data, 'base64')); console.log('saved', name);
  };
  await ev(`localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next').click()`); await sleep(200);
  await ev(`(function(){var g=XG.UI.g; g.research.done.push('signal_analysis'); var v=[2,27,3,4,5,60]; g.regions.forEach(function(r,i){ r.infection=v[i]; }); XG.UI.render();})()`); await sleep(300);
  console.log('FIREWALL halo radii:', await ev(`[...document.querySelectorAll('.worldmap circle[fill^="url(#halo"]')].map(c=>c.getAttribute('r')).join(', ')`));
  await grab('mh-firewall');
  await ev(`XG.UI.g=null; localStorage.clear(); localStorage.setItem('firewall-settings-v1', JSON.stringify({hints:false})); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('[data-action="l-new-game"]').click()`); await sleep(300);
  await ev(`document.getElementById('story-next') && document.getElementById('story-next').click()`); await sleep(300);
  await ev(`(function(){var g=XG.UI.g; var v=[90,10,45,20,70,1]; g.regions.forEach(function(r,i){ r.infection=v[i]; }); XG.UI.render();})()`); await sleep(300);
  console.log('Lattice halo radii:', await ev(`[...document.querySelectorAll('.worldmap circle[fill^="url(#halo"]')].map(c=>c.getAttribute('r')).join(', ')`));
  await grab('mh-lattice');
}
