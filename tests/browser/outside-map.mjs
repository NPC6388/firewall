// Outside maps (server inside a building, attackers start in the yard): one node battle from each side. Prints where each side
// starts (yard / inside), hovers a window, and takes a full-map shot plus a zoomed shot of the building with its windows.
// One case also shatters a window to show the empty frame. Shots: outside-<case>-full, outside-<case>-zoom, outside-broken.
// Run: node tests/browser/drive.mjs tests/browser/outside-map.mjs
export default async function ({ ev, shot, sleep, send }) {
  const fs = await import('node:fs'); const path = await import('node:path');
  await ev(`localStorage.clear(); XG.Settings.set('hints', false); location.reload()`); await sleep(1200);
  await ev(`window.OM = {
    fw: function (seed) {
      var g = XG.State.newGame(seed), m = XG.Strat.spawnMission(g, XG.State.rng(g), 'purge'); m.scenario = 'node'; m.layout = 'outside'; m.diff = 2; m.seed = seed * 7919;
      var b = XG.Tac.create(g, m, g.soldiers.slice(0, 4)); XG.TacUI.startWith(g, b, function () {}); return b;
    },
    lat: function (kind, seed) {
      var g = XG.Lat.newGame(seed); g.day = 40; g.trace = 60; g.phase = 'war';
      var m = XG.Lat.spawnMission(g, XG.State.rng(g), kind); m.scenario = 'node'; m.layout = 'outside'; m.seed = seed * 7919;
      var b = XG.Tac.createLattice(m, ['drone', 'warden', 'harmonic', 'drone'], XG.Lat.earthSquad(g, m), {}); XG.TacUI.startWith(g, b, function () {}); return b;
    },
    lift: function (b) { b.visible = b.visible.map(function () { return true; }); b.explored = b.explored.map(function () { return true; }); },
    info: function (b) {
      var o = b.outside, T = XG.Tac, sides = {};
      b.units.forEach(function (u) { if (!u.alive || u.isStatic) return; var k = (u.side === b.human ? 'you' : 'AI') + (T.indoor(b, u.x, u.y) ? ' inside' : ' in the yard'); sides[k] = (sides[k] || 0) + 1; });
      var wins = b.props.filter(function (p) { return p === 'window'; }).length;
      return 'layout ' + b.layout + ', edge ' + o.edge + ', building ' + o.w + 'x' + o.h + ' @' + o.x + ',' + o.y + ', server ' + b.server.x + ',' + b.server.y + ' (indoor ' + T.indoor(b, b.server.x, b.server.y) + '), entrances ' + o.doors.length + ', windows ' + wins + ', turn limit ' + b.turnLimit + ' | ' + JSON.stringify(sides);
    },
    win: function (b) { var i = b.props.indexOf('window'); return [i % b.W, Math.floor(i / b.W)]; },
    hover: function (x, y) {
      var p = XG.TacUI.tileToClient(x, y), c = document.getElementById('tac-canvas');
      c.dispatchEvent(new MouseEvent('mousemove', { clientX: p.x + 40, clientY: p.y + 40, bubbles: true }));
      c.dispatchEvent(new MouseEvent('mousemove', { clientX: p.x, clientY: p.y, bubbles: true }));
      return document.getElementById('tac-hover').innerText.replace(/\\s+/g, ' ');
    }
  }; 'ok'`);
  const canvasShot = async (name, scale) => {
    const r = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left,r.top,r.width,r.height];})()`);
    const res = await send('Page.captureScreenshot', { format: 'png', clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: scale || 1 } });
    fs.writeFileSync(path.resolve('tests/browser/shots', name + '.png'), Buffer.from(res.result.data, 'base64')); console.log('  shot', name);
  };
  const wheel = async (dy, n) => {
    const r = await ev(`(function(){var r=document.getElementById('tac-canvas').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];})()`);
    for (let i = 0; i < n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r[0], y: r[1], deltaX: 0, deltaY: dy }); await sleep(60); }
  };
  const cases = [['fw-node', `OM.fw(51)`], ['raid-node', `OM.lat('raid', 52)`], ['strike-node', `OM.lat('strike', 53)`]];
  for (const [name, start] of cases) {
    await ev(`window.B = ${start}; 'ok'`);
    await sleep(name.startsWith('raid') ? 9000 : 1500); // a raid opens with FIREWALL's approach turn
    console.log(name + ':', await ev(`OM.info(B)`));
    await ev(`OM.lift(B)`);
    await wheel(400, 12); await sleep(500);
    await canvasShot('outside-' + name + '-full');
    const w = JSON.parse(await ev(`JSON.stringify(OM.win(B))`));
    await wheel(-400, 12); await sleep(200);
    await ev(`XG.TacUI.centerOn(${w[0]}, ${w[1]})`); await sleep(700);
    console.log('  window hover:', await ev(`OM.hover(${w[0]}, ${w[1]})`));
    await canvasShot('outside-' + name + '-zoom', 1.4);
    if (name === 'fw-node') { // shatter it: the empty frame
      await ev(`(function(){ XG.Tac.clearTile(B, ${w[0]}, ${w[1]}, [], 'blast'); OM.lift(B); })()`); await sleep(500);
      console.log('  broken hover:', await ev(`OM.hover(${w[0]}, ${w[1]})`));
      await canvasShot('outside-broken', 1.4);
      await ev(`XG.TacUI.centerOn(B.server.x, B.server.y)`); await sleep(700);
      await canvasShot('outside-server-room', 1.4);
    }
  }
}
