// The user's "LOS in a box" room (screenshot 2026-10-22) in a real Lattice battle: a room with two windows in its west wall, one
// in its south wall, a gap in the top wall and an opening east onto a corridor; racks (solid) and desks (fire-through) inside.
// Five Lattice units sit where the picture has them; FIREWALL troopers stand at the far ends of the yellow arrows. Fog shows only
// what the selected top-right unit sees, Shoot is armed (every target it can shoot gets a ring and odds) and one shot per aimed
// target draws its aim line. Shots: room-los-fog, room-los-aim-<n>. Prints which arrow ends are visible / targetable.
// Run: node tests/browser/drive.mjs tests/browser/room-los.mjs
export default async function ({ ev, sleep, send }) {
  const fs = await import('node:fs'); const path = await import('node:path');
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  const info = await ev(`(function () {
    var T = XG.Tac, g = XG.Lat.newGame(61); g.day = 40; g.trace = 60; g.phase = 'war';
    var m = XG.Lat.spawnMission(g, XG.State.rng(g), 'strike'); m.scenario = 'exterminate'; m.seed = 61 * 7919;
    var b = T.createLattice(m, ['drone', 'warden', 'harmonic', 'drone', 'drone'], XG.Lat.earthSquad(g, m), {}), W = b.W;
    b.tiles.fill(T.FLOOR); b.props.fill(0); b.faces.fill(0); b.tileHp = {}; delete b.outside; b.server = null; b.turnLimit = 0;
    var OX = 14, OY = 9, P = function (x, y, t, p) { b.tiles[(OY + y) * W + OX + x] = t; b.props[(OY + y) * W + OX + x] = p || 0; };
    for (var y = 0; y <= 7; y++) for (var x = 0; x <= 7; x++) if (x === 0 || x === 7 || y === 0 || y === 7) P(x, y, T.WALL);
    P(5, 0, T.FLOOR); P(7, 1, T.FLOOR);
    P(0, 2, T.LOW, 'window'); P(0, 5, T.LOW, 'window'); P(3, 7, T.LOW, 'window');
    P(2, 2, T.HIGH, 'rack'); P(4, 2, T.HIGH, 'rack'); P(2, 5, T.LOW, 'desk'); P(3, 5, T.LOW, 'desk'); P(5, 4, T.LOW, 'desk');
    b.base = JSON.parse(JSON.stringify({ tiles: b.tiles, props: b.props, faces: b.faces }));
    var lat = b.units.filter(function (u) { return u.side === 'enemy' && !u.isStatic; }), fw = b.units.filter(function (u) { return u.side === 'player'; });
    b.units.forEach(function (u) { if (u.isStatic) u.alive = false; });
    var spots = [[4, 1], [1, 1], [1, 3], [1, 4], [1, 6]], ends = [[8, -2], [9, 1], [-2, 2], [-1, 6], [6, 5], [-2, 5]];
    lat.forEach(function (u, i) { var s = spots[i]; if (s) { u.x = OX + s[0]; u.y = OY + s[1]; u.ap = 2; } else u.alive = false; });
    fw.forEach(function (u, i) { var e = ends[i]; if (e) { u.x = OX + e[0]; u.y = OY + e[1]; } else u.alive = false; u.alerted = true; });
    b.units.forEach(function (u) { if (u.side === 'player') u.alerted = true; });
    window.RB = b; window.RS = lat[0];
    XG.TacUI.startWith(g, b, function () {});
    // fog from the selected unit alone: the other Lattice units step out of the sight pass for a moment
    var others = lat.slice(1).filter(function (u) { return u.alive; });
    others.forEach(function (u) { u.alive = false; }); T.refreshVis(b); others.forEach(function (u) { u.alive = true; });
    b.explored = b.visible.slice();
    var st = XG.TacUI.debug(); st.sel = RS.id; st.mode = 'shoot'; st.dirty = true;
    var tg = T.targets(b, RS, 'shoot');
    return JSON.stringify({ S: [RS.x - OX, RS.y - OY], range: RS.range, ends: fw.filter(function (u) { return u.alive; }).map(function (u) {
      return { at: [u.x - OX, u.y - OY], seen: !!b.visible[u.y * W + u.x], los: T.los(b, RS.x, RS.y, u.x, u.y), back: T.los(b, u.x, u.y, RS.x, RS.y), target: tg.indexOf(u) >= 0, odds: T.hitInfo(b, RS, u).chance };
    }), targets: tg.map(function (t) { return t.id; }) });
  })()`);
  console.log('room:', info);
  const canvasShot = async (name, scale) => {
    const r = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()`);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: scale || 1 } });
    fs.writeFileSync(path.resolve('tests/browser/shots', name + '.png'), Buffer.from(res.result.data, 'base64')); console.log('  shot', name);
  };
  const wheel = async (dy, n) => {
    const r = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];})()`);
    for (let i = 0; i < n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r[0], y: r[1], deltaX: 0, deltaY: dy }); await sleep(60); }
  };
  await sleep(1500);
  await wheel(-400, 2); await sleep(300);
  await ev(`XG.TacUI.centerOn(RB.units.filter(function(u){return u===RS})[0].x + 1, RS.y + 2)`); await sleep(800);
  const ids = JSON.parse(info).targets;
  await canvasShot('room-los-fog');
  for (let i = 0; i < ids.length; i++) {
    await ev(`(function(){ var st = XG.TacUI.debug(); st.aim = ${JSON.stringify(ids[i])}; st.dirty = true; })()`); await sleep(400);
    await canvasShot('room-los-aim-' + (i + 1));
  }
}
