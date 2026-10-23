// FIREWALL: strategy-map decoration (continents, data packets, the satellite) and the animated title globe.
var XG = globalThis.XG = globalThis.XG || {};

XG.Backdrop = (function () {
  var REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Low-res Mercator world (Natural Earth 1:110m land, public domain), one character per 1 x 1 cell of the
  // 100 x 56.25 viewBox, rows top to bottom from 78N to about 59S. The letter is the region that cell belongs to:
  // n = na, s = sa, e = eu, f = af, a = as, o = oc; '.' is sea. Regenerate with tools/map-raster.js, don't hand-edit.
  var REGION_OF = { n: 'na', s: 'sa', e: 'eu', f: 'af', a: 'as', o: 'oc' };
  var LAND = [
    '.........................nnn..nnnnnnnnnnnnnee.........e.e...........................................',
    '................nn.....n.nnn..nnnnnnnnnnnnnee.........e.............a.........aaa...................',
    '................nnnnnnn.n......nnnnnnnnnnnnee.....................eaa.......aaaaaa......aa..........',
    '.................nnnn.nnnnnn......nnnnnnnnnee....................ee.......aaaaaaaa......aaaa........',
    '...............nnn.....n..........nnnnnnnnnee....................e.......aaaaaaaa...................',
    '...............nnnn.n.nnnnnnn.....nnnnnnnnne.....................e......aaaaaaaaaaaaaa...a..........',
    '...............nnnnnn.nn.nnnn.....nnnnnnnnne....................ee...aaaaaaaaaaaaaaaaa..aaaa........',
    'a....nnn.........nnnn..nnnnnnnn....nnnnnnnne.............ee......e..aaaaaaaaaaaaaaaaaaaaaaaaaa......',
    '.....nnnnnn..nnnnnnnnnnnn.nnnnn....nnnnnnnne...........eeee........a.aaaaaaaaaaaaaaaaaaaaaaaaaaa.aa.',
    'a...nnnnnnnnnnnnnnnnnn.nnnnn.nnn...nnnnnnn............eeeeeee.e.eeeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'aa..nnnnnnnnnnnnnnnnnnnnnnn..nnnn..nnnnnn.............eeeeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'aaannnnnnnnnnnnnnnnnnnnnnnn..nn.n..nnnnn...eee.......eeeeeee.eeeeeeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '....nnnnnnnnnnnnnnnnnnnnn.nn.nnn...nnnn.....ee......eeeeeeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '....nnnnnnnnnnnnnnnnnnnnn...nnnn....nn.............eeee.eeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.',
    '....nnnnnnnnnnnnnnnnnnnn....nnn......n.............eeee.eeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaa..',
    '.....nnn...nnnnnnnnnnnnn....nnnnn..................eeee.eeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaaaa.a.a.....',
    '......nn.....nnnnnnnnnnnn...nnnnn...............ee..eee.eeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaa....aaa....',
    '.............nnnnnnnnnnnnnn.nnnnnn.............eee..ee.eeeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaa.....aa.....',
    '..............nnnnnnnnnnnnn.nnnnnnn............eee.eeeeeeeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaaa...a......',
    '..............nnnnnnnnnnnnnnnnnnnnn..............eeeeeeeeeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaaa..........',
    '...............nnnnnnnnnnnnnnnnn..n..............eeeeeeeeeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaaaa..........',
    '...............nnnnnnnnnnnnnnnnnn................eeeeeeeeeeeeeeeeeeaaaaaaaaaaaaaaaaaaaaa.a..........',
    '...............nnnnnnnnnnnnnnnn.................eeeeeeeeee...aa.aaaaaaaaaaaaaaaaaaaaaaaa.a..........',
    '...............nnnnnnnnnnnnnnn.................eeee.e.eeeeeeeaaa.aaaaaaaaaaaaaaaaaaaaa..............',
    '................nnnnnnnnnnnnn..................eee....e.eeeeeaaa.aaaaaaaaaaaaaaaaaaa.a..a...........',
    '................nnnnnnnnnnnnn...................fffff.......aaaaaaaaaaaaaaaaaaaaaaa..a.aa...........',
    '.................nnnnnnnnnnn...................ffffffff.ffffaaaaaaaaaaaaaaaaaaaaaaaa..a.............',
    '..................nnnnnnn..n...................fffffffffffffaaaaaaaaaaaaaaaaaaaaaaaa................',
    '...................nnnn.......................ffffffffffffffaaaa.aaaaaaaaaaaaaaaaaaa................',
    '....................nnn..n..n................fffffffffffffff.aaaaaa..aaaaaaaaaaaaa..................',
    '.....................nnnnn..n.n..............fffffffffffffffaaaaaa....aaaa..aaaa....................',
    '.......................nnnn..................fffffffffffffffa.aaa.....aaa....aaa...a................',
    '..........................n..ss..............fffffffffffffffaa.a.......aa....aaa....................',
    '..........................n.nsssss............ffffffffffffffffff.......aa....a......a...............',
    '............................ssssssss...........fff.fffffffffffff.............aa...o.................',
    '............................ssssssss................fffffffffff..............aa.ooo.................',
    '...........................ssssssssssss.............ffffffffff................o.oooo..oooo..........',
    '...........................sssssssssssss.............ffffffff..................oo.......ooo.........',
    '............................ssssssssssss.............ffffffff....................o..................',
    '............................ssssssssssss.............fffffffff.f......................oo.o..........',
    '.............................ssssssssss..............ffffffff.ff....................ooooooo.........',
    '..............................sssssssss..............fffffff..ff...................oooooooo.........',
    '..............................ssssssss................ffffff..f..................ooooooooooo........',
    '..............................sssssss.................fffff......................oooooooooooo.......',
    '..............................ssssss...................ffff.......................ooooooooooo.......',
    '..............................ssssss...................fff........................ooo..ooooo........',
    '..............................sssss.....................................................oooo........',
    '.............................sssss.......................................................oo.......oo',
    '.............................sss..........................................................o.......o.',
    '.............................sss.................................................................o..',
    '.............................sss................................................................o...',
    '.............................sss....................................................................',
    '.............................ss.....................................................................',
    '.............................ss.....................................................................',
    '...............................s....................................................................',
    '....................................................................................................'
  ];

  // opts: { H, accent ('r,g,b'), packet ('#hex'), pos {id: [x, y]}, links, signal,
  //         cell(regionId, frac) -> [colour, opacity] for a land pixel whose distance from its region's node is frac
  //         (0 at the node, 1 at the region's farthest pixel, in steps of 1/20),
  //         key (id prefix, so two maps in one page don't share patterns) }
  // mapDecor is the STILL part of the map (land, orbit line). Everything that moves goes in mapFx, a second SVG laid over
  // it on its own compositor layer: an animation inside the big map SVG re-rasterised all its pattern-filled land every
  // frame (~one CPU core in the browser's GPU process, measured headed), which starved video playing elsewhere.
  function mapDecor(o) {
    var s = '';
    // land as pixels: each cell's shade comes from o.cell(region, distance from the node); one pattern per distinct
    // shade, one rect per run of equal shades in a row
    var far = {}, shade = [], pats = {}, np = 0;
    LAND.forEach(function (row, y) { for (var x = 0; x < row.length; x++) { var id = REGION_OF[row[x]]; if (!id) continue;
      var p = o.pos[id], d = Math.hypot(x + .5 - p[0], y + .5 - p[1]); far[id] = Math.max(far[id] || 0, d); } });
    LAND.forEach(function (row, y) {
      shade[y] = [];
      for (var x = 0; x < row.length; x++) {
        var id = REGION_OF[row[x]]; if (!id) { shade[y][x] = null; continue; }
        var p = o.pos[id], f = Math.round(Math.hypot(x + .5 - p[0], y + .5 - p[1]) / far[id] * 20) / 20, t = o.cell(id, f), k = t[0] + '|' + t[1].toFixed(2);
        if (!pats[k]) { pats[k] = 'px-' + (o.key || '') + (np++);
          s += '<pattern id="' + pats[k] + '" width="1" height="1" patternUnits="userSpaceOnUse"><rect x=".1" y=".1" width=".8" height=".8" fill="' + t[0] + '" fill-opacity="' + t[1].toFixed(2) + '"/></pattern>'; }
        shade[y][x] = pats[k];
      }
    });
    shade.forEach(function (row, y) {
      for (var x = 0; x < row.length;) {
        var k = row[x], x0 = x; while (x < row.length && row[x] === k) x++;
        if (k) s += '<rect x="' + x0 + '" y="' + y + '" width="' + (x - x0) + '" height="1" fill="url(#' + k + ')"/>';
      }
    });
    // the orbit the signal came through (the satellite itself moves, so it lives in mapFx)
    s += '<path d="' + orbitPath(o) + '" fill="none" stroke="rgba(' + o.accent + ',.15)" stroke-width=".2" stroke-dasharray=".6 .8"/>';
    return s;
  }
  function orbitPath(o) { return 'M 3 ' + (o.H - 3) + ' Q 50 ' + (o.H - 13) + ' 97 ' + (o.H - 3); }
  // The moving layer: a whole <svg class="worldmap-fx"> to place right after the map's <svg> inside a .worldmap-wrap.
  // Same options as mapDecor; extra = more animated markup (the mission pulse rings).
  function mapFx(o, extra) {
    var s = '<svg class="worldmap-fx" viewBox="0 0 100 ' + o.H + '" aria-hidden="true"><defs>' +
      '<linearGradient id="sweepg-' + (o.key || '') + '" x1="0" x2="1"><stop offset="0" stop-color="rgba(' + o.accent + ',0)"/><stop offset="1" stop-color="rgba(' + o.accent + ',.09)"/></linearGradient></defs>';
    if (!REDUCED) {
      s += '<rect y="0" width="14" height="' + o.H + '" fill="url(#sweepg-' + (o.key || '') + ')"><animate attributeName="x" from="-14" to="100" dur="7s" repeatCount="indefinite"/></rect>';
      // packets running along each link, both ways
      o.links.forEach(function (l, i) {
        var a = o.pos[l[0]], b = o.pos[l[1]], fwd = 'M' + a[0] + ' ' + a[1] + ' L' + b[0] + ' ' + b[1], back = 'M' + b[0] + ' ' + b[1] + ' L' + a[0] + ' ' + a[1];
        s += '<circle r=".38" fill="' + o.packet + '"><animateMotion dur="' + (2.6 + (i % 3) * .7) + 's" begin="' + (i * .37) + 's" repeatCount="indefinite" path="' + fwd + '"/></circle>';
        s += '<circle r=".3" fill="' + o.packet + '" opacity=".6"><animateMotion dur="' + (3.4 + (i % 2) * .8) + 's" begin="' + (i * .53 + 1) + 's" repeatCount="indefinite" path="' + back + '"/></circle>';
      });
    }
    // the satellite the signal came through
    var orbit = orbitPath(o);
    s += (extra || '') + '<g><rect x="-1.3" y="-.35" width="2.6" height=".7" fill="#7d8ea5"/><rect x="-.45" y="-.6" width=".9" height="1.2" fill="#cfdbe9"/>' +
      '<circle r="1.6" fill="none" stroke="' + o.signal + '" stroke-width=".2">' + (REDUCED ? '' : '<animate attributeName="r" values=".8;2.6" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.6s" repeatCount="indefinite"/>') + '</circle>' +
      (REDUCED ? '' : '<animateMotion dur="40s" repeatCount="indefinite" path="' + orbit + '"/>') + '</g>';
    return s + '</svg>';
  }

  // ---------------------------------------------------------- title globe
  var cv, ctx, pts = null, nodes = null, edges = null, stars = null, t0 = 0;
  function noise(x, y, z) { // cheap smooth-ish noise from summed sines, enough for continents
    return Math.sin(x * 2.1 + y * 1.3) * .5 + Math.sin(y * 3.3 - z * 1.7) * .35 + Math.sin(z * 2.7 + x * 2.9) * .3 + Math.sin(x * 5.1 - z * 4.3) * .15;
  }
  function build() {
    pts = []; var N = 2600, ga = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i, x = Math.cos(th) * r, z = Math.sin(th) * r;
      pts.push([x, y, z, noise(x, y, z) > .18]);
    }
    var land = pts.filter(function (p) { return p[3]; });
    nodes = []; for (var k = 0; k < 46; k++) nodes.push(land[Math.floor((k * 7919) % land.length)]);
    edges = [];
    nodes.forEach(function (a, i) {
      var best = nodes.map(function (b, j) { return [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2]; })
        .filter(function (q) { return q[0] !== i; }).sort(function (p, q) { return p[1] - q[1]; }).slice(0, 2);
      best.forEach(function (q) { edges.push([i, q[0], (i * 37 + q[0] * 11) % 100 / 100]); });
    });
    stars = []; for (var s2 = 0; s2 < 160; s2++) stars.push([Math.random(), Math.random(), Math.random() * 1.2 + .2, Math.random() * 6]);
  }
  function startTitle() {
    var screen = document.getElementById('screen-title');
    if (!screen || cv) return;
    cv = document.createElement('canvas'); cv.className = 'title-bg'; screen.insertBefore(cv, screen.firstChild);
    ctx = cv.getContext('2d'); build(); t0 = performance.now();
    requestAnimationFrame(loop);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.getElementById('screen-title').classList.contains('hidden')) return;
    if (now - (cv.last || 0) < 29) return; // a slow globe looks the same at 30 fps, at half the GPU load
    cv.last = now;
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (REDUCED && cv.drawn) return;
    cv.drawn = true;
    var t = REDUCED ? 20000 : Math.max(0, now - t0); // the first frame can be stamped before t0
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    stars.forEach(function (s) { ctx.fillStyle = 'rgba(200,220,255,' + (.25 + .25 * Math.sin(t / 900 + s[3])) + ')'; ctx.fillRect(s[0] * w, s[1] * h, s[2], s[2]); });
    var R = Math.min(w, h) * .36, cx = w * .5, cy = h * .5 + R * .15, rot = t / 9000, tilt = .38;
    var proj = function (p) {
      var x = p[0] * Math.cos(rot) - p[2] * Math.sin(rot), z = p[0] * Math.sin(rot) + p[2] * Math.cos(rot);
      var y = p[1] * Math.cos(tilt) - z * Math.sin(tilt); z = p[1] * Math.sin(tilt) + z * Math.cos(tilt);
      return [cx + x * R, cy + y * R, z];
    };
    // atmosphere
    var g = ctx.createRadialGradient(cx, cy, R * .85, cx, cy, R * 1.25);
    g.addColorStop(0, 'rgba(79,209,255,.10)'); g.addColorStop(1, 'rgba(79,209,255,0)'); ctx.fillStyle = g; ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
    ctx.fillStyle = 'rgba(6,14,26,.85)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    // how far the Lattice has spread: grows over ~40 s, then loops
    var spread = (.35 + t / 40000) % 1.15;
    pts.forEach(function (p) {
      var q = proj(p); if (q[2] < 0) return;
      var a = .2 + q[2] * .8;
      ctx.fillStyle = p[3] ? 'rgba(79,209,255,' + a + ')' : 'rgba(79,209,255,' + a * .22 + ')';
      ctx.fillRect(q[0] - 1, q[1] - 1, p[3] ? 2.2 : 1.2, p[3] ? 2.2 : 1.2);
    });
    ctx.lineWidth = 1;
    edges.forEach(function (e) {
      if (e[2] > spread) return;
      var a = proj(nodes[e[0]]), b = proj(nodes[e[1]]); if (a[2] < 0 && b[2] < 0) return;
      var f = Math.min(1, (spread - e[2]) * 6), vis = Math.max(0, Math.min(a[2], b[2]) + .3);
      ctx.strokeStyle = 'rgba(255,42,85,' + .55 * vis + ')';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); ctx.stroke();
    });
    nodes.forEach(function (n, i) {
      var q = proj(n); if (q[2] < 0) return;
      var on = edges.some(function (e) { return (e[0] === i || e[1] === i) && e[2] <= spread; });
      if (!on) return;
      ctx.fillStyle = 'rgba(255,61,242,' + (.4 + .5 * q[2]) * (.6 + .4 * Math.sin(t / 300 + i)) + ')';
      ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, Math.PI * 2); ctx.fill();
    });
    // the satellite on its orbit, beaming the signal down
    var sa = t / 6000, sx = cx + Math.cos(sa) * R * 1.45, sy = cy + Math.sin(sa) * R * .32 - R * .25;
    var tgt = proj(nodes[Math.floor(t / 2500) % nodes.length]);
    if (tgt[2] > 0) {
      var bg = ctx.createLinearGradient(sx, sy, tgt[0], tgt[1]); bg.addColorStop(0, 'rgba(255,42,85,.5)'); bg.addColorStop(1, 'rgba(255,42,85,0)');
      ctx.strokeStyle = bg; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t / 30; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tgt[0], tgt[1]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = '#7d8ea5'; ctx.fillRect(sx - 7, sy - 1.5, 14, 3); ctx.fillStyle = '#cfdbe9'; ctx.fillRect(sx - 2, sy - 3, 4, 6);
    ctx.strokeStyle = 'rgba(255,42,85,' + (1 - (t % 1600) / 1600) + ')'; ctx.beginPath(); ctx.arc(sx, sy, 4 + (t % 1600) / 80, 0, Math.PI * 2); ctx.stroke();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startTitle); else startTitle();
  }
  // Infection halo around a region node: its AREA is proportional to infection (radius ∝ √infection),
  // so 25% covers a quarter of what 100% does. 100% reaches HALO_MAX map units.
  var HALO_MAX = 13;
  function haloRadius(inf) { return Math.sqrt(Math.max(0, Math.min(100, inf)) / 100) * HALO_MAX; }
  function halo(id, x, y, inf, col) {
    var r = haloRadius(inf); if (r < .3) return '';
    return '<radialGradient id="halo-' + id + '"><stop offset="0" stop-color="' + col + '" stop-opacity=".42"/><stop offset=".7" stop-color="' + col + '" stop-opacity=".16"/>' +
      '<stop offset="1" stop-color="' + col + '" stop-opacity=".03"/></radialGradient>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r.toFixed(2) + '" fill="url(#halo-' + id + ')" stroke="' + col + '" stroke-opacity=".45" stroke-width=".18" stroke-dasharray=".7 .5"/>';
  }

  // Before infection is visible (FIREWALL, no Signal Analysis): a blurred grey halo in one of three sizes,
  // a rough estimate that doesn't give the exact number away.
  var ROUGH = [{ max: 25, inf: 15, label: '~LOW' }, { max: 50, inf: 37, label: '~MEDIUM' }, { max: Infinity, inf: 70, label: '~HIGH' }];
  function roughBand(inf) { for (var i = 0; i < ROUGH.length; i++) if (inf < ROUGH[i].max) return ROUGH[i]; return ROUGH[ROUGH.length - 1]; }
  function roughHalo(id, x, y, inf) {
    var r = haloRadius(roughBand(inf).inf), col = '#7d8ea5';
    return '<filter id="haze-' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + (r * .18).toFixed(2) + '"/></filter>' +
      '<circle class="halo-rough" cx="' + x + '" cy="' + y + '" r="' + r.toFixed(2) + '" fill="' + col + '" fill-opacity=".26" filter="url(#haze-' + id + ')"/>';
  }

  // Infection spreading out from a region's node: the region's infection at the node, falling to 0% at the
  // region's farthest pixel (frac 1), in the campaign's own infection colours (colorOf: % -> colour).
  function spread(inf, frac, colorOf) {
    var local = Math.max(0, Math.min(100, inf)) * (1 - frac);
    return [colorOf(Math.round(local / 5) * 5), .5];
  }

  return { mapDecor: mapDecor, mapFx: mapFx, LAND: LAND, spread: spread, halo: halo, haloRadius: haloRadius, roughHalo: roughHalo, roughBand: roughBand };
})();
