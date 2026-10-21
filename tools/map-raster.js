// Dev tool, not loaded by the game. Source data: Natural Earth 1:110m land (public domain), e.g.
//   curl -L -o ne_110m_land.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
// Then: node tools/map-raster.js ne_110m_land.geojson 100 > grid.json, and paste grid.rows into LAND in js/backdrop.js.
// Rasterize Natural Earth land into a low-res Mercator grid for the FIREWALL world map (100 x 56.25 viewBox).
// Usage: node tools/map-raster.js <geojson> [cols] -> prints JSON { cols, rows, latTop, latBottom }; ASCII preview on stderr.
// Region node positions in DATA.regions (x %, y % of the map) use the same projection: x = (lon + 180) / 3.6.
var fs = require('fs');
var gj = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
var COLS = +(process.argv[3] || 100), W = 100, H = 56.25, CELL = W / COLS, ROWS = Math.round(H / CELL);
var LAT_TOP = 78, merc = function (lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); };
var yTop = merc(LAT_TOP), span = 2 * Math.PI * H / W; // keeps the scale square: 360 deg of longitude = 100 units
function toLat(yUnits) { var m = yTop - yUnits / H * span; return (2 * Math.atan(Math.exp(m)) - Math.PI / 2) * 180 / Math.PI; }
function toLon(xUnits) { return xUnits / W * 360 - 180; }
var polys = [];
gj.features.forEach(function (f) {
  var g = f.geometry, list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  list.forEach(function (p) { polys.push(p); });
});
function inRing(r, x, y) {
  var c = false;
  for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
    var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function land(lon, lat) {
  for (var i = 0; i < polys.length; i++) {
    if (!inRing(polys[i][0], lon, lat)) continue;
    var hole = false; for (var k = 1; k < polys[i].length; k++) if (inRing(polys[i][k], lon, lat)) hole = true;
    if (!hole) return true;
  }
  return false;
}
// region by rough geography: n(orth america) s(outh america) e(urope) f(africa) a(sia) o(ceania)
function region(lon, lat) {
  if (lon < -169) return 'a'; // Chukotka wrapping past 180
  if (lon < -25) return lat > 12.5 || (lon < -77.3 && lat > 7) ? 'n' : 's';
  if (lon > 95 && lat < 6 && !(lon < 105 && lat > 1)) return 'o';
  if ((lon > 160 && lat < 0) || (lon > 110 && lat < -10)) return 'o';
  if (lat < 36 && lon < 52 && !(lon > 34.5 && lat > 11.5)) return 'f';
  if ((lon < 40 && lat >= 36) || (lon < 60 && lat >= 45)) return 'e';
  return 'a';
}
var rows = [];
for (var r = 0; r < ROWS; r++) {
  var row = '';
  for (var c = 0; c < COLS; c++) {
    var hits = 0, n = 0, lon0, lat0;
    for (var sy = 0; sy < 3; sy++) for (var sx = 0; sx < 3; sx++) {
      var lon = toLon((c + (sx + .5) / 3) * CELL), lat = toLat((r + (sy + .5) / 3) * CELL);
      n++; if (land(lon, lat)) hits++;
    }
    lon0 = toLon((c + .5) * CELL); lat0 = toLat((r + .5) * CELL);
    row += hits >= 3 ? region(lon0, lat0) : '.';
  }
  rows.push(row);
}
process.stderr.write(rows.join('\n') + '\n');
console.log(JSON.stringify({ cols: COLS, rows: rows, latTop: LAT_TOP, latBottom: toLat(H) }));
