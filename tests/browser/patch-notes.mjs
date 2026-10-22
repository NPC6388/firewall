// Help has a Patch notes tab next to Field manual, filled from CHANGELOG.md (js/changelog.js). Shot: patch-notes.png
export default async function ({ ev, shot, sleep }) {
  await ev(`localStorage.clear(); location.reload()`); await sleep(1200);
  await ev(`XG.Help.open('manual')`); await sleep(200);
  console.log('tabs:', await ev(`[].map.call(document.querySelectorAll('[data-help]'), function(b){return b.textContent}).join(' | ')`));
  await ev(`document.querySelector('[data-help="notes"]').click()`); await sleep(200);
  console.log('entries:', await ev(`document.querySelectorAll('.notes li').length`), '| groups:', await ev(`[].map.call(document.querySelectorAll('.notes-date'), function (d) { return d.textContent; }).join(', ')`),
    '| first:', await ev(`document.querySelector('.notes li').textContent`));
  await shot('patch-notes');
}
