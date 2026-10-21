// FIREWALL: strategy-map decoration (continents, data packets, the satellite) and the animated title globe.
var XG = globalThis.XG = globalThis.XG || {};

XG.Backdrop = (function () {
  var REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Stylised continents in the world map's 100 × 56.25 viewBox, keyed by region id.
  var LAND = {
    na: ['6,9 13,5 24,4 32,6 34,10 30,14 28,18 25,22 22,26 19,28 17,26 14,22 10,18 6,14', '36,3 43,2.5 42,7.5 37.5,9'],
    sa: ['25,30 31,29 36,33 38,37 35,43 32,48 29,53.5 27.5,51 26.5,45 24,38 23,33'],
    eu: ['42,9.5 46,6 54,5.5 58,9 57,13 54,16.5 50,18.5 46,18 43,15', '40,8 42.5,7 42,10.5 40.2,10.5'],
    af: ['44,23 50,21 56,22 60,26 63,31 59,35 57,41 54,47 51,47.5 49,41 47,35 43,30'],
    as: ['58.5,8 66,4 78,3.5 90,6 95,10 92,14 88,18 86,23 82,26 78,28 74,31 72,33 70,28 66,25 62,22 59.5,18 58,13'],
    oc: ['78,37 85,35 90,38 91.5,43 86,47 80,46 77,42', '74,31.5 79,30.5 81,32 76,33', '93.5,45 95.5,47 94.5,50 93,48']
  };

  // opts: { H, accent ('r,g,b'), packet ('#hex'), tint(regionId) -> [colour, opacity], pos {id: [x, y]}, links, signal }
  function mapDecor(o) {
    var s = '<defs><pattern id="landdots" width="1.1" height="1.1" patternUnits="userSpaceOnUse"><circle cx=".55" cy=".55" r=".2" fill="rgba(' + o.accent + ',.35)"/></pattern>' +
      '<linearGradient id="sweepg" x1="0" x2="1"><stop offset="0" stop-color="rgba(' + o.accent + ',0)"/><stop offset="1" stop-color="rgba(' + o.accent + ',.09)"/></linearGradient></defs>';
    Object.keys(LAND).forEach(function (id) {
      var t = o.tint(id);
      LAND[id].forEach(function (pts) {
        s += '<polygon points="' + pts + '" fill="' + t[0] + '" fill-opacity="' + t[1] + '" stroke="rgba(' + o.accent + ',.22)" stroke-width=".18"/>';
        s += '<polygon points="' + pts + '" fill="url(#landdots)"/>';
      });
    });
    if (!REDUCED) {
      s += '<rect y="0" width="14" height="' + o.H + '" fill="url(#sweepg)"><animate attributeName="x" from="-14" to="100" dur="7s" repeatCount="indefinite"/></rect>';
      // packets running along each link, both ways
      o.links.forEach(function (l, i) {
        var a = o.pos[l[0]], b = o.pos[l[1]], fwd = 'M' + a[0] + ' ' + a[1] + ' L' + b[0] + ' ' + b[1], back = 'M' + b[0] + ' ' + b[1] + ' L' + a[0] + ' ' + a[1];
        s += '<circle r=".38" fill="' + o.packet + '"><animateMotion dur="' + (2.6 + (i % 3) * .7) + 's" begin="' + (i * .37) + 's" repeatCount="indefinite" path="' + fwd + '"/></circle>';
        s += '<circle r=".3" fill="' + o.packet + '" opacity=".6"><animateMotion dur="' + (3.4 + (i % 2) * .8) + 's" begin="' + (i * .53 + 1) + 's" repeatCount="indefinite" path="' + back + '"/></circle>';
      });
    }
    // the orbit and the satellite the signal came through
    var orbit = 'M 3 ' + (o.H - 3) + ' Q 50 ' + (o.H - 13) + ' 97 ' + (o.H - 3);
    s += '<path d="' + orbit + '" fill="none" stroke="rgba(' + o.accent + ',.15)" stroke-width=".2" stroke-dasharray=".6 .8"/>';
    s += '<g><rect x="-1.3" y="-.35" width="2.6" height=".7" fill="#7d8ea5"/><rect x="-.45" y="-.6" width=".9" height="1.2" fill="#cfdbe9"/>' +
      '<circle r="1.6" fill="none" stroke="' + o.signal + '" stroke-width=".2">' + (REDUCED ? '' : '<animate attributeName="r" values=".8;2.6" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.6s" repeatCount="indefinite"/>') + '</circle>' +
      (REDUCED ? '' : '<animateMotion dur="40s" repeatCount="indefinite" path="' + orbit + '"/>') + '</g>';
    return s;
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

  return { mapDecor: mapDecor, LAND: LAND, halo: halo, haloRadius: haloRadius, roughHalo: roughHalo, roughBand: roughBand };
})();
