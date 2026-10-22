// FIREWALL: procedural graphics for the tactical screen. Terrain baking, unit sprites, particles, atmosphere.
// Pure canvas drawing, no game rules and no image files. tactical-ui.js owns the battle state and calls in here.
var XG = globalThis.XG = globalThis.XG || {};

XG.Gfx = (function () {
  var TS = 40, FLOOR = 0, WALL = 1, LOW = 2, HIGH = 3, PIT = 4;
  var REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ helpers
  function hash(x, y, s) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  var rgbMemo = {};
  function rgbOf(hex) {
    if (rgbMemo[hex]) return rgbMemo[hex];
    var n = parseInt(hex.slice(1), 16);
    return (rgbMemo[hex] = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255));
  }
  function rgba(rgb, a) { return 'rgba(' + rgb + ',' + a + ')'; }
  function shade(c, d) { return 'rgb(' + Math.max(0, c[0] + d) + ',' + Math.max(0, c[1] + d) + ',' + Math.max(0, c[2] + d) + ')'; }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ------------------------------------------------------------ biomes
  var BIOMES = {
    city:   { accent: '79,209,255', floor: [16, 25, 38], roof: [27, 40, 58], roofEdge: '#30486a', facade: '#0b131e', window: '255,209,102',
              low: [37, 52, 74], stripe: '#ffd166', high: [18, 29, 46], leds: ['#4fd1ff', '#7dff9b', '#ffd166', '#ff4d6d'],
              pit: { name: 'Sinkhole', deep: '#04070b', glow: '79,150,200', glowA: .3, water: true } },
    relay:  { accent: '199,146,255', floor: [21, 18, 35], roof: [33, 26, 54], roofEdge: '#3f3266', facade: '#100b1c', window: '199,146,255',
              low: [44, 36, 66], stripe: '#c792ff', high: [23, 18, 48], leds: ['#c792ff', '#ff3df2', '#4fd1ff'], veins: '199,146,255',
              pit: { name: 'Lattice chasm', deep: '#07040d', glow: '199,146,255', glowA: .5 } },
    uplink: { accent: '255,42,85', floor: [27, 15, 21], roof: [42, 21, 32], roofEdge: '#4d2335', facade: '#13090f', window: '255,77,109',
              low: [58, 30, 42], stripe: '#ff2a55', high: [31, 15, 24], leds: ['#ff2a55', '#ff3df2', '#ffd166'], veins: '255,42,85',
              pit: { name: 'Coolant breach', deep: '#0b0306', glow: '255,42,85', glowA: .55 } },
    cyber:  { accent: '79,209,255', floor: [3, 7, 14], roof: [8, 26, 40], roofEdge: '#4fd1ff', facade: '#04101a', window: '79,209,255',
              low: [10, 30, 44], stripe: '#4fd1ff', high: [6, 18, 30], leds: ['#4fd1ff', '#7dff9b'], veins: '255,61,242', cyber: true,
              pit: { name: 'Null sector', deep: '#000000', glow: '255,61,242', glowA: .25 } }
  };
  function biomeOf(b) { var m = b.mission; return m.lkind === 'breach' ? 'cyber' : m.kind === 'relay' ? 'relay' : m.kind === 'uplink' ? 'uplink' : 'city'; }

  // Per-battle graphics state lives in a WeakMap so the battle object stays clean.
  var cache = new WeakMap();
  function gs(b) {
    var s = cache.get(b);
    if (!s) { s = { tiles: null, canvas: null, dpr: 0, decals: [], leds: [], veins: null, fogKey: '', fogC: null, biome: biomeOf(b) }; cache.set(b, s); }
    return s;
  }

  // ------------------------------------------------------------ terrain
  function W_(b) { return b.W; } // each battle carries its own map size
  function H_(b) { return b.H; }
  function tileAt(b, x, y) { return x < 0 || y < 0 || x >= W_(b) || y >= H_(b) ? WALL : b.tiles[y * W_(b) + x]; }
  function solid(t) { return t === WALL || t === HIGH; }

  // Returns the baked terrain (rebuilt when tiles change; destroyed cover leaves rubble).
  function terrain(b, dpr) {
    var s = gs(b), n = W_(b) * H_(b), changed = !s.tiles || s.dpr !== dpr || s.dirty, bio = biomeOf(b);
    if (bio !== s.biome) { s.biome = bio; s.veins = null; changed = true; }
    if (s.tiles) for (var i = 0; i < n; i++) if (s.tiles[i] !== b.tiles[i]) {
      if (s.tiles[i] !== FLOOR && b.tiles[i] === FLOOR) s.decals.push({ k: s.props && s.props[i] === 'glass' ? 'shards' : 'rubble', x: i % W_(b), y: Math.floor(i / W_(b)), was: s.tiles[i], seed: i });
      changed = true;
    }
    if (changed) { s.tiles = b.tiles.slice(); s.props = b.props ? b.props.slice() : null; s.dpr = dpr; s.dirty = false; bake(b, s, dpr); }
    return s;
  }
  function decal(b, k, x, y, size) { var s = gs(b); s.decals.push({ k: k, x: x, y: y, size: size || 1, seed: s.decals.length * 7 + x * 31 + y }); s.dirty = true; }

  function bake(b, s, dpr) {
    var W = W_(b), H = H_(b), B = BIOMES[s.biome];
    if (!s.canvas) s.canvas = document.createElement('canvas');
    s.canvas.width = W * TS * dpr; s.canvas.height = H * TS * dpr;
    var c = s.canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.leds = [];
    var x, y, t;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) floorTile(c, B, b, x, y);
    if (!s.veins) s.veins = makeVeins(b, B);
    if (B.veins) s.veins.forEach(function (v) { strokePath(c, v, rgba(B.veins, .16), 1.6); });
    // ambient occlusion along solid edges
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (tileAt(b, x, y) !== WALL) aoTile(c, b, x, y);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (tileAt(b, x, y) === PIT && propAt(b, x, y) !== 'fence') pitTile(c, B, b, x, y);
    // cast shadows (light from the upper left), drawn once on a mask so overlaps don't stack
    var sh = document.createElement('canvas'); sh.width = s.canvas.width; sh.height = s.canvas.height;
    var sc = sh.getContext('2d'); sc.setTransform(dpr, 0, 0, dpr, 0, 0); sc.fillStyle = '#000';
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      t = tileAt(b, x, y);
      if (t === WALL) sc.fillRect(x * TS + 9, y * TS + 9, TS, TS);
      else if (t === HIGH) sc.fillRect(x * TS + 12, y * TS + 10, TS - 10, TS - 8);
      else if (t === LOW) sc.fillRect(x * TS + 7, y * TS + 20, TS - 6, TS - 18);
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = B.cyber ? .5 : .42; c.drawImage(sh, 0, 0); c.restore();
    s.decals.forEach(function (d) { drawDecal(c, B, d); });
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      t = tileAt(b, x, y);
      var pv = propAt(b, x, y);
      if (pv && t !== PIT) propTile(c, B, b, x, y, pv, s.leds);
      else if (t === LOW) lowCover(c, B, b, x, y);
      else if (t === HIGH) highCover(c, B, b, x, y, s.leds);
    }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (propAt(b, x, y) === 'fence' && tileAt(b, x, y) === PIT) fenceTile(c, B, b, x, y);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (tileAt(b, x, y) === WALL) wallTile(c, B, b, x, y, s.leds);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (tileAt(b, x, y) === FLOOR) doorTile(c, B, b, x, y);
  }

  function floorTile(c, B, b, x, y) {
    var px = x * TS, py = y * TS, zone = Math.floor(hash(x >> 2, y >> 2, 9) * 3) - 1, v = Math.round((hash(x, y, 1) - .5) * 6) + zone * 3;
    c.fillStyle = shade(B.floor, v); c.fillRect(px, py, TS, TS);
    var d = hash(x, y, 2);
    if (B.cyber) {
      c.strokeStyle = rgba(B.accent, .13); c.lineWidth = 1; c.strokeRect(px + .5, py + .5, TS - 1, TS - 1);
      c.fillStyle = rgba(B.accent, .35); c.fillRect(px - 1, py - 1, 2, 2);
      if (d < .12) { c.fillStyle = rgba(B.accent, .07); c.font = '9px "Share Tech Mono", monospace'; c.fillText(hash(x, y, 3) < .5 ? '01' : '10', px + 6, py + 16); c.fillText(hash(x, y, 4) < .5 ? '110' : '011', px + 14, py + 32); }
      else if (d < .2) { c.fillStyle = rgba(B.accent, .05); c.fillRect(px + 2, py + 2, TS - 4, TS - 4); }
      return;
    }
    // plate seams and bevel
    c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(px, py, TS, 1); c.fillRect(px, py, 1, TS);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(px, py + TS - 1, TS, 1); c.fillRect(px + TS - 1, py, 1, TS);
    if (hash(x, y, 5) < .35) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(px + TS / 2, py + 2, 1, TS - 4); }
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1;
    if (d < .06) { // grate
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(px + 8, py + 8, TS - 16, TS - 16);
      c.strokeStyle = 'rgba(120,150,190,.12)'; c.beginPath();
      for (var g = 11; g < TS - 8; g += 4) { c.moveTo(px + 9, py + g + .5); c.lineTo(px + TS - 9, py + g + .5); }
      c.stroke();
    } else if (d < .12) { // crack
      c.strokeStyle = 'rgba(0,0,0,.55)'; c.beginPath();
      var cx = px + 6 + hash(x, y, 6) * 10, cy = py + 6 + hash(x, y, 7) * 10; c.moveTo(cx, cy);
      for (var k = 0; k < 4; k++) { cx += 4 + hash(x, y, 10 + k) * 6; cy += (hash(x, y, 20 + k) - .3) * 9; c.lineTo(cx, cy); }
      c.stroke();
    } else if (d < .17) { // stain
      var gr = c.createRadialGradient(px + 20, py + 22, 1, px + 20, py + 22, 15);
      gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(px, py, TS, TS);
    } else if (d < .21) { // bolted hatch
      c.strokeStyle = 'rgba(140,170,210,.09)'; c.strokeRect(px + 7.5, py + 7.5, TS - 15, TS - 15);
      c.fillStyle = 'rgba(140,170,210,.14)'; [[10, 10], [TS - 11, 10], [10, TS - 11], [TS - 11, TS - 11]].forEach(function (o) { c.fillRect(px + o[0], py + o[1], 1.5, 1.5); });
    } else if (d < .235) { // painted marking
      c.fillStyle = rgba(rgbOf(B.stripe), .1); c.fillRect(px + 4, py + 17, TS - 8, 6);
    }
  }
  function aoTile(c, b, x, y) {
    var px = x * TS, py = y * TS;
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (o) {
      if (!solid(tileAt(b, x + o[0], y + o[1]))) return;
      var g, L = 9;
      if (o[1] === -1) g = c.createLinearGradient(0, py, 0, py + L);
      else if (o[1] === 1) g = c.createLinearGradient(0, py + TS, 0, py + TS - L);
      else if (o[0] === -1) g = c.createLinearGradient(px, 0, px + L, 0);
      else g = c.createLinearGradient(px + TS, 0, px + TS - L, 0);
      g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(px, py, TS, TS);
    });
  }
  // 3/4 view: a roof, plus a facade wherever the wall's south side faces open ground.
  function wallTile(c, B, b, x, y, leds) {
    var px = x * TS, py = y * TS, south = tileAt(b, x, y + 1) !== WALL, north = tileAt(b, x, y - 1) !== WALL;
    var west = tileAt(b, x - 1, y) !== WALL, east = tileAt(b, x + 1, y) !== WALL, FH = south ? 12 : 0;
    var roofH = TS - FH, v = Math.round((hash(x, y, 30) - .5) * 4);
    if (B.cyber) {
      c.fillStyle = 'rgba(8,30,48,.92)'; c.fillRect(px, py, TS, roofH);
      c.fillStyle = rgba(B.accent, .06); c.fillRect(px + 3, py + 3, TS - 6, roofH - 6);
      c.strokeStyle = rgba(B.accent, .7); c.lineWidth = 1.2; c.beginPath();
      if (north) { c.moveTo(px, py + .6); c.lineTo(px + TS, py + .6); }
      if (west) { c.moveTo(px + .6, py); c.lineTo(px + .6, py + roofH); }
      if (east) { c.moveTo(px + TS - .6, py); c.lineTo(px + TS - .6, py + roofH); }
      c.stroke();
      if (hash(x, y, 31) < .4) { c.strokeStyle = rgba(B.accent, .22); c.beginPath(); c.moveTo(px + 8, py + 10); c.lineTo(px + 20, py + 10); c.lineTo(px + 26, py + 18); c.stroke(); }
      if (south) {
        c.fillStyle = '#04121e'; c.fillRect(px, py + roofH, TS, FH);
        c.fillStyle = rgba(B.accent, .45); c.font = '8px "Share Tech Mono", monospace';
        c.fillText(((hash(x, y, 32) * 255) | 0).toString(2).padStart(8, '0').slice(0, 6), px + 3, py + TS - 3);
        c.fillStyle = rgba(B.accent, .8); c.fillRect(px, py + roofH, TS, 1);
      }
      return;
    }
    var rg = c.createLinearGradient(px, py, px + TS, py + TS);
    rg.addColorStop(0, shade(B.roof, 10 + v)); rg.addColorStop(1, shade(B.roof, -4 + v));
    c.fillStyle = rg; c.fillRect(px, py, TS, roofH);
    c.fillStyle = B.roofEdge;
    if (north) c.fillRect(px, py, TS, 2);
    if (west) c.fillRect(px, py, 2, roofH);
    c.fillStyle = 'rgba(0,0,0,.35)';
    if (east) c.fillRect(px + TS - 2, py, 2, roofH);
    var d = hash(x, y, 33);
    if (d < .14) { // AC unit
      c.fillStyle = shade(B.roof, 18); c.fillRect(px + 9, py + 7, 20, 15);
      c.strokeStyle = 'rgba(0,0,0,.4)'; circle(c, px + 19, py + 14.5, 5); c.stroke();
      c.beginPath(); c.moveTo(px + 14, py + 14.5); c.lineTo(px + 24, py + 14.5); c.moveTo(px + 19, py + 9.5); c.lineTo(px + 19, py + 19.5); c.stroke();
    } else if (d < .24) { // vents
      c.fillStyle = 'rgba(0,0,0,.3)'; for (var k = 0; k < 3; k++) c.fillRect(px + 8, py + 8 + k * 5, 16, 2);
    } else if (d < .3) { // antenna with a red beacon
      c.strokeStyle = shade(B.roof, 40); c.beginPath(); c.moveTo(px + 26, py + 22); c.lineTo(px + 26, py + 8); c.stroke();
      leds.push({ x: px + 25, y: py + 6, c: '#ff4d6d', p: hash(x, y, 34) * 6, slow: true });
    } else if (d < .36) { // skylight
      c.fillStyle = rgba(B.window, .12); c.fillRect(px + 10, py + 9, 18, 12); c.strokeStyle = 'rgba(0,0,0,.4)'; c.strokeRect(px + 10.5, py + 9.5, 17, 11);
    }
    if (south) {
      var fg = c.createLinearGradient(0, py + roofH, 0, py + TS);
      fg.addColorStop(0, '#05090f'); fg.addColorStop(.15, B.facade); fg.addColorStop(1, shade(B.roof, -10));
      c.fillStyle = fg; c.fillRect(px, py + roofH, TS, FH);
      for (var wi = 0; wi < 4; wi++) {
        var lit = hash(x * 4 + wi, y, 35);
        c.fillStyle = lit < .3 ? rgba(B.window, .55) : lit < .45 ? rgba(B.accent, .3) : 'rgba(0,0,0,.45)';
        c.fillRect(px + 3 + wi * 9.5, py + roofH + 4, 6, 4);
      }
    }
  }
  // A hole in the ground (impassable, no cover): dark depths lit faintly from below, the far wall visible in 3/4 view,
  // a ragged lip where it meets the floor. Cyber: a void with grid lines falling away into it.
  function pitTile(c, B, b, x, y) {
    var px = x * TS, py = y * TS, P = B.pit, open = function (dx, dy) { return tileAt(b, x + dx, y + dy) !== PIT || propAt(b, x + dx, y + dy) === 'fence'; };
    var n = open(0, -1), s = open(0, 1), w = open(-1, 0), e = open(1, 0);
    c.fillStyle = P.deep; c.fillRect(px, py, TS, TS);
    var g = c.createRadialGradient(px + TS / 2, py + TS * .7, 2, px + TS / 2, py + TS * .7, TS * .8);
    g.addColorStop(0, rgba(P.glow, P.glowA)); g.addColorStop(1, rgba(P.glow, 0));
    c.fillStyle = g; c.fillRect(px, py, TS, TS);
    if (B.cyber) { // grid lines falling away into the void
      for (var k = 1; k <= 3; k++) {
        c.strokeStyle = rgba(B.accent, .45 / k); var ins = k * 5;
        c.strokeRect(px + (w ? ins : 0) + .5, py + (n ? ins : 0) + .5, TS - (w ? ins : 0) - (e ? ins : 0) - 1, TS - (n ? ins : 0) - (s ? ins : 0) - 1);
      }
      c.fillStyle = rgba(B.accent, .95);
      if (n) c.fillRect(px, py, TS, 2); if (s) c.fillRect(px, py + TS - 2, TS, 2); if (w) c.fillRect(px, py, 2, TS); if (e) c.fillRect(px + TS - 2, py, 2, TS);
      return;
    }
    if (P.water) { // flooded at the bottom: a few glints on dark water
      c.fillStyle = rgba(P.glow, .35);
      for (var r = 0; r < 3; r++) c.fillRect(px + 6 + hash(x, y, 60 + r) * 20, py + 22 + r * 5, 6 + hash(x, y, 63 + r) * 8, 1);
    }
    if (n) { // the far wall of the hole, seen from above at an angle, with rock/concrete strata
      var fg = c.createLinearGradient(0, py, 0, py + 18);
      fg.addColorStop(0, shade(B.floor, 30)); fg.addColorStop(1, P.deep);
      c.fillStyle = fg; c.fillRect(px, py, TS, 18);
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(px, py + 6, TS, 1); c.fillRect(px, py + 12, TS, 1);
      if (hash(x, y, 70) < .5) { c.strokeStyle = 'rgba(170,140,110,.55)'; c.beginPath(); c.moveTo(px + 8 + hash(x, y, 71) * 20, py + 2); c.lineTo(px + 12 + hash(x, y, 72) * 20, py + 15); c.stroke(); } // rebar
    }
    [[w, px, 1], [e, px + TS - 5, -1]].forEach(function (sd) { // side walls, in shade
      if (!sd[0]) return;
      var sg = c.createLinearGradient(sd[1] + (sd[2] < 0 ? 5 : 0), 0, sd[1] + (sd[2] < 0 ? 0 : 5), 0);
      sg.addColorStop(0, shade(B.floor, 14)); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg; c.fillRect(sd[1], py, 5, TS);
    });
    // ragged lip: chunks of floor breaking off into the hole, edged in light
    c.fillStyle = shade(B.floor, 26);
    [[n, 0, -1], [s, 0, 1], [w, -1, 0], [e, 1, 0]].forEach(function (sd, si) {
      if (!sd[0]) return;
      for (var i = 0; i < 4; i++) {
        var u = (i + .2 + hash(x * 4 + i, y, 73 + si) * .6) * TS / 4, d = 2 + hash(x, y * 4 + i, 77 + si) * 4;
        var ax = sd[1] ? (sd[1] < 0 ? px : px + TS) : px + u, ay = sd[2] ? (sd[2] < 0 ? py : py + TS) : py + u;
        c.beginPath();
        if (sd[1]) { c.moveTo(ax, ay - 4); c.lineTo(ax - sd[1] * d, ay); c.lineTo(ax, ay + 4); }
        else { c.moveTo(ax - 4, ay); c.lineTo(ax, ay - sd[2] * d); c.lineTo(ax + 4, ay); }
        c.fill();
      }
    });
    c.fillStyle = shade(B.floor, 44);
    if (n) c.fillRect(px, py, TS, 2); if (w) c.fillRect(px, py, 2, TS); if (e) c.fillRect(px + TS - 2, py, 2, TS);
    c.fillStyle = 'rgba(255,255,255,.2)';
    if (s) c.fillRect(px, py + TS - 2, TS, 2); // the near lip catches the light
    if (n) { // caution tape strung along the far edge
      c.fillStyle = rgba(rgbOf(B.stripe), .8);
      for (var t2 = 0; t2 < 4; t2++) c.fillRect(px + 1 + t2 * 10, py - 4, 5, 3);
      c.fillStyle = 'rgba(0,0,0,.6)';
      for (var t3 = 0; t3 < 4; t3++) c.fillRect(px + 6 + t3 * 10, py - 4, 5, 3);
    }
  }
  function lowCover(c, B, b, x, y) {
    var px = x * TS, py = y * TS, jl = tileAt(b, x - 1, y) === LOW, jr = tileAt(b, x + 1, y) === LOW;
    var x0 = px + (jl ? 0 : 3), x1 = px + TS - (jr ? 0 : 3), top = py + 13, frontY = py + 21, bot = py + TS - 6;
    if (B.cyber) { // firewall pane: glowing bars between emitters
      c.fillStyle = rgba(B.accent, .07); c.fillRect(x0, top, x1 - x0, bot - top);
      c.fillStyle = rgba(B.accent, .75); c.fillRect(x0, top + 4, x1 - x0, 1.5); c.fillRect(x0, top + 12, x1 - x0, 1.5);
      c.fillStyle = rgba(B.accent, .3); c.fillRect(x0, top + 8, x1 - x0, 1);
      c.fillStyle = '#0c2a3e';
      if (!jl) c.fillRect(x0 - 1, top, 4, bot - top);
      if (!jr) c.fillRect(x1 - 3, top, 4, bot - top);
      return;
    }
    var crate = hash(x, y, 40) < .45;
    c.fillStyle = shade(B.low, 14); c.fillRect(x0, top, x1 - x0, frontY - top);
    c.fillStyle = shade(B.low, -6); c.fillRect(x0, frontY, x1 - x0, bot - frontY);
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x0, top, x1 - x0, 1);
    if (crate) {
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0 + 2, frontY + 1); c.lineTo(x1 - 2, bot - 1); c.moveTo(x1 - 2, frontY + 1); c.lineTo(x0 + 2, bot - 1); c.stroke();
      c.strokeRect(x0 + .5, top + .5, x1 - x0 - 1, bot - top - 1);
    } else { // barrier with hazard stripes
      c.save(); c.beginPath(); c.rect(x0, frontY + 3, x1 - x0, 5); c.clip();
      c.fillStyle = rgba(rgbOf(B.stripe), .55);
      for (var sx = x0 - 10; sx < x1 + 10; sx += 8) { c.beginPath(); c.moveTo(sx, frontY + 8); c.lineTo(sx + 4, frontY + 3); c.lineTo(sx + 8, frontY + 3); c.lineTo(sx + 4, frontY + 8); c.fill(); }
      c.restore();
    }
    c.fillStyle = rgba(B.accent, .3); c.fillRect(x0, bot - 1, x1 - x0, 1);
  }
  function highCover(c, B, b, x, y, leds) {
    var px = x * TS, py = y * TS, x0 = px + 6, x1 = px + TS - 6, top = py + 1, frontY = py + 11, bot = py + TS - 4;
    if (B.cyber) { // data monolith
      c.fillStyle = '#041626'; c.fillRect(x0, top, x1 - x0, bot - top);
      c.strokeStyle = rgba(B.accent, .85); c.lineWidth = 1; c.strokeRect(x0 + .5, top + .5, x1 - x0 - 1, bot - top - 1);
      c.fillStyle = rgba(B.accent, .2); c.fillRect(x0, top, x1 - x0, frontY - top);
      for (var i = 0; i < 4; i++) leds.push({ x: x0 + 5 + (i % 2) * 14, y: frontY + 5 + Math.floor(i / 2) * 9, c: pick(B.leds), p: hash(x * 7 + i, y, 41) * 6, w: 8, h: 2 });
      return;
    }
    var rack = hash(x, y, 42) < .6;
    c.fillStyle = shade(B.high, 22); c.fillRect(x0, top, x1 - x0, frontY - top);
    c.fillStyle = shade(B.high, 0); c.fillRect(x0, frontY, x1 - x0, bot - frontY);
    c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x0, top, x1 - x0, 1);
    c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x1 - 1, top, 1, bot - top);
    if (rack) { // server rack: slots and status LEDs
      for (var r = 0; r < 5; r++) {
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x0 + 3, frontY + 3 + r * 5, x1 - x0 - 6, 3);
        if (hash(x, y * 5 + r, 43) < .8) leds.push({ x: x0 + 4 + Math.floor(hash(x, y + r, 44) * 3) * 3, y: frontY + 4 + r * 5, c: pick(B.leds), p: hash(x + r, y, 45) * 6 });
      }
      c.fillStyle = rgba(B.accent, .18); c.fillRect(x0 + 3, top + 3, x1 - x0 - 6, 2);
    } else { // shipping container: ribs and a stencil stripe
      c.fillStyle = 'rgba(0,0,0,.3)'; for (var k = x0 + 3; k < x1 - 2; k += 4) c.fillRect(k, frontY + 2, 1.5, bot - frontY - 4);
      c.fillStyle = rgba(rgbOf(B.stripe), .35); c.fillRect(x0, frontY + 9, x1 - x0, 3);
    }
  }
  // ---- obstacle variants (b.props): drawn over their base tile code. See DATA.props for the rules.
  function propAt(b, x, y) { return b.props && x >= 0 && y >= 0 && x < W_(b) && y < H_(b) ? b.props[y * W_(b) + x] || 0 : 0; }
  // Hazard stripes (yellow on black) clipped to a rectangle.
  function hazard(c, x0, y0, w, h) {
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    c.fillStyle = '#16140c'; c.fillRect(x0, y0, w, h); c.fillStyle = '#ffd166';
    for (var sx = x0 - h; sx < x0 + w + h; sx += 7) { c.beginPath(); c.moveTo(sx, y0 + h); c.lineTo(sx + h, y0); c.lineTo(sx + h + 3.5, y0); c.lineTo(sx + 3.5, y0 + h); c.fill(); }
    c.restore();
  }
  // Fuel barrel / coolant tank / unstable packet: red or steel drum with hazard banding, a warning sign and a blinking beacon.
  function barrelTile(c, B, b, x, y, leds) {
    var px = x * TS, py = y * TS, cx = px + TS / 2, cyb = B.cyber, tank = B.veins && !cyb;
    leds.push({ x: cx - 1.5, y: py + 4, c: '#ff4d6d', p: hash(x, y, 80) * 6, w: 3, h: 3, slow: true });
    if (cyb) { // a jittering red-magenta data cube with a warning glyph
      c.fillStyle = 'rgba(255,61,110,.18)'; c.fillRect(px + 7, py + 8, TS - 14, TS - 14);
      c.strokeStyle = '#ff3d6e'; c.lineWidth = 2; c.strokeRect(px + 9, py + 10, TS - 18, TS - 18);
      c.strokeStyle = 'rgba(255,61,242,.8)'; c.lineWidth = 1; c.strokeRect(px + 12, py + 7, TS - 18, TS - 18);
      c.beginPath(); c.moveTo(px + 9, py + 10); c.lineTo(px + 12, py + 7); c.moveTo(px + TS - 9, py + 10); c.lineTo(px + TS - 6, py + 7); c.moveTo(px + TS - 9, py + TS - 8); c.lineTo(px + TS - 6, py + TS - 11); c.stroke();
      c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(cx, py + 14); c.lineTo(cx + 8, py + 28); c.lineTo(cx - 8, py + 28); c.closePath(); c.fill();
      c.fillStyle = '#16140c'; c.fillRect(cx - 1, py + 18, 2, 5); c.fillRect(cx - 1, py + 24, 2, 2);
      c.fillStyle = 'rgba(255,61,110,.7)'; for (var j = 0; j < 5; j++) c.fillRect(px + 8 + hash(x, y, 81 + j) * 22, py + 33 + hash(x, y, 86 + j) * 3, 4 + hash(x, y, 91 + j) * 6, 1.5);
      return;
    }
    var dark = tank ? '#1d4a63' : '#7a1f19', mid = tank ? '#3b86a8' : '#c0392b', hi = tank ? '#7fd0ea' : '#e8705c';
    var x0 = px + 9, x1 = px + TS - 9, top = py + 9, bot = py + TS - 5;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx + 2, bot + 1, 14, 4.5, 0, 0, Math.PI * 2); c.fill();
    var g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, dark); g.addColorStop(.35, hi); g.addColorStop(.6, mid); g.addColorStop(1, dark);
    c.fillStyle = g; c.fillRect(x0, top + 4, x1 - x0, bot - top - 4);
    c.beginPath(); c.ellipse(cx, bot, (x1 - x0) / 2, 4, 0, 0, Math.PI); c.fill();
    c.fillStyle = hi; c.beginPath(); c.ellipse(cx, top + 4, (x1 - x0) / 2, 4.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = dark; c.beginPath(); c.ellipse(cx, top + 4, 4.5, 2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x0, top + 9, x1 - x0, 1.5); c.fillRect(x0, bot - 4, x1 - x0, 1.5);
    hazard(c, x0, top + 12, x1 - x0, 6);
    c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(cx, top + 19); c.lineTo(cx + 5, top + 27); c.lineTo(cx - 5, top + 27); c.closePath(); c.fill();
    c.fillStyle = '#16140c'; c.fillRect(cx - .8, top + 21, 1.6, 3); c.fillRect(cx - .8, top + 25, 1.6, 1.4);
    if (tank) { c.fillStyle = rgba(B.accent, .9); c.fillRect(x1 - 6, top + 7, 3, 3); }
  }
  // Concrete barrier / armored bulkhead / hardened block: pale solid blocks that join into a wall. Blast-proof.
  function barrierTile(c, B, b, x, y) {
    var px = x * TS, py = y * TS, jl = propAt(b, x - 1, y) === 'barrier', jr = propAt(b, x + 1, y) === 'barrier';
    var x0 = px + (jl ? 0 : 2), x1 = px + TS - (jr ? 0 : 2), top = py + 13, frontY = py + 20, bot = py + TS - 5;
    var face = B.cyber ? [34, 58, 76] : [112, 116, 120];
    c.fillStyle = shade(face, 40); c.fillRect(x0, top, x1 - x0, frontY - top);
    c.fillStyle = shade(face, 6); c.fillRect(x0, frontY, x1 - x0, bot - frontY);
    c.fillStyle = shade(face, -20); // the sloped foot
    c.beginPath(); c.moveTo(x0, bot); c.lineTo(x0 + (jl ? 0 : 3), bot - 5); c.lineTo(x1 - (jr ? 0 : 3), bot - 5); c.lineTo(x1, bot); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x0, top, x1 - x0, 1.5);
    c.fillStyle = 'rgba(0,0,0,.4)'; if (!jl) c.fillRect(x0, top, 1, bot - top); c.fillRect(x1 - 1, top, 1, bot - top);
    if (B.cyber) { c.strokeStyle = rgba(B.accent, .85); c.lineWidth = 1; c.strokeRect(x0 + .5, top + .5, x1 - x0 - 1, bot - top - 1); }
    else { c.fillStyle = B.veins ? rgba(B.accent, .8) : '#d8d8d0'; c.fillRect(x0 + 5, frontY + 3, x1 - x0 - 10, 2); } // reflective strip
    c.fillStyle = 'rgba(255,255,255,.5)'; // rivets: reads as heavy
    c.fillRect(x0 + 4, frontY + 8, 2, 2); c.fillRect(x1 - 6, frontY + 8, 2, 2);
  }
  // Concrete pillar / support column / anchored node: a round column that stands taller than any wall segment. Blast-proof.
  function pillarTile(c, B, b, x, y) {
    var px = x * TS, py = y * TS, cx = px + TS / 2, r = 11, top = py + 4, bot = py + TS - 5;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(cx + 2, bot + 1, r + 4, 5, 0, 0, Math.PI * 2); c.fill();
    var col = B.cyber ? [10, 40, 60] : [118, 122, 128];
    var g = c.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, shade(col, -30)); g.addColorStop(.3, shade(col, 38)); g.addColorStop(.7, shade(col, 0)); g.addColorStop(1, shade(col, -40));
    c.fillStyle = g; c.fillRect(cx - r, top + 4, r * 2, bot - top - 6);
    c.fillRect(cx - r - 3, bot - 5, r * 2 + 6, 6); // plinth
    c.beginPath(); c.ellipse(cx, bot + 1, r + 3, 3, 0, 0, Math.PI); c.fill();
    c.fillStyle = shade(col, 52); c.beginPath(); c.ellipse(cx, top + 4, r, 4.5, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(cx - r - 3, top + 5, r * 2 + 6, 3);
    c.fillStyle = shade(col, -50); c.beginPath(); c.ellipse(cx, top + 4, r - 4, 2, 0, 0, Math.PI * 2); c.fill();
    if (B.veins || B.cyber) { c.fillStyle = rgba(B.accent, .9); c.fillRect(cx - r, top + 14, r * 2, 2); c.fillRect(cx - r, top + 22, r * 2, 2); }
    else { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(cx - r, top + 15, r * 2, 1); c.fillRect(cx - r, top + 24, r * 2, 1); }
  }
  // Glass panel / crystal panel / soft firewall: a framed translucent pane with sheen. Full cover until a shot at it misses.
  function glassTile(c, B, b, x, y) {
    var px = x * TS, py = y * TS, jl = propAt(b, x - 1, y) === 'glass', jr = propAt(b, x + 1, y) === 'glass';
    var x0 = px + (jl ? 0 : 3), x1 = px + TS - (jr ? 0 : 3), top = py + 5, bot = py + TS - 5, w = x1 - x0;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x0 + 2, bot, w, 3);
    var tint = B.cyber ? '255,61,242' : B.veins ? '199,230,255' : '170,225,255';
    c.fillStyle = 'rgba(' + tint + ',.30)'; c.fillRect(x0, top, w, bot - top);
    c.save(); c.beginPath(); c.rect(x0, top, w, bot - top); c.clip();
    c.fillStyle = 'rgba(255,255,255,.28)';
    for (var s = x0 - 30; s < x1; s += 22) { c.beginPath(); c.moveTo(s + 30, top); c.lineTo(s + 38, top); c.lineTo(s + 8, bot); c.lineTo(s, bot); c.fill(); }
    if (B.cyber) { c.fillStyle = 'rgba(255,61,242,.5)'; for (var yy = top + 3; yy < bot; yy += 5) for (var xx = x0 + 2 + (yy % 2) * 2; xx < x1; xx += 5) c.fillRect(xx, yy, 1.5, 1.5); }
    c.restore();
    c.fillStyle = '#c5d6e8'; c.fillRect(x0, top - 2, w, 3); c.fillRect(x0, bot - 1, w, 3); // frame rails
    if (!jl) c.fillRect(x0, top - 2, 3, bot - top + 4);
    if (!jr) c.fillRect(x1 - 3, top - 2, 3, bot - top + 4);
    c.strokeStyle = 'rgba(' + tint + ',.9)'; c.lineWidth = 1; c.strokeRect(x0 + .5, top + .5, w - 1, bot - top - 1);
  }
  // Chain-link fence / laser fence / filter gate: upright, thin, impassable but see-through. Runs connect along their axis.
  function fenceTile(c, B, b, x, y) {
    var px = x * TS, py = y * TS, f = function (dx, dy) { return propAt(b, x + dx, y + dy) === 'fence'; };
    var vert = (f(0, -1) || f(0, 1)) && !(f(-1, 0) || f(1, 0)), beam = B.veins || B.cyber, bc = B.cyber ? '79,209,255' : B.accent;
    var cx = px + TS / 2, base = py + TS - 8, Hh = 22, k;
    if (vert) { // seen end-on: a narrow mesh band the length of the tile, capped by a rail and posts
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(cx - 2, py, 6, TS);
      if (beam) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba(bc, .25); c.fillRect(cx - 4, py, 8, TS); c.fillStyle = rgba(bc, .95); c.fillRect(cx - 1, py, 2, TS); c.restore(); }
      else {
        c.fillStyle = 'rgba(200,215,230,.16)'; c.fillRect(cx - 3, py, 6, TS);
        c.strokeStyle = 'rgba(215,225,238,.7)'; c.lineWidth = 1; c.beginPath();
        for (k = 0; k < TS; k += 5) { c.moveTo(cx - 3, py + k); c.lineTo(cx + 3, py + k + 5); c.moveTo(cx + 3, py + k); c.lineTo(cx - 3, py + k + 5); }
        c.stroke(); c.fillStyle = '#b4bfcc'; c.fillRect(cx - 3, py, 1.5, TS); c.fillRect(cx + 1.5, py, 1.5, TS);
      }
      c.fillStyle = beam ? '#26364a' : '#8c97a6'; c.fillRect(cx - 3, py + TS / 2 - 3, 6, 6);
      c.fillStyle = beam ? rgba(bc, 1) : '#e1e8f0'; c.fillRect(cx - 1.5, py + TS / 2 - 1.5, 3, 3);
      return;
    }
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(px, base, TS, 3);
    if (beam) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (k = 0; k < 3; k++) {
        var by = base - 3 - k * 7;
        c.fillStyle = rgba(bc, .22); c.fillRect(px, by - 2, TS, 5);
        c.fillStyle = rgba(bc, .95); c.fillRect(px, by - .5, TS, 1.5);
      }
      c.restore();
    } else {
      c.fillStyle = 'rgba(200,215,230,.14)'; c.fillRect(px, base - Hh, TS, Hh);
      c.strokeStyle = 'rgba(215,225,238,.7)'; c.lineWidth = 1; c.beginPath();
      for (k = 0; k < TS; k += 5) { c.moveTo(px + k, base - Hh); c.lineTo(px + k + 5, base); c.moveTo(px + k + 5, base - Hh); c.lineTo(px + k, base); }
      c.stroke(); c.fillStyle = '#b4bfcc'; c.fillRect(px, base - Hh - 1, TS, 2);
    }
    c.fillStyle = beam ? '#26364a' : '#8c97a6'; c.fillRect(cx - 2, base - Hh - 2, 4, Hh + 3);
    c.fillStyle = beam ? rgba(bc, 1) : '#e1e8f0'; c.fillRect(cx - 2, base - Hh - 3, 4, 2);
  }
  // Mixed-side cover objects (b.faces mask: bit 1 N, 2 E, 4 S, 8 W; set = full/tall face, clear = half/low face). Same visual language
  // everywhere: a thick bright raised wall = full cover from that side, a thin dotted rim = half cover. The pad inside says what it is:
  // bunker (dark pad), stack (crate top), vehicle (roof, windshield, lights), planter (soil and plants), plate (hazard-striped concrete).
  var FACE_WALL = { bunker: [150, 160, 172], stack: [166, 128, 78], vehicle: [138, 150, 164], planter: [108, 134, 98], plate: [160, 164, 170] };
  function faceObject(c, B, b, x, y, p) {
    var px = x * TS, py = y * TS, m = b.faces && b.faces[y * W_(b) + x] || 0, cy = B.cyber, acc = cy || B.veins ? B.accent : '255,209,102';
    var jl = propAt(b, x - 1, y) === p, jr = propAt(b, x + 1, y) === p, ju = propAt(b, x, y - 1) === p, jd = propAt(b, x, y + 1) === p, T = 10;
    var x0 = px + (jl ? 0 : 3), x1 = px + TS - (jr ? 0 : 3), y0 = py + (ju ? 0 : 4), y1 = py + TS - (jd ? 0 : 4), w = x1 - x0, h = y1 - y0, i, k;
    var wall = cy ? [24, 80, 110] : B.veins ? [100, 88, 142] : FACE_WALL[p];
    c.fillStyle = 'rgba(0,0,0,.35)'; if (!jd) c.fillRect(x0 + 2, y1, w, 3);
    // the pad
    if (p === 'stack') {
      c.fillStyle = cy ? '#0b3550' : shade(B.low, 24); c.fillRect(x0, y0, w, h);
      c.strokeStyle = cy ? rgba(B.accent, .35) : 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0 + 3, y0 + 3); c.lineTo(x1 - 3, y1 - 3); c.moveTo(x1 - 3, y0 + 3); c.lineTo(x0 + 3, y1 - 3); c.stroke();
    } else if (p === 'vehicle') {
      c.fillStyle = cy ? '#0d3a55' : shade(B.high, 36); c.fillRect(x0, y0, w, h);
      var horiz = jl || jr || !(ju || jd);
      c.fillStyle = 'rgba(0,0,0,.25)'; if (horiz) c.fillRect(x0 + (jl ? 0 : 6), y0 + h / 2 - 1, w - (jl ? 0 : 6) - (jr ? 0 : 6), 2); else c.fillRect(x0 + w / 2 - 1, y0 + (ju ? 0 : 6), 2, h - (ju ? 0 : 6) - (jd ? 0 : 6));
      if (horiz && !jl) { c.fillStyle = 'rgba(150,215,255,.75)'; c.fillRect(x0 + 5, y0 + 7, 5, h - 14); c.fillStyle = '#ffe9a0'; c.fillRect(x0 + 1, y0 + 6, 2, 3); c.fillRect(x0 + 1, y1 - 9, 2, 3); }
      if (horiz && !jr) { c.fillStyle = '#ff4d6d'; c.fillRect(x1 - 3, y0 + 6, 2, 3); c.fillRect(x1 - 3, y1 - 9, 2, 3); }
      if (!horiz && !ju) { c.fillStyle = 'rgba(150,215,255,.75)'; c.fillRect(x0 + 7, y0 + 5, w - 14, 5); c.fillStyle = '#ffe9a0'; c.fillRect(x0 + 6, y0 + 1, 3, 2); c.fillRect(x1 - 9, y0 + 1, 3, 2); }
      if (!horiz && !jd) { c.fillStyle = '#ff4d6d'; c.fillRect(x0 + 6, y1 - 3, 3, 2); c.fillRect(x1 - 9, y1 - 3, 3, 2); }
    } else if (p === 'planter') {
      c.fillStyle = cy ? '#06283a' : '#3a2c20'; c.fillRect(x0, y0, w, h);
      for (i = 0; i < 7; i++) {
        var gx = x0 + 5 + hash(x * 9 + i, y, 100) * (w - 10), gy = y0 + 5 + hash(x, y * 9 + i, 101) * (h - 10);
        c.fillStyle = cy ? rgba(B.accent, .8) : B.veins ? '#b36cff' : i % 2 ? '#4fa05a' : '#6fcf7a';
        if (cy) c.fillRect(gx, gy, 3, 3); else { c.beginPath(); c.arc(gx, gy, 3 + hash(x + i, y, 102) * 2, 0, 6.3); c.fill(); }
      }
    } else if (p === 'plate') {
      c.fillStyle = cy ? '#0a2a40' : '#64686e'; c.fillRect(x0, y0, w, h);
      hazard(c, x0 + 3, y0 + h / 2 - 3, w - 6, 6);
    } else { c.fillStyle = cy ? '#0a2a40' : shade(B.floor, 16); c.fillRect(x0, y0, w, h); } // bunker
    var edge = function (bit, ex, ey, ew, eh, hz, front) {
      if (ew <= 0 || eh <= 0) return;
      if (m & bit) { // raised wall: thick, lit top, dark lower lip
        c.fillStyle = 'rgba(0,0,0,.45)'; if (hz) c.fillRect(ex + 2, ey + eh, ew, 3); else c.fillRect(ex + ew, ey + 2, 3, eh);
        c.fillStyle = shade(wall, 0); c.fillRect(ex, ey, ew, eh);
        c.fillStyle = shade(wall, 40); if (hz) c.fillRect(ex, ey, ew, eh - 4); else c.fillRect(ex, ey, ew - 3, eh);
        c.fillStyle = shade(wall, -60); if (hz) c.fillRect(ex, ey + eh - 3, ew, 3); else c.fillRect(ex + ew - 3, ey, 3, eh);
        c.fillStyle = rgba(acc, .9); if (hz) c.fillRect(ex, ey, ew, 1.5); else c.fillRect(ex, ey, 1.5, eh);
      } else { // low rim: thin, darker, with seams
        var bx = ex, by = ey, bw = ew, bh = eh;
        if (hz) { bh = 3; by = front ? ey + eh - 3 : ey; } else { bw = 3; bx = front ? ex + ew - 3 : ex; }
        c.fillStyle = shade(wall, -48); c.fillRect(bx, by, bw, bh);
        c.fillStyle = 'rgba(0,0,0,.5)';
        if (hz) for (k = bx + 3; k < bx + bw; k += 5) c.fillRect(k, by, 1, bh); else for (k = by + 3; k < by + bh; k += 5) c.fillRect(bx, k, bw, 1);
      }
    };
    if (!ju) edge(1, x0, y0, w, T, true, false);
    if (!jd) edge(4, x0, y1 - T, w, T, true, true);
    var wy = y0 + (ju ? 0 : T), wh = y1 - (jd ? 0 : T) - wy;
    if (!jl) edge(8, x0, wy, T, wh, false, false);
    if (!jr) edge(2, x1 - T, wy, T, wh, false, true);
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.strokeRect(x0 + .5, y0 + .5, w - 1, h - 1);
  }
  // Damaged destructible objects (b.tileHp): cracks and a small HP bar over the baked terrain, drawn every frame (cheap: few tiles).
  function damaged(c, b) {
    if (!b.tileHp) return;
    var W = W_(b), Dm = XG.Tac;
    Object.keys(b.tileHp).forEach(function (k) {
      var i = +k, x = i % W, y = Math.floor(i / W), o = Dm.objectAt(b, x, y);
      if (!o || o.hp >= o.maxHp) return;
      var px = x * TS, py = y * TS, f = o.hp / o.maxHp;
      c.save();
      c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 1.3; c.beginPath();
      for (var n = 0; n < 2 + Math.round((1 - f) * 3); n++) {
        var cx = px + 8 + hash(i, n, 110) * 24, cy = py + 10 + hash(i, n, 111) * 22;
        c.moveTo(cx, cy); c.lineTo(cx + (hash(i, n, 112) - .5) * 14, cy + 4 + hash(i, n, 113) * 7); c.lineTo(cx + (hash(i, n, 114) - .5) * 14, cy + 9 + hash(i, n, 115) * 6);
      }
      c.stroke();
      c.fillStyle = 'rgba(0,0,0,.7)'; c.fillRect(px + 6, py + 2, TS - 12, 4);
      c.fillStyle = f > .5 ? '#7dff9b' : f > .25 ? '#ffd166' : '#ff4d6d'; c.fillRect(px + 7, py + 3, (TS - 14) * f, 2);
      c.restore();
    });
  }
  function propTile(c, B, b, x, y, p, leds) {
    if (p === 'barrel') barrelTile(c, B, b, x, y, leds);
    else if (p === 'barrier') barrierTile(c, B, b, x, y);
    else if (p === 'pillar') pillarTile(c, B, b, x, y);
    else if (p === 'glass') glassTile(c, B, b, x, y);
    else if (p === 'fence') fenceTile(c, B, b, x, y);
    else if (XG.DATA.props[p] && XG.DATA.props[p].faces) faceObject(c, B, b, x, y, p);
  }
  function doorTile(c, B, b, x, y) {
    var Wm = W_(b), Hm = H_(b), wall = function (a, c2) { return a >= 0 && c2 >= 0 && a < Wm && c2 < Hm && b.tiles[c2 * Wm + a] === WALL; };
    var h = wall(x - 1, y) && wall(x + 1, y), v = wall(x, y - 1) && wall(x, y + 1);
    if (!h && !v) return;
    var px = x * TS, py = y * TS;
    c.fillStyle = rgba(B.accent, .1);
    if (h) { c.fillRect(px, py + 16, TS, 8); c.fillStyle = rgba(B.accent, .55); c.fillRect(px, py + 16, 3, 8); c.fillRect(px + TS - 3, py + 16, 3, 8); }
    else { c.fillRect(px + 16, py, 8, TS); c.fillStyle = rgba(B.accent, .55); c.fillRect(px + 16, py, 8, 3); c.fillRect(px + 16, py + TS - 3, 8, 3); }
  }
  function drawDecal(c, B, d) {
    var cx = d.x * TS + TS / 2, cy = d.y * TS + TS / 2;
    if (d.k === 'scorch') {
      var R = 15 * d.size, g = c.createRadialGradient(cx, cy, 1, cx, cy, R);
      g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(.6, 'rgba(20,10,5,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.beginPath();
      for (var k = 0; k < 7; k++) { var a = hash(d.seed, k, 50) * 6.283, l = R * (.8 + hash(d.seed, k, 51) * .6); c.moveTo(cx + Math.cos(a) * R * .3, cy + Math.sin(a) * R * .3); c.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); }
      c.stroke();
    } else if (d.k === 'rubble') {
      for (var i = 0; i < 9; i++) {
        var rx = d.x * TS + 5 + hash(d.seed, i, 52) * 30, ry = d.y * TS + 8 + hash(d.seed, i, 53) * 26, s = 2 + hash(d.seed, i, 54) * 4;
        c.fillStyle = B.cyber ? rgba(B.accent, .3) : shade(d.was === HIGH ? B.high : B.low, 10 - i * 2);
        c.beginPath(); c.moveTo(rx, ry - s); c.lineTo(rx + s, ry); c.lineTo(rx + s * .2, ry + s * .8); c.lineTo(rx - s, ry + s * .2); c.closePath(); c.fill();
      }
    } else if (d.k === 'shards') {
      for (var gi = 0; gi < 12; gi++) {
        var gx = d.x * TS + 4 + hash(d.seed, gi, 52) * 32, gy = d.y * TS + 10 + hash(d.seed, gi, 53) * 26, gs2 = 1.5 + hash(d.seed, gi, 54) * 3;
        c.fillStyle = gi % 3 ? 'rgba(190,230,255,.55)' : 'rgba(255,255,255,.7)';
        c.beginPath(); c.moveTo(gx, gy - gs2); c.lineTo(gx + gs2, gy + gs2 * .6); c.lineTo(gx - gs2 * .8, gy + gs2); c.closePath(); c.fill();
      }
    } else if (d.k === 'oil') {
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, cy + 6, 10, 5, 0, 0, Math.PI * 2); c.fill();
    }
  }
  // Lattice tendrils crawling over the ground from its relays/core (or in from the network edge).
  function makeVeins(b, B) {
    if (!B.veins) return [];
    var W = W_(b), H = H_(b), seeds = b.units.filter(function (u) { return u.isStatic; }).map(function (u) { return [u.x, u.y]; });
    var r = function (i, k) { return hash(i, k, 60 + seeds.length); };
    while (seeds.length < 3) seeds.push([W - 1 - Math.floor(r(seeds.length, 1) * 5), Math.floor(r(seeds.length, 2) * H)]);
    var veins = [];
    seeds.forEach(function (sd, si) {
      for (var v = 0; v < 3; v++) {
        var x = sd[0], y = sd[1], pts = [[x * TS + TS / 2, y * TS + TS / 2]], len = 5 + Math.floor(r(si * 3 + v, 3) * 8), last = -1;
        for (var k = 0; k < len; k++) {
          var dir = Math.floor(r(si * 40 + v * 13 + k, 4) * 4), o = [[1, 0], [-1, 0], [0, 1], [0, -1]][dir];
          if (last >= 0 && (dir ^ 1) === last) { dir = last; o = [[1, 0], [-1, 0], [0, 1], [0, -1]][dir]; } // no doubling back
          if (tileAt(b, x + o[0], y + o[1]) !== FLOOR) continue;
          last = dir;
          x += o[0]; y += o[1];
          pts.push([x * TS + 12 + r(k, si + v) * 16, y * TS + 12 + r(si + v, k) * 16]);
        }
        if (pts.length > 2) veins.push(pts);
      }
    });
    return veins;
  }
  function strokePath(c, pts, style, w) {
    c.strokeStyle = style; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    c.stroke(); c.lineWidth = 1; c.lineCap = 'butt';
  }

  // ------------------------------------------------------------ per-frame atmosphere
  function ambient(c, b, now) {
    var s = gs(b), B = BIOMES[s.biome];
    s.leds.forEach(function (l) {
      var on = REDUCED ? 1 : Math.sin(now / (l.slow ? 600 : 260) + l.p * 3) > (l.slow ? .3 : -.4);
      c.fillStyle = on ? l.c : 'rgba(0,0,0,.4)'; c.fillRect(l.x, l.y, l.w || 2, l.h || 2);
      if (on && l.slow) { c.fillStyle = 'rgba(255,77,109,.25)'; circle(c, l.x + 1, l.y + 1, 4); c.fill(); }
    });
    if (B.veins && s.veins.length && !REDUCED) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.setLineDash([6, 40]); c.lineDashOffset = -now / 25;
      s.veins.forEach(function (v) { strokePath(c, v, rgba(B.veins, .55), 2); });
      c.restore();
    }
    if (B.cyber && !REDUCED) { // slow scan band
      var Hpx = H_(b) * TS, yb = (now / 14) % (Hpx + 200) - 100, g = c.createLinearGradient(0, yb - 40, 0, yb + 40);
      g.addColorStop(0, rgba(B.accent, 0)); g.addColorStop(.5, rgba(B.accent, .05)); g.addColorStop(1, rgba(B.accent, 0));
      c.fillStyle = g; c.fillRect(0, yb - 40, W_(b) * TS, 80);
    }
  }
  function motes(c, b, now) {
    if (REDUCED) return;
    var s = gs(b), B = BIOMES[s.biome], Wp = W_(b) * TS, Hp = H_(b) * TS;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (var i = 0, n = Math.round(28 * W_(b) * H_(b) / 352); i < n; i++) { // 28 per 22x16 of map
      var sx = hash(i, 1, 70), sy = hash(i, 2, 70), vx = (hash(i, 3, 70) - .5) * .012, vy = -.004 - hash(i, 4, 70) * .01;
      var x = ((sx * Wp + now * vx) % Wp + Wp) % Wp, y = ((sy * Hp + now * vy) % Hp + Hp) % Hp;
      var a = .12 + .12 * Math.sin(now / 700 + i);
      c.fillStyle = rgba(B.veins && i % 3 === 0 ? B.veins : B.accent, a); c.fillRect(x, y, 1.6, 1.6);
    }
    c.restore();
  }
  // Soft fog: a tiny mask (3 px per tile) upscaled with smoothing, so sight edges feather.
  // In sight: clear. Explored but out of sight: dimmed. Never seen: opaque, so the map is blank until discovered.
  function fog(c, b) {
    var s = gs(b), W = W_(b), H = H_(b), key = '';
    var ex = b.explored || b.visible;
    for (var i = 0; i < W * H; i++) key += b.visible[i] ? '1' : ex[i] ? '2' : '0';
    if (key !== s.fogKey) {
      s.fogKey = key;
      if (!s.fogC || s.fogC.width !== W * 3 || s.fogC.height !== H * 3) { s.fogC = document.createElement('canvas'); s.fogC.width = W * 3; s.fogC.height = H * 3; }
      var fc = s.fogC.getContext('2d'), img = fc.createImageData(W * 3, H * 3), d = img.data;
      for (var y = 0; y < H * 3; y++) for (var x = 0; x < W * 3; x++) {
        var o = (y * W * 3 + x) * 4, k = Math.floor(y / 3) * W + Math.floor(x / 3);
        d[o] = 2; d[o + 1] = 4; d[o + 2] = 10; d[o + 3] = b.visible[k] ? 0 : ex[k] ? 182 : 255; // unexplored: blank
      }
      fc.putImageData(img, 0, 0);
    }
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(s.fogC, 0, 0, W * TS, H * TS); c.restore();
  }
  // Radial glow sprites are cached per colour; drawing scales them and sets the alpha.
  var glowCache = {};
  function glowSprite(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var g2 = cv.getContext('2d'), g = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(rgb, 1)); g.addColorStop(.35, rgba(rgb, .45)); g.addColorStop(1, rgba(rgb, 0));
    g2.fillStyle = g; g2.fillRect(0, 0, 64, 64);
    return (glowCache[rgb] = cv);
  }
  function glowAt(c, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    var ga = c.globalAlpha; c.globalAlpha = ga * Math.min(1, a); c.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2); c.globalAlpha = ga;
  }
  function lights(c, list) {
    c.save(); c.globalCompositeOperation = 'lighter';
    list.forEach(function (l) { glowAt(c, l.x, l.y, l.r, l.rgb, l.a * 1.4); });
    c.restore();
  }
  var vig = null;
  function vignette(c, w, h) {
    if (!vig || vig.width !== w || vig.height !== h) {
      vig = document.createElement('canvas'); vig.width = w; vig.height = h;
      var v = vig.getContext('2d'), g = v.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); v.fillStyle = g; v.fillRect(0, 0, w, h);
    }
    c.drawImage(vig, 0, 0);
  }

  // ------------------------------------------------------------ unit sprites
  // o: { facing (radians, 0 = east), now, alpha, flash (0..1), human (side the person plays), myTurn, hp }
  var PALETTES = {
    'default': { fw: '79,209,255', lat: '255,42,85', hpFw: '#7dff9b', hpLat: '#ff4d6d', flank: '#7dff9b' },
    contrast: { fw: '90,160,255', lat: '255,160,40', hpFw: '#6cb4ff', hpLat: '#ffa133', flank: '#6cb4ff' }
  };
  function pal() { return PALETTES[(XG.Settings && XG.Settings.get('palette')) || 'default'] || PALETTES['default']; }
  function unit(c, u, cx, cy, o) {
    var P = pal(), now = o.now, col = u.color, team = u.side === 'player' ? P.fw : P.lat, R = u.isStatic ? 16 : 13;
    var hover = u.kind === 'drone' || u.kind === 'sentinel' || u.kind === 'harmonic', bob = hover && !REDUCED ? Math.sin(now / 320 + u.id) * 2 : 0;
    c.save(); c.globalAlpha = Math.max(0, o.alpha);
    // ground shadow and team ring
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(cx + 2, cy + 6, hover ? 10 : 13, hover ? 5 : 6.5, 0, 0, Math.PI * 2); c.fill();
    if (!u.isStatic) {
      c.strokeStyle = rgba(team, .55); c.lineWidth = 1.5;
      for (var q = 0; q < 4; q++) { c.beginPath(); c.arc(cx, cy, 17, q * Math.PI / 2 + .25, q * Math.PI / 2 + 1.32); c.stroke(); }
      c.fillStyle = rgba(team, .07); circle(c, cx, cy, 17); c.fill();
    }
    if (u.override) { c.strokeStyle = '#7dff9b'; c.setLineDash([3, 4]); c.lineDashOffset = now / 30; circle(c, cx, cy, 20); c.stroke(); c.setLineDash([]); }
    c.translate(cx, cy + bob - (hover ? 3 : 0));
    var draw = SPRITES[u.kind];
    // o.look: the cursor in map px; eyes that track it get its angle and distance from the unit
    if (o.look) { o.lookAng = Math.atan2(o.look[1] - cy, o.look[0] - cx); o.lookDist = Math.hypot(o.look[0] - cx, o.look[1] - cy); }
    if (draw) draw(c, col, o.facing || 0, now, u, o);
    else fallback(c, u, R);
    if (o.flash > 0) { c.globalCompositeOperation = 'lighter'; glowAt(c, 0, 0, 22, '255,255,255', o.flash); c.globalCompositeOperation = 'source-over'; }
    c.restore();
    c.save(); c.globalAlpha = Math.max(0, o.alpha);
    badges(c, u, cx, cy, o);
    c.restore();
  }
  // A unit's sprite alone, facing up, drawn into a small canvas (squad cards, pickers).
  function icon(cv, u) {
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
    cv.width = w * dpr; cv.height = h * dpr;
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.translate(w / 2, h / 2); c.scale(w / 34, h / 34);
    var draw = SPRITES[u.kind];
    if (draw) draw(c, u.color, -Math.PI / 2, 0, u); else fallback(c, u, 13);
  }
  // Operative portrait, front view, seeded by soldier id so it never changes. 40×40 drawing space.
  var SKIN = ['#f1c9a8', '#e0ac85', '#c48a62', '#9a6545', '#6e4630', '#4a2e1f'];
  var HAIR = ['#151515', '#2e1d12', '#5a3a1f', '#8f6a3a', '#cfc09a', '#9b3324', '#3a3f4a'];
  function portrait(cv, sol, C) {
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, w = cv.clientWidth || 36, h = cv.clientHeight || 36;
    cv.width = w * dpr; cv.height = h * dpr;
    var c = cv.getContext('2d'); c.setTransform(dpr * w / 40, 0, 0, dpr * h / 40, 0, 0);
    var col = C.color, rgb = rgbOf(col), id = sol.id * 7 + (sol.name || '').length, r = function (k) { return hash(id, k, 77); };
    var bg = c.createRadialGradient(20, 16, 2, 20, 20, 26); bg.addColorStop(0, rgba(rgb, .28)); bg.addColorStop(1, '#070b12');
    c.fillStyle = bg; c.fillRect(0, 0, 40, 40);
    c.strokeStyle = rgba(rgb, .12); for (var y = 2; y < 40; y += 3) { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(40, y + .5); c.stroke(); }
    var kind = sol.cls;
    if (kind === 'sentinel') {
      c.fillStyle = '#2a2240'; c.beginPath(); c.moveTo(6, 40); c.lineTo(10, 30); c.lineTo(30, 30); c.lineTo(34, 40); c.fill();
      c.fillStyle = '#3a3058'; c.beginPath(); if (c.roundRect) c.roundRect(11, 8, 18, 20, 5); else c.rect(11, 8, 18, 20); c.fill();
      c.strokeStyle = col; c.lineWidth = 1; c.stroke();
      var gl = .6 + .4 * Math.sin(id);
      c.fillStyle = rgba(rgb, .9 * gl); c.fillRect(13, 15, 14, 3.5);
      c.fillStyle = '#fff'; c.fillRect(15 + r(1) * 9, 15.5, 2, 2.5);
      c.strokeStyle = '#6a5a90'; c.beginPath(); c.moveTo(20, 8); c.lineTo(20, 3); c.stroke(); c.fillStyle = col; circle(c, 20, 3, 1.3); c.fill();
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(15, 23, 10, 1.2);
      return;
    }
    var skin = SKIN[Math.floor(r(2) * SKIN.length)], hair = HAIR[Math.floor(r(3) * HAIR.length)], long = r(4) < .4, beard = r(5) < .2;
    // shoulders / outfit
    var body = kind === 'trooper' ? '#26384f' : kind === 'hacker' ? '#163024' : '#d5dbe3';
    c.fillStyle = body; c.beginPath(); c.moveTo(3, 40); c.quadraticCurveTo(5, 29, 20, 28); c.quadraticCurveTo(35, 29, 37, 40); c.fill();
    if (kind === 'trooper') { c.fillStyle = rgba(rgb, .8); c.fillRect(5, 33, 7, 3); c.fillRect(28, 33, 7, 3); }
    if (kind === 'scientist') { c.strokeStyle = '#9aa6b4'; c.beginPath(); c.moveTo(16, 29); c.lineTo(20, 36); c.lineTo(24, 29); c.stroke(); c.fillStyle = col; c.fillRect(26, 33, 4, 2); }
    // neck and head
    c.fillStyle = skin; c.fillRect(17, 24, 6, 6);
    if (long && kind !== 'trooper') { c.fillStyle = hair; c.beginPath(); c.ellipse(20, 20, 9.5, 11, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = skin; c.beginPath(); c.ellipse(20, 18, 7, 8.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(22.5, 19, 4, 7, 0, 0, Math.PI * 2); c.fill();
    if (beard) { c.fillStyle = hair; c.beginPath(); c.ellipse(20, 23, 5.5, 3.6, 0, 0, Math.PI); c.fill(); }
    // eyes, brows, mouth
    c.fillStyle = '#111'; c.fillRect(16.4, 17.2, 2, 1.8); c.fillRect(21.6, 17.2, 2, 1.8);
    c.fillStyle = hair; c.fillRect(15.8, 15.4, 3, .9); c.fillRect(21.2, 15.4, 3, .9);
    c.fillStyle = 'rgba(80,30,30,.55)'; c.fillRect(18.3, 22.6, 3.4, .9);
    if (kind === 'trooper') { // helmet with a visor band
      c.fillStyle = shadeHex(col, -.55); c.beginPath(); c.arc(20, 15.5, 8.2, Math.PI, 0); c.lineTo(28.2, 17); c.lineTo(11.8, 17); c.closePath(); c.fill();
      c.strokeStyle = col; c.lineWidth = .8; c.stroke(); c.fillStyle = rgba(rgb, .7); c.fillRect(12, 12.6, 16, 1.6);
    } else if (kind === 'hacker') { // hood and glowing glasses
      c.strokeStyle = '#1f4a34'; c.lineWidth = 3; c.beginPath(); c.arc(20, 18, 9.5, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.fillStyle = '#163024'; c.beginPath(); c.moveTo(10.5, 18); c.quadraticCurveTo(9, 28, 13, 30); c.lineTo(11, 30); c.quadraticCurveTo(7, 24, 10.5, 15); c.fill();
      c.beginPath(); c.moveTo(29.5, 18); c.quadraticCurveTo(31, 28, 27, 30); c.lineTo(29, 30); c.quadraticCurveTo(33, 24, 29.5, 15); c.fill();
      c.fillStyle = rgba(rgb, .85); c.fillRect(15.4, 16.6, 4, 2.6); c.fillRect(20.6, 16.6, 4, 2.6); c.fillRect(19.4, 17.4, 1.2, .8);
    } else { // scientist: hair, goggles pushed up
      c.fillStyle = hair; c.beginPath(); c.arc(20, 15, 7.4, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(27, 13); c.quadraticCurveTo(20, 9.5, 13, 13); c.fill();
      c.fillStyle = rgba(rgb, .9); circle(c, 17, 11.5, 2); c.fill(); circle(c, 23, 11.5, 2); c.fill();
      c.strokeStyle = '#3a3420'; c.lineWidth = .8; c.beginPath(); c.moveTo(12.5, 12); c.lineTo(27.5, 12); c.stroke();
    }
    c.lineWidth = 1;
  }
  function fallback(c, u, R) {
    c.fillStyle = '#10141c'; c.strokeStyle = u.color; c.lineWidth = 2; circle(c, 0, 0, R); c.fill(); c.stroke();
    c.fillStyle = u.color; c.font = 'bold 14px "Share Tech Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(u.glyph, 0, 1); c.textBaseline = 'alphabetic';
  }
  function glow(c, rgb, r, a) { glowAt(c, 0, 0, r, rgb, a * 1.3); }
  // Human operative, top-down: shoulders, weapon, helmet with a visor facing forward.
  function human(kind) {
    return function (c, col, f, now) {
      var rgb = rgbOf(col), len = kind === 'trooper' ? 17 : kind === 'hacker' ? 12 : 9;
      c.rotate(f);
      if (kind === 'scientist') { c.fillStyle = '#3a3420'; c.fillRect(-12, -6, 6, 12); c.strokeStyle = rgba(rgb, .7); c.strokeRect(-11.5, -5.5, 5, 11); }
      if (kind === 'hacker') { c.fillStyle = '#103020'; c.beginPath(); c.moveTo(-2, -10); c.lineTo(-14, -3); c.lineTo(-14, 3); c.lineTo(-2, 10); c.fill(); }
      // shoulders / torso
      c.fillStyle = '#1a2a3c'; c.strokeStyle = rgba(rgb, .9); c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(-1, 0, 6, kind === 'trooper' ? 11.5 : 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      if (kind === 'trooper') { c.fillStyle = rgba(rgb, .75); c.fillRect(-5, -12, 7, 4); c.fillRect(-5, 8, 7, 4); }
      // arms reaching to the weapon
      c.strokeStyle = '#2c3e54'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-1, -8); c.lineTo(7, 1); c.moveTo(-1, 8); c.lineTo(5, 4); c.stroke(); c.lineCap = 'butt';
      // weapon
      c.fillStyle = '#7d8ea5'; c.fillRect(2, 1, len, 3.4);
      c.fillStyle = '#c9d6e4'; c.fillRect(2, 1, len, 1);
      c.fillStyle = col; c.fillRect(2 + len - 2.5, 1, 2.5, 3.4);
      // helmet in class colour, visor facing forward
      c.fillStyle = shadeHex(col, -0.45); circle(c, 0, 0, 5.8); c.fill();
      c.strokeStyle = col; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = rgba(rgb, .9); c.beginPath(); c.arc(0, 0, 5.8, -1.2, 1.2); c.arc(0, 0, 2.6, 1.2, -1.2, true); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(3.6, -2, 1.6, 4);
      c.lineWidth = 1;
      if (kind === 'scientist' && Math.sin(now / 300) > 0) { c.fillStyle = '#fff3c4'; c.fillRect(-10, -8, 2, 2); }
      if (kind === 'hacker') { // floating holo-deck
        c.rotate(-f); var fl = .55 + .3 * Math.sin(now / 90 + Math.sin(now / 37));
        c.fillStyle = rgba(rgb, .16 * fl); c.strokeStyle = rgba(rgb, .7 * fl); c.fillRect(-15, -19, 11, 7); c.strokeRect(-15.5, -19.5, 12, 8);
        c.fillStyle = rgba(rgb, .8 * fl); c.fillRect(-13, -17, 6, 1); c.fillRect(-13, -15, 4, 1);
      }
    };
  }
  function shadeHex(hex, k) {
    var p = rgbOf(hex).split(',').map(Number);
    return 'rgb(' + p.map(function (v) { return Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); }).join(',') + ')';
  }
  var SPRITES = {
    trooper: human('trooper'), hacker: human('hacker'), scientist: human('scientist'),
    sentinel: function (c, col, f, now) { // HALCYON frame: hovering hex chassis around a bright core
      var rgb = rgbOf(col), p = .7 + .3 * Math.sin(now / 240);
      glow(c, rgb, 18, .25 * p);
      c.rotate(f);
      c.fillStyle = '#1a1230'; c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath();
      for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3 + Math.PI / 6; c.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); }
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2a1d4a'; c.fillRect(-4, -14, 8, 4); c.fillRect(-4, 10, 8, 4);
      c.fillStyle = col; c.fillRect(9, -1.5, 9, 3);
      c.fillStyle = rgba(rgb, p); circle(c, 0, 0, 4.5); c.fill(); c.fillStyle = '#fff'; circle(c, 0, 0, 1.8); c.fill();
    },
    drone: function (c, col, f, now, u, o) { // quadcopter: spinning rotors around a red eye
      var rgb = rgbOf(col);
      c.rotate(f);
      c.strokeStyle = '#3a1a24'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, 8); c.moveTo(-8, 8); c.lineTo(8, -8); c.stroke();
      [[-8, -8], [8, -8], [-8, 8], [8, 8]].forEach(function (p, i) {
        c.fillStyle = rgba(rgb, .12); circle(c, p[0], p[1], 5.5); c.fill();
        c.strokeStyle = rgba(rgb, .55); c.lineWidth = 1; c.stroke();
        var a = now / 25 * (i % 2 ? 1 : -1); c.strokeStyle = 'rgba(255,220,230,.55)'; c.beginPath();
        c.moveTo(p[0] + Math.cos(a) * 5, p[1] + Math.sin(a) * 5); c.lineTo(p[0] - Math.cos(a) * 5, p[1] - Math.sin(a) * 5); c.stroke();
      });
      c.lineWidth = 1.5; c.fillStyle = '#1d0a12'; c.strokeStyle = col; circle(c, 0, 0, 5.5); c.fill(); c.stroke();
      // the pupil looks at the cursor (relative to the body's facing); straight ahead with no cursor
      var la = o && o.lookAng != null ? o.lookAng - f : 0, lr = o && o.lookAng != null ? 2.5 * Math.min(1, o.lookDist / 14) : 2.5;
      glow(c, rgb, 8, .5); c.fillStyle = '#ffd0da'; circle(c, Math.cos(la) * lr, Math.sin(la) * lr, 1.8); c.fill();
    },
    warden: function (c, col, f, now, u) { // tracked security mech with a turret
      var rgb = rgbOf(col);
      c.rotate(f);
      c.fillStyle = '#1a1008'; c.fillRect(-12, -13, 24, 6); c.fillRect(-12, 7, 24, 6);
      c.fillStyle = 'rgba(255,255,255,.12)'; for (var t = -11; t < 12; t += 4) { c.fillRect(t, -13, 1.5, 6); c.fillRect(t, 7, 1.5, 6); }
      c.fillStyle = '#2c1a0c'; c.strokeStyle = col; c.lineWidth = 1.6; c.fillRect(-10, -8, 20, 16); c.strokeRect(-10, -8, 20, 16);
      c.fillStyle = rgba(rgb, .3); c.fillRect(-8, -6, 4, 12);
      c.fillStyle = '#3d2410'; circle(c, 1, 0, 6.5); c.fill(); c.stroke();
      c.fillStyle = '#5a3a1e'; c.fillRect(6, -2, 12, 4); c.fillStyle = col; c.fillRect(16, -2, 3, 4);
      c.fillStyle = Math.sin(now / 200 + u.id) > 0 ? '#ffd166' : '#5a3a1e'; c.fillRect(-2, -1, 2, 2);
    },
    harmonic: function (c, col, f, now, u) { // hard-light hologram: flickers, splits into RGB ghosts
      var rgb = rgbOf(col), t = Math.floor(now / 90), jit = hash(t, u.id, 80) < .15 ? (hash(t, u.id, 81) - .5) * 6 : 0;
      var fl = REDUCED ? .85 : .65 + .3 * hash(Math.floor(now / 60), u.id, 82);
      glow(c, rgb, 20, .28);
      c.rotate(f);
      var body = function (dx, style) {
        c.fillStyle = style; c.beginPath(); c.ellipse(-1 + dx, 0, 6, 10, 0, 0, Math.PI * 2); c.fill();
        circle(c, 2 + dx, 0, 4.5); c.fill();
        c.fillRect(3 + dx, 2.5, 11, 2);
      };
      c.globalCompositeOperation = 'lighter';
      body(jit - 2, 'rgba(79,209,255,' + (.25 * fl) + ')'); body(jit + 2, 'rgba(255,42,85,' + (.25 * fl) + ')');
      body(jit, rgba(rgb, .6 * fl));
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(0,0,0,.35)'; var sl = (now / 30) % 24 - 12; c.fillRect(-12, sl, 24, 1.5); c.fillRect(-12, sl - 8, 24, 1);
      c.fillStyle = '#fff'; circle(c, 4 + jit, 0, 1.4); c.fill();
    },
    relay: function (c, col, f, now) { // signal relay: octagon base, spinning rings, a beam into the sky
      var rgb = rgbOf(col), p = .6 + .4 * Math.sin(now / 300);
      c.fillStyle = '#1a0810'; c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath();
      for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4 + Math.PI / 8; c.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); }
      c.closePath(); c.fill(); c.stroke();
      c.lineWidth = 2;
      for (var r = 0; r < 3; r++) { c.strokeStyle = rgba(rgb, .35 + r * .2); c.beginPath(); var s = now / (500 - r * 120) * (r % 2 ? -1 : 1); c.arc(0, 0, 6 + r * 3.5, s, s + 2.2); c.stroke(); }
      c.globalCompositeOperation = 'lighter';
      var bg = c.createLinearGradient(0, 0, 0, -70); bg.addColorStop(0, rgba(rgb, .55 * p)); bg.addColorStop(1, rgba(rgb, 0));
      c.fillStyle = bg; c.fillRect(-2.5, -70, 5, 70);
      glow(c, rgb, 14, .6 * p);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#ffd0da'; c.beginPath(); c.moveTo(0, -4); c.lineTo(3, 0); c.lineTo(0, 4); c.lineTo(-3, 0); c.fill();
    },
    core: function (c, col, f, now) { // the Uplink Core: a rotating wireframe icosahedron in a red aura
      var rgb = rgbOf(col), p = .6 + .4 * Math.sin(now / 260);
      c.globalCompositeOperation = 'lighter'; glow(c, rgb, 32, .3 * p); c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#16020a'; c.strokeStyle = rgba(rgb, .6); circle(c, 0, 0, 17); c.fill(); c.stroke();
      var ay = now / 1400, ax = now / 2300, P = ICO.map(function (v) {
        var x = v[0] * Math.cos(ay) - v[2] * Math.sin(ay), z = v[0] * Math.sin(ay) + v[2] * Math.cos(ay), y = v[1] * Math.cos(ax) - z * Math.sin(ax);
        z = v[1] * Math.sin(ax) + z * Math.cos(ax); return [x * 12, y * 12, z];
      });
      c.lineWidth = 1;
      ICO_E.forEach(function (e) {
        var a = P[e[0]], bb = P[e[1]], d = (a[2] + bb[2]) / 2;
        c.strokeStyle = rgba(rgb, .35 + .45 * (d + 1) / 2); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.stroke();
      });
      c.fillStyle = '#fff'; circle(c, 0, 0, 2.2 * p + 1); c.fill();
    },
    firewall_sw: function (c, col, f, now) { // perimeter firewall: a hex of glowing bricks with a rotating ward ring
      var rgb = rgbOf(col);
      glow(c, rgb, 18, .18);
      c.save(); c.beginPath();
      for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3; c.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); }
      c.closePath(); c.fillStyle = '#06182a'; c.fill(); c.strokeStyle = col; c.lineWidth = 1.5; c.stroke(); c.clip();
      c.strokeStyle = rgba(rgb, .5); c.lineWidth = 1;
      for (var y = -10; y <= 10; y += 5) { c.beginPath(); c.moveTo(-12, y); c.lineTo(12, y); c.stroke(); for (var x = -12 + (y % 10 ? 3 : 0); x < 12; x += 6) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 5); c.stroke(); } }
      c.restore();
      c.strokeStyle = rgba(rgb, .7); c.lineWidth = 2; var s = now / 900;
      for (var q = 0; q < 3; q++) { c.beginPath(); c.arc(0, 0, 15, s + q * 2.09, s + q * 2.09 + 1.2); c.stroke(); }
    },
    antivirus: function (c, col, f, now) { // antivirus daemon: a glowing cross with orbiting scanners
      var rgb = rgbOf(col);
      glow(c, rgb, 16, .22);
      c.fillStyle = '#082014'; c.strokeStyle = col; c.lineWidth = 1.5;
      c.beginPath(); if (c.roundRect) c.roundRect(-9, -9, 18, 18, 4); else c.rect(-9, -9, 18, 18); c.fill(); c.stroke();
      c.fillStyle = col; c.fillRect(-1.8, -6, 3.6, 12); c.fillRect(-6, -1.8, 12, 3.6);
      for (var k = 0; k < 2; k++) { var a = now / 400 + k * Math.PI; c.fillStyle = '#c8ffd6'; circle(c, Math.cos(a) * 14, Math.sin(a) * 14, 2); c.fill(); }
    },
    ids: function (c, col, f, now) { // intrusion sentinel: an eye that sweeps for intruders
      var rgb = rgbOf(col), look = Math.sin(now / 700) * 4;
      glow(c, rgb, 16, .2);
      c.fillStyle = '#1c1606'; c.strokeStyle = col; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-12, 0); c.quadraticCurveTo(0, -11, 12, 0); c.quadraticCurveTo(0, 11, -12, 0); c.fill(); c.stroke();
      c.fillStyle = rgba(rgb, .9); circle(c, look, 0, 4.2); c.fill(); c.fillStyle = '#000'; circle(c, look, 0, 1.8); c.fill();
      c.strokeStyle = rgba(rgb, .25); c.beginPath(); c.arc(0, 0, 16, now / 500, now / 500 + .8); c.stroke();
    }
  };
  var ICO = (function () {
    var t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    return v.map(function (p) { var l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
  })();
  var ICO_E = (function () {
    var e = [];
    for (var i = 0; i < 12; i++) for (var j = i + 1; j < 12; j++) {
      var d = Math.hypot(ICO[i][0] - ICO[j][0], ICO[i][1] - ICO[j][1], ICO[i][2] - ICO[j][2]); if (d < 1.1) e.push([i, j]);
    }
    return e;
  })();

  // HP plate, shield, and status icons around a unit.
  function badges(c, u, cx, cy, o) {
    var P = pal(), enemy = u.side === 'enemy', n = u.maxHp, hp = o.hp, pw = Math.min(5, 30 / n), w = n * pw, x0 = cx - w / 2, y0 = Math.max((o.top || 0) + 4, cy - 23); // top row of the view (o.top, map px): keep it on screen
    c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x0 - 2, y0 - 2, w + 3, 7);
    for (var i = 0; i < n; i++) { c.fillStyle = i < hp ? (enemy ? P.hpLat : P.hpFw) : '#2a1820'; c.fillRect(x0 + i * pw, y0, pw - 1, 3); }
    for (var s = 0; s < u.shield; s++) { c.fillStyle = '#c792ff'; c.fillRect(x0 + s * pw, y0 < 6 ? y0 + 4 : y0 - 4, pw - 1, 2); }
    if (u.shield) { c.strokeStyle = 'rgba(199,146,255,' + (.45 + .25 * Math.sin(o.now / 200)) + ')'; c.lineWidth = 1.5; circle(c, cx, cy, 19); c.stroke(); c.lineWidth = 1; }
    if (u.overwatch) eye(c, cx - 15, cy + 17, '#4fd1ff');
    if (u.hunker) shieldIcon(c, cx + 15, cy + 17, '#4fd1ff');
    if (u.marked) { c.strokeStyle = '#ffd166'; c.lineWidth = 1.5; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (k) { c.beginPath(); c.moveTo(cx + k[0] * 19, cy + k[1] * 12); c.lineTo(cx + k[0] * 19, cy + k[1] * 19); c.lineTo(cx + k[0] * 12, cy + k[1] * 19); c.stroke(); }); c.lineWidth = 1; }
    c.font = 'bold 10px "Share Tech Mono", monospace'; c.textAlign = 'center';
    if (u.stunned) for (var k = 0; k < 3; k++) { var a = o.now / 300 + k * 2.09; c.fillStyle = '#7dff9b'; c.fillText('✦', cx + Math.cos(a) * 9, cy - 13 + Math.sin(a) * 3); }
    if (u.override) { c.fillStyle = '#7dff9b'; c.fillText('⟲' + u.override, cx + 15, cy - 11); }
    if (u.side === 'enemy' && !u.alerted && !u.isStatic) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(cx + 10, cy - 19, 9, 11); c.fillStyle = '#9aa7b8'; c.fillText('?', cx + 14.5, cy - 10.5); }
    if (u.side === o.human && u.ap <= 0 && u.alive && o.myTurn && !u.isStatic) { c.fillStyle = 'rgba(0,0,0,.4)'; circle(c, cx, cy, 15); c.fill(); }
  }
  function eye(c, x, y, col) {
    c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x - 6, y - 4, 12, 8);
    c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 5, y); c.quadraticCurveTo(x, y - 5, x + 5, y); c.quadraticCurveTo(x, y + 5, x - 5, y); c.stroke();
    c.fillStyle = col; circle(c, x, y, 1.6); c.fill();
  }
  function shieldIcon(c, x, y, col) {
    c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x - 5, y - 5, 10, 10);
    c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x + 4, y - 4); c.lineTo(x + 4, y); c.lineTo(x, y + 4); c.lineTo(x - 4, y); c.closePath(); c.stroke();
  }

  // ------------------------------------------------------------ particles
  // A particle: { x, y, vx, vy, t0, life, size, rgb, kind, g (gravity px/s²), drag, rot, vr, ch }
  function emit(list, n, sp) {
    if (REDUCED) n = Math.ceil(n / 3);
    var now = sp.now;
    for (var i = 0; i < n; i++) {
      var a = sp.angle !== undefined ? sp.angle + rnd(-1, 1) * (sp.cone || Math.PI) : rnd(0, Math.PI * 2), v = rnd(sp.speed[0], sp.speed[1]);
      list.push({
        x: sp.x + rnd(-1, 1) * (sp.spread || 0), y: sp.y + rnd(-1, 1) * (sp.spread || 0), vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        t0: now + (sp.delay ? rnd(0, sp.delay) : 0), life: rnd(sp.life[0], sp.life[1]), size: rnd(sp.size[0], sp.size[1]),
        rgb: Array.isArray(sp.rgb) ? pick(sp.rgb) : sp.rgb, kind: sp.kind, g: sp.g || 0, drag: sp.drag || 0,
        rot: rnd(0, 6.28), vr: rnd(-8, 8), ch: sp.chars ? pick(sp.chars) : ''
      });
    }
  }
  function particles(c, list, now, dt) {
    var keep = [], s = dt / 1000;
    c.save();
    for (var i = 0; i < list.length; i++) {
      var p = list[i], age = now - p.t0;
      if (age < 0) { keep.push(p); continue; }
      if (age > p.life) continue;
      keep.push(p);
      var k = age / p.life, dr = Math.max(0, 1 - p.drag * s);
      p.vx *= dr; p.vy = p.vy * dr + p.g * s; p.x += p.vx * s; p.y += p.vy * s; p.rot += p.vr * s;
      var a = 1 - k;
      if (p.kind === 'smoke') {
        c.globalCompositeOperation = 'source-over'; c.fillStyle = rgba(p.rgb, .35 * a);
        circle(c, p.x, p.y, p.size * (1 + k * 2.2)); c.fill(); continue;
      }
      c.globalCompositeOperation = 'lighter';
      if (p.kind === 'spark') {
        c.strokeStyle = rgba(p.rgb, a); c.lineWidth = p.size; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); c.stroke();
      } else if (p.kind === 'ember' || p.kind === 'fire') {
        glowAt(c, p.x, p.y, p.size * (p.kind === 'fire' ? 1 + k * 1.5 : 1 - k * .5), p.rgb, a);
      } else if (p.kind === 'shard') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = rgba(p.rgb, a);
        c.beginPath(); c.moveTo(0, -p.size); c.lineTo(p.size * .7, p.size * .6); c.lineTo(-p.size * .6, p.size * .4); c.fill(); c.restore();
      } else if (p.kind === 'pixel') {
        c.fillStyle = rgba(p.rgb, a); c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.kind === 'glyph') {
        c.fillStyle = rgba(p.rgb, a); c.font = p.size + 'px "Share Tech Mono", monospace'; c.textAlign = 'center'; c.fillText(p.ch, p.x, p.y);
      } else if (p.kind === 'plus') {
        c.fillStyle = rgba(p.rgb, a); c.fillRect(p.x - p.size, p.y - .8, p.size * 2, 1.6); c.fillRect(p.x - .8, p.y - p.size, 1.6, p.size * 2);
      } else if (p.kind === 'ring') {
        c.strokeStyle = rgba(p.rgb, a * .9); c.lineWidth = 2.5 * a + .5; circle(c, p.x, p.y, p.size * (.2 + k * 1.1)); c.stroke();
      } else if (p.kind === 'flash') glowAt(c, p.x, p.y, p.size, p.rgb, a * a);
    }
    c.restore();
    return keep;
  }
  // Canned effects.
  var FX = {
    muzzle: function (L, x, y, ang, rgb, now) {
      emit(L, 1, { now: now, x: x, y: y, speed: [0, 0], life: [90, 110], size: [16, 18], rgb: rgb, kind: 'flash' });
      emit(L, 6, { now: now, x: x, y: y, angle: ang, cone: .35, speed: [180, 420], life: [80, 160], size: [1, 1.6], rgb: rgb, kind: 'spark', drag: 6 });
    },
    impact: function (L, x, y, ang, rgb, machine, now) {
      emit(L, 1, { now: now, x: x, y: y, speed: [0, 0], life: [120, 150], size: [14, 16], rgb: '255,240,220', kind: 'flash' });
      emit(L, machine ? 14 : 8, { now: now, x: x, y: y, angle: ang + Math.PI, cone: 1.1, speed: [90, 320], life: [180, 420], size: [1, 1.8], rgb: machine ? ['255,209,102', '255,240,200', rgb] : [rgb, '255,255,255'], kind: 'spark', g: 500, drag: 3 });
      if (machine) emit(L, 3, { now: now, x: x, y: y, speed: [10, 30], life: [500, 800], size: [4, 6], rgb: '40,44,56', kind: 'smoke', g: -30 });
    },
    ricochet: function (L, x, y, now) {
      emit(L, 5, { now: now, x: x, y: y, speed: [60, 200], life: [120, 260], size: [1, 1.4], rgb: '220,230,255', kind: 'spark', g: 300 });
      emit(L, 2, { now: now, x: x, y: y, speed: [5, 15], life: [400, 600], size: [3, 4], rgb: '90,100,120', kind: 'smoke', g: -20 });
    },
    explosion: function (L, x, y, r, now) {
      emit(L, 1, { now: now, x: x, y: y, speed: [0, 0], life: [220, 260], size: [70 * r, 80 * r], rgb: '255,220,160', kind: 'flash' });
      emit(L, 2, { now: now, x: x, y: y, speed: [0, 0], life: [380, 460], size: [70 * r, 80 * r], rgb: '255,180,100', kind: 'ring' });
      emit(L, 26, { now: now, x: x, y: y, spread: 10, speed: [20, 120], life: [300, 650], size: [8, 16], rgb: ['255,140,50', '255,200,90', '255,90,40'], kind: 'fire', drag: 3, g: -60 });
      emit(L, 30, { now: now, x: x, y: y, speed: [150, 480], life: [250, 700], size: [1, 2], rgb: ['255,220,140', '255,170,80'], kind: 'spark', g: 420, drag: 2 });
      emit(L, 14, { now: now, x: x, y: y, spread: 22, speed: [8, 40], life: [900, 1600], size: [8, 14], rgb: ['26,28,34', '40,38,40'], kind: 'smoke', g: -24, delay: 150 });
      emit(L, 10, { now: now, x: x, y: y, speed: [120, 300], life: [400, 800], size: [2, 4], rgb: '90,100,120', kind: 'shard', g: 600, drag: 1 });
    },
    shatter: function (L, x, y, now) { // a glass panel bursts
      emit(L, 22, { now: now, x: x, y: y, spread: 12, speed: [60, 300], life: [350, 800], size: [1.5, 3.5], rgb: ['190,230,255', '255,255,255', '120,200,255'], kind: 'shard', g: 700, drag: 1 });
      emit(L, 10, { now: now, x: x, y: y, spread: 12, speed: [80, 260], life: [150, 300], size: [1, 1.4], rgb: '255,255,255', kind: 'spark', drag: 3 });
    },
    emp: function (L, x, y, r, now) {
      emit(L, 1, { now: now, x: x, y: y, speed: [0, 0], life: [260, 300], size: [80 * r, 90 * r], rgb: '79,209,255', kind: 'flash' });
      emit(L, 3, { now: now, x: x, y: y, speed: [0, 0], life: [360, 560], size: [70 * r, 80 * r], rgb: ['79,209,255', '199,146,255'], kind: 'ring', delay: 120 });
      emit(L, 34, { now: now, x: x, y: y, spread: 40 * r, speed: [20, 140], life: [200, 600], size: [1, 2], rgb: ['180,240,255', '79,209,255'], kind: 'spark', drag: 4 });
    },
    wreck: function (L, x, y, rgb, now) { // a machine dies
      emit(L, 1, { now: now, x: x, y: y, speed: [0, 0], life: [160, 200], size: [36, 40], rgb: '255,210,160', kind: 'flash' });
      emit(L, 12, { now: now, x: x, y: y, spread: 6, speed: [20, 90], life: [250, 500], size: [5, 10], rgb: ['255,140,50', '255,200,90'], kind: 'fire', g: -40, drag: 3 });
      emit(L, 12, { now: now, x: x, y: y, speed: [80, 260], life: [400, 900], size: [2, 4.5], rgb: [rgb, '120,120,130'], kind: 'shard', g: 500, drag: 1 });
      emit(L, 8, { now: now, x: x, y: y, spread: 8, speed: [5, 25], life: [1000, 1800], size: [6, 10], rgb: '30,30,36', kind: 'smoke', g: -20, delay: 120 });
    },
    derez: function (L, x, y, rgb, now) { // a program or hologram dissolves into pixels
      emit(L, 34, { now: now, x: x, y: y, spread: 13, speed: [10, 60], angle: -Math.PI / 2, cone: .9, life: [400, 1000], size: [1.5, 3.5], rgb: [rgb, '255,255,255'], kind: 'pixel', g: -40, delay: 200 });
    },
    downed: function (L, x, y, rgb, now) { // an operative goes down: their signal breaks up
      emit(L, 18, { now: now, x: x, y: y, spread: 10, speed: [5, 30], life: [500, 900], size: [1.5, 2.5], rgb: [rgb, '255,77,109'], kind: 'pixel', g: -20, delay: 150 });
      emit(L, 2, { now: now, x: x, y: y, speed: [0, 0], life: [500, 600], size: [26, 30], rgb: '255,77,109', kind: 'ring' });
    },
    heal: function (L, x, y, now) {
      emit(L, 12, { now: now, x: x, y: y + 6, spread: 12, angle: -Math.PI / 2, cone: .4, speed: [15, 45], life: [500, 900], size: [2, 3.5], rgb: '125,255,155', kind: 'plus', delay: 200 });
      emit(L, 1, { now: now, x: x, y: y, speed: [0, 0], life: [400, 500], size: [26, 30], rgb: '125,255,155', kind: 'flash' });
    },
    shieldUp: function (L, x, y, now) { emit(L, 2, { now: now, x: x, y: y, speed: [0, 0], life: [400, 600], size: [26, 30], rgb: '199,146,255', kind: 'ring', delay: 150 }); },
    warp: function (L, x, y, now) { // Lattice reinforcements stream in
      emit(L, 26, { now: now, x: x, y: y - 10, spread: 12, angle: Math.PI / 2, cone: .2, speed: [60, 180], life: [200, 500], size: [1.5, 3], rgb: ['255,42,85', '255,61,242', '255,255,255'], kind: 'pixel' });
      emit(L, 1, { now: now, x: x, y: y, speed: [0, 0], life: [300, 360], size: [34, 40], rgb: '255,42,85', kind: 'flash' });
    },
    alert: function (L, x, y, now) { emit(L, 1, { now: now, x: x, y: y, speed: [0, 0], life: [400, 500], size: [24, 28], rgb: '255,77,109', kind: 'ring' }); },
    stun: function (L, x, y, now) { emit(L, 16, { now: now, x: x, y: y, spread: 8, speed: [30, 90], life: [300, 600], size: [1, 1.6], rgb: ['125,255,155', '200,255,220'], kind: 'spark', drag: 3 }); }
  };

  // A jagged bolt from a to z (Data Spike, EMP arcs).
  function bolt(c, ax, ay, zx, zy, rgb, w, seed) {
    var n = 9, dx = zx - ax, dy = zy - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    c.beginPath(); c.moveTo(ax, ay);
    for (var i = 1; i < n; i++) { var k = i / n, off = (hash(seed, i, 90) - .5) * Math.min(18, L * .15); c.lineTo(ax + dx * k + nx * off, ay + dy * k + ny * off); }
    c.lineTo(zx, zy);
    c.strokeStyle = rgba(rgb, .35); c.lineWidth = w * 3; c.stroke();
    c.strokeStyle = rgba(rgb, .95); c.lineWidth = w; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = Math.max(1, w / 2.5); c.stroke(); c.lineWidth = 1;
  }
  // A glowing tracer segment from a to z showing the part [tail, head] (0..1).
  function tracer(c, ax, ay, zx, zy, tail, head, rgb, w) {
    var x0 = ax + (zx - ax) * tail, y0 = ay + (zy - ay) * tail, x1 = ax + (zx - ax) * head, y1 = ay + (zy - ay) * head;
    var g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, rgba(rgb, 0)); g.addColorStop(1, rgba(rgb, .95));
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    c.strokeStyle = g; c.lineWidth = w * 3.2; c.globalAlpha *= .35; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.globalAlpha /= .35; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = Math.max(.8, w / 2.5); c.beginPath(); c.moveTo(x0 + (x1 - x0) * .6, y0 + (y1 - y0) * .6); c.lineTo(x1, y1); c.stroke();
    c.restore();
  }

  // Turn banner: a band slides in, the text glitches into slices, then it all fades.
  function banner(c, text, color, k, Wp, Hp, now) {
    var a = k < .12 ? k / .12 : k > .75 ? (1 - k) / .25 : 1, slide = k < .15 ? (1 - k / .15) : 0, rgb = rgbOf(color), y = Hp / 2;
    c.save(); c.globalAlpha = Math.max(0, a);
    c.fillStyle = 'rgba(4,8,14,.82)'; c.fillRect(-slide * Wp, y - 38, Wp, 76);
    c.fillStyle = rgba(rgb, .9); c.fillRect(-slide * Wp, y - 38, Wp, 2); c.fillRect(slide * Wp, y + 36, Wp, 2);
    c.fillStyle = rgba(rgb, .07);
    for (var sx = -60 + ((now / 8) % 24); sx < Wp; sx += 24) { c.beginPath(); c.moveTo(sx, y + 36); c.lineTo(sx + 12, y - 36); c.lineTo(sx + 20, y - 36); c.lineTo(sx + 8, y + 36); c.fill(); }
    c.font = 'bold 40px Rajdhani, sans-serif'; c.textAlign = 'center';
    var glitch = k < .3 || (k > .55 && k < .6);
    for (var s = 0; s < 5; s++) {
      var top = y - 26 + s * 9, off = glitch ? (hash(Math.floor(now / 40), s, 91) - .5) * 26 : 0;
      c.save(); c.beginPath(); c.rect(0, top, Wp, 9); c.clip();
      if (glitch) { c.fillStyle = 'rgba(255,42,85,.6)'; c.fillText(text, Wp / 2 + off - 3, y + 14); c.fillStyle = 'rgba(79,209,255,.6)'; c.fillText(text, Wp / 2 + off + 3, y + 14); }
      c.fillStyle = color; c.fillText(text, Wp / 2 + off + slide * 300, y + 14);
      c.restore();
    }
    c.restore();
  }

  // Radar sweep for Sensor Scan.
  function sweep(c, x, y, r, k) {
    var a = k * Math.PI * 2.5 - Math.PI / 2;
    c.save(); c.globalCompositeOperation = 'lighter';
    var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,209,102,.25)'); g.addColorStop(1, 'rgba(255,209,102,0)');
    c.fillStyle = g; c.globalAlpha = 1 - k * .6;
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a - .9, a); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,209,102,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke();
    c.strokeStyle = 'rgba(255,209,102,.35)'; circle(c, x, y, r * Math.min(1, k * 1.5)); c.stroke();
    c.restore();
  }

  return {
    TS: TS, REDUCED: REDUCED, hash: hash, rgbOf: rgbOf, biomeOf: biomeOf, BIOMES: BIOMES, pitName: function (b) { return BIOMES[biomeOf(b)].pit.name; },
    propName: function (b, x, y) { var p = propAt(b, x, y), P = p && XG.DATA.props[p]; return P ? P.names[biomeOf(b)] : null; },
    propRule: function (b, x, y) {
      var p = propAt(b, x, y), P = p && XG.DATA.props[p];
      if (P && P.faces) { // e.g. 'Full cover from N/E, half from S/W'
        var m = b.faces[y * W_(b) + x], full = [], half = [];
        [['N', 1], ['E', 2], ['S', 4], ['W', 8]].forEach(function (f) { (m & f[1] ? full : half).push(f[0]); });
        return full.length === 4 ? 'Full cover all round' : !full.length ? 'Half cover all round' : 'Full cover from ' + full.join('/') + ', half from ' + half.join('/');
      }
      return P ? P.rule : null;
    },
    terrain: terrain, damaged: damaged, decal: decal, ambient: ambient, motes: motes, fog: fog, lights: lights, vignette: vignette,
    unit: unit, icon: icon, portrait: portrait, pal: pal, emit: emit, particles: particles, FX: FX, bolt: bolt, tracer: tracer, banner: banner, sweep: sweep
  };
})();
