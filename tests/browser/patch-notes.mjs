// Help has a Patch notes tab next to Field manual (a placeholder until the Steam release). Shot: patch-notes.png
export default async function ({ ev, shot, sleep }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`XG.Help.open('manual')`); await sleep(200);
  console.log('tabs:', await ev(`[].map.call(document.querySelectorAll('[data-help]'), function(b){return b.textContent}).join(' | ')`));
  await ev(`document.querySelector('[data-help="notes"]').click()`); await sleep(200);
  console.log('notes:', await ev(`document.querySelector('.help-tabs').nextElementSibling.textContent`));
  await shot('patch-notes');
}
