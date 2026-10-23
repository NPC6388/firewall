// Prints tactical map stats and an ASCII sample of each layout: node tools/map-sampler.js [maps]
// Legend: # wall, H tall cover, c low cover, ~ pit (impassable, no cover), . floor, F player, E enemy (deployment is random per edge, see Tac.deploy)
// Outside layout (node missions, server inside a building): w window, d desk, R rack, S server; up to 3 samples, one per approach edge.
var fs = require('fs'), path = require('path'), vm = require('vm');
var ctx = vm.createContext({ console: console, Math: Math, Date: Date, JSON: JSON });
['data.js', 'state.js', 'strategy.js', 'tactical.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
var XG = ctx.XG, Tac = XG.Tac, S = XG.State;
var N = +process.argv[2] || 400, g = S.newGame(3), stats = {}, shown = {}, pitHist = [0, 0, 0, 0, 0, 0, 0];
var NO = Math.round(N / 4), edges = {};
for (var i = 0; i < N + NO; i++) {
  var out = i >= N, b = Tac.create(g, { kind: 'purge', diff: 2, seed: 1000 + i * 7919, name: 'x', city: 'x', scenario: out ? 'node' : null, layout: out ? 'outside' : null }, g.soldiers.slice(0, 4));
  var st = stats[b.layout] = stats[b.layout] || { n: 0, cover: 0, high: 0, wall: 0, pit: 0, open: 0 };
  st.n++;
  var pits = 0, seenPit = {};
  for (var k = 0; k < b.tiles.length; k++) {
    var t = b.tiles[k];
    if (t === Tac.LOW) st.cover++; else if (t === Tac.HIGH) st.high++; else if (t === Tac.WALL) st.wall++; else if (t === Tac.PIT) st.pit++;
    // open floor: no cover on any side
    if (t === Tac.FLOOR) {
      var x = k % b.W, y = (k - x) / b.W;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (o) { var c = Tac.coverTile(b, x + o[0], y + o[1]); return c !== Tac.FLOOR; })) st.open++;
    }
    if (t === Tac.PIT && !seenPit[k]) { // count connected pit features
      pits++; var q = [k]; seenPit[k] = 1;
      while (q.length) { var c = q.pop(), cx = c % b.W, cy = (c - cx) / b.W;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var nx = cx + o[0], ny = cy + o[1], ni = ny * b.W + nx;
          if (nx >= 0 && ny >= 0 && nx < b.W && ny < b.H && b.tiles[ni] === Tac.PIT && !seenPit[ni]) { seenPit[ni] = 1; q.push(ni); } }); }
    }
  }
  pitHist[Math.min(6, pits)]++;
  if (out ? !edges[b.outside.edge] && Object.keys(edges).length < 3 : !shown[b.layout]) {
    shown[b.layout] = 1; if (out) edges[b.outside.edge] = 1;
    console.log('\n' + b.layout + ' (seed ' + (1000 + i * 7919) + ')' + (out ? ' approach edge ' + b.outside.edge + ', building ' + b.outside.w + 'x' + b.outside.h + ' (' + Math.round(100 * b.outside.w * b.outside.h / (b.W * b.H)) + '% of the map), ' + b.outside.doors.length + ' entrances, turn limit ' + b.turnLimit : ''));
    for (var yy = 0; yy < b.H; yy++) {
      var row = '';
      for (var xx = 0; xx < b.W; xx++) {
        var u = Tac.unitAt(b, xx, yy);
        var pp = b.props[yy * b.W + xx];
        row += Tac.isServer(b, xx, yy) ? 'S' : u ? (u.side === 'player' ? 'F' : 'E') : pp === 'window' ? 'w' : pp === 'desk' ? 'd' : pp === 'rack' ? 'R' : '.#cH~'[b.tiles[yy * b.W + xx]];
      }
      console.log('  ' + row);
    }
  }
}
console.log('\nlayout     maps  low/map  tall/map  wall/map  pit/map  open floor/map');
Object.keys(stats).forEach(function (k) {
  var s = stats[k], f = function (v) { return (v / s.n).toFixed(1).padStart(8); };
  console.log(k.padEnd(10) + String(s.n).padStart(5) + f(s.cover) + ' ' + f(s.high) + '  ' + f(s.wall) + ' ' + f(s.pit) + '  ' + f(s.open));
});
console.log('pit features per map (0/1/2/3/4/5/6+):', pitHist.join(' / '));
