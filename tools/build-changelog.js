// Turns CHANGELOG.md into js/changelog.js (XG.CHANGELOG) for the in-game Patch notes tab. The game can't read the
// Markdown itself when opened from file://, so the data file is generated and committed. Run after editing the changelog:
//   node tools/build-changelog.js
// tests/smoke.js fails if js/changelog.js is out of date.
var fs = require('fs'), path = require('path');

// Everything from the first "## " heading down: ## = a release (or Unreleased), ### = a dated group, "- " = an entry
// (indented lines continue it). The preamble above the first release is for developers and stays out of the game.
function parse(md) {
  var out = [], rel = null, grp = null, item = null;
  var esc = function (t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var inline = function (t) { return esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); };
  md.split(/\r?\n/).forEach(function (line) {
    var m;
    if ((m = /^## (.+)/.exec(line))) { rel = { name: m[1].trim(), groups: [] }; out.push(rel); grp = item = null; }
    else if (!rel) return;
    else if ((m = /^### (.+)/.exec(line))) { grp = { name: m[1].trim(), items: [] }; rel.groups.push(grp); item = null; }
    else if ((m = /^- (.+)/.exec(line))) {
      if (!grp) { grp = { name: '', items: [] }; rel.groups.push(grp); }
      item = m[1].trim(); grp.items.push(item);
    } else if (item !== null && /^\s+\S/.test(line)) grp.items[grp.items.length - 1] += ' ' + line.trim();
    else item = null;
  });
  out.forEach(function (r) { r.groups.forEach(function (g) { g.items = g.items.map(inline); g.name = esc(g.name); }); r.name = esc(r.name); });
  return out;
}
function generate(md) {
  return '// Generated from CHANGELOG.md by tools/build-changelog.js. Do not edit by hand.\n' +
    'var XG = globalThis.XG = globalThis.XG || {};\n' +
    'XG.CHANGELOG = ' + JSON.stringify(parse(md), null, 1) + ';\n';
}
var ROOT = path.join(__dirname, '..');
function build() { return generate(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8')); }

if (require.main === module) {
  fs.writeFileSync(path.join(ROOT, 'js', 'changelog.js'), build());
  console.log('js/changelog.js written');
}
module.exports = { parse: parse, generate: generate, build: build };
