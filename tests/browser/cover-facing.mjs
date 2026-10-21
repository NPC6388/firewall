// Cursor cover shields judge each side against the hostiles you can see (training range: gunner drone at 17,12).
export default async function ({ ev, shot, sleep, send }) {
  const hover = async (x, y) => { const p = JSON.parse(await ev(`JSON.stringify((function(){var r=document.querySelector('#screen-tactical canvas').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width/XG.Tac.W,h:r.height/XG.Tac.H}})())`));
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.l + (x + .5) * p.w, y: p.t + (y + .5) * p.h }); await sleep(250); };
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`document.querySelector('#screen-title [data-action="training"]').click()`); await sleep(800);
  await ev(`(function(){var c=document.getElementById('coach'); c.classList.add('hidden');})()`);
  for (const [x, y, why] of [[9, 12, 'west of the tall cover: E side faces the gunner'], [11, 12, 'east of the tall cover: W side faces no one'], [9, 5, 'south of crate 9,4 (N side, gunner is SE)'], [9, 3, 'north of crate 9,4 (S side faces the gunner)']]) {
    await hover(0, 0); await hover(x, y);
    console.log(why, '->', await ev(`(document.querySelector('#tac-hover .dim')||{}).innerText`));
    await shot('cover-' + x + '-' + y);
  }
}
