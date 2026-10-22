// The field manual explains how XP is earned and what ranks give. Shot: manual-xp.png
export default async function ({ ev, shot, sleep }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`XG.Help.open('manual')`); await sleep(200);
  console.log(await ev(`[].filter.call(document.querySelectorAll('#modal-box p'), function(p){return /Experience/.test(p.textContent)}).map(function(p){return p.textContent}).join(String.fromCharCode(10))`));
  await shot('manual-xp');
}
