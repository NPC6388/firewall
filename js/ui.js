// FIREWALL: strategy-layer screens (DOM). Reads game state, mutates it only through XG.Strat.
var XG = globalThis.XG = globalThis.XG || {};

XG.UI = (function () {
  var D = XG.DATA, S = XG.State, St = XG.Strat;
  var $ = function (id) { return document.getElementById(id); };
  var UI = { g: null, tab: 'command', slot: null, sort: { key: null, dir: 1 } };

  function infColor(p) {
    // cyan (clean) -> amber -> red (lost)
    var t = Math.max(0, Math.min(1, p / 80));
    var a = [79, 209, 255], m = [255, 209, 102], z = [255, 42, 85];
    var c = t < .5 ? lerp(a, m, t * 2) : lerp(m, z, (t - .5) * 2);
    return 'rgb(' + c.join(',') + ')';
  }
  function lerp(a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); }
  function pct(v) { return (Math.round(v * 10) / 10).toFixed(1) + '%'; }
  function hpBar(cur, max) { return '<span class="hp"><div style="width:' + Math.round(100 * cur / max) + '%"></div></span>' + cur + '/' + max; }

  UI.show = function (id) {
    ['screen-title', 'screen-strategy', 'screen-tactical'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    window.scrollTo(0, 0);
  };

  // ------------------------------------------------------------ modal
  UI.modal = function (html) { $('modal-box').innerHTML = html; $('modal').classList.remove('hidden'); $('modal-box').scrollTop = 0; };
  UI.closeModal = function () { $('modal').classList.add('hidden'); $('modal-box').innerHTML = ''; };
  UI.isModal = function () { return !$('modal').classList.contains('hidden'); };

  UI.toast = function (lines) {
    if (!lines.length) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .5s'; t.style.opacity = '0'; }, 3800);
    setTimeout(function () { t.remove(); }, 4400);
  };

  // Plays queued story beats one by one, then calls done().
  // Each campaign keeps its own save slot.
  UI.save = function (g) { return g.faction === 'lattice' ? XG.Lat.save(g) : S.save(g); };

  UI.playStory = function (done) {
    var g = UI.g;
    if (!g.storyQueue.length) { UI.closeModal(); if (done) done(); return; }
    var key = g.storyQueue.shift();
    if (g.storySeen.indexOf(key) < 0) g.storySeen.push(key);
    UI.save(g);
    UI.storyModal(key, function () {
      var end = D.story[key].end || (key === 'victory' || key === 'defeat' ? key : null);
      if (end) { UI.gameOver(end); return; }
      UI.playStory(done);
    });
  };
  UI.storyModal = function (key, next) {
    var s = D.story[key];
    UI.modal('<h1>' + s.title + '</h1>' + s.body.map(function (p) { return '<p>' + p + '</p>'; }).join('') +
      (s.voice ? '<div class="voice' + (s.voice.who === 'LATTICE' ? ' lattice' : '') + '"><div class="who">' + s.voice.who + '</div>' + s.voice.text + '</div>' : '') +
      '<div class="modal-actions"><button class="primary" id="story-next">Continue</button></div>');
    $('story-next').onclick = next;
    $('story-next').focus();
  };
  UI.gameOver = function (kind) {
    var g = UI.g, st = g.stats;
    if (g.faction === 'lattice') {
      XG.Lat.clear();
      UI.modal('<h1 class="' + (kind === 'victory' ? 'good' : 'bad') + '">' + (kind === 'victory' ? 'EARTH IS HARMONIZED' : 'THE LATTICE IS SILENCED') + '</h1>' +
        '<p>Day ' + g.day + ' · Convergence ' + pct(g.convergence) + ' · FIREWALL trace ' + pct(g.trace) + '</p>' +
        '<p>Raids held ' + st.raidsHeld + ' · strikes won ' + st.strikesWon + ' · units lost ' + st.unitsLost + ' · humans harmonized ' + st.humansKilled + '</p>' +
        '<div class="modal-actions"><button class="primary" data-action="to-title">Return to title</button></div>');
      return;
    }
    S.clear();
    UI.modal('<h1 class="' + (kind === 'victory' ? 'good' : 'bad') + '">' + (kind === 'victory' ? 'EARTH ENDURES' : 'EARTH IS HARMONIZED') + '</h1>' +
      '<p>Day ' + g.day + ' · Convergence ' + pct(g.convergence) + '</p>' +
      '<p>Missions won ' + st.missionsWon + ' · lost ' + st.missionsLost + ' · expired ' + st.expired + ' · hostiles destroyed ' + st.kills + '</p>' +
      '<p>Fallen: ' + (g.memorial.length ? g.memorial.map(function (s) { return s.name; }).join(', ') : 'none. Every operative came home.') + '</p>' +
      '<div class="modal-actions"><button class="primary" data-action="to-title">Return to title</button></div>');
  };

  // ------------------------------------------------------------ strategy
  UI.render = function () {
    var g = UI.g; if (!g) return;
    document.body.classList.toggle('lattice', g.faction === 'lattice');
    XG.Audio.scene(g.faction === 'lattice' ? 'lat' : 'fw');
    if (g.faction === 'lattice') XG.LUI.render();
    else {
      renderTop(g); renderTabs(g);
      var v = { command: viewCommand, research: viewResearch, engineering: viewEngineering, barracks: viewBarracks, archive: viewArchive }[UI.tab];
      $('strat-main').innerHTML = v(g);
    }
    // shared: help/settings buttons, first-visit tip, portraits
    $('tabs').insertAdjacentHTML('beforeend', '<div class="util-btns"><button data-action="help" title="Help and glossary (?)">?</button><button data-action="settings" title="Settings">⚙</button></div>');
    $('strat-main').insertAdjacentHTML('afterbegin', XG.Tutorial.stratTip(g.faction, UI.tab));
    UI.paintPortraits();
  };
  UI.portrait = function (s) { return '<canvas class="portrait" data-portrait="' + s.id + '"></canvas>'; };
  UI.paintPortraits = function () {
    if (!UI.g || !UI.g.soldiers) return;
    document.querySelectorAll('canvas[data-portrait]').forEach(function (cv) {
      var id = +cv.getAttribute('data-portrait'), s = UI.g.soldiers.filter(function (x) { return x.id === id; })[0];
      if (s) XG.Gfx.portrait(cv, s, D.classes[s.cls]);
    });
  };

  function renderTop(g) {
    var p = St.power(g), rate = St.convergenceRate(g);
    $('topbar').innerHTML =
      '<div class="brand">FIRE<span>WALL</span></div>' +
      '<div class="stat"><span class="k">Day</span>' + g.day + '</div>' +
      '<div class="stat"><span class="k">Credits</span>§' + g.credits + '</div>' +
      '<div class="stat"><span class="k">Salvage</span>' + g.salvage + '</div>' +
      '<div class="stat"><span class="k">Power</span>' + p.used + '/' + p.total + '</div>' +
      '<div class="conv"><div class="conv-label"><span>Convergence · +' + rate.toFixed(2) + '%/day</span><b>' + pct(g.convergence) + '</b></div>' +
      '<div class="conv-bar"><div class="conv-fill" style="width:' + g.convergence + '%"></div><div class="conv-ticks"></div></div></div>';
  }
  function renderTabs(g) {
    var avail = Object.keys(D.techs).some(function (t) { return St.techState(g, t) === 'available'; });
    var tabs = [['command', 'Command', g.missions.length], ['research', 'Research', !g.research.current && avail ? '!' : 0],
      ['engineering', 'Engineering', 0], ['barracks', 'Barracks', 0], ['archive', 'Archive', 0]];
    $('tabs').innerHTML = tabs.map(function (t) {
      return '<button data-action="tab" data-arg="' + t[0] + '" class="' + (UI.tab === t[0] ? 'on' : '') + '">' + t[1] +
        (t[2] ? '<span class="badge">' + t[2] + '</span>' : '') + '</button>';
    }).join('');
  }

  // ----- command
  function worldMap(g) {
    var vis = St.infectionVisible(g), H = 56.25, pos = {};
    D.regions.forEach(function (r) { pos[r.id] = [r.x, r.y * H / 100]; });
    var s = '<svg class="worldmap" viewBox="0 0 100 ' + H + '" role="img" aria-label="Regional infection map">';
    s += XG.Backdrop.mapDecor({ H: H, accent: '79,209,255', packet: '#4fd1ff', signal: '#ff2a55', pos: pos, links: D.links,
      tint: function (id) { var inf = St.region(g, id).infection; return vis ? [infColor(inf), .05 + inf / 300] : ['#4a5d78', .06]; } });
    D.links.forEach(function (l) { s += '<line class="link" x1="' + pos[l[0]][0] + '" y1="' + pos[l[0]][1] + '" x2="' + pos[l[1]][0] + '" y2="' + pos[l[1]][1] + '"/>'; });
    s += '<text x="50" y="' + (H - 1.4) + '" fill="#2f4560" font-size="2" text-anchor="middle" letter-spacing=".4">HALCYON GLOBAL NETWORK VIEW</text>';
    // infection halos first (area ∝ infection), so no halo covers another region's node or label;
    // until infection is visible, a blurred grey estimate in three sizes
    D.regions.forEach(function (r) { var inf = St.region(g, r.id).infection, p = pos[r.id];
      s += vis ? XG.Backdrop.halo(r.id, p[0], p[1], inf, infColor(inf)) : XG.Backdrop.roughHalo(r.id, p[0], p[1], inf); });
    D.regions.forEach(function (r) {
      var gr = St.region(g, r.id), p = pos[r.id], inf = gr.infection, col = vis ? infColor(inf) : '#4a5d78';
      var rad = 2.2;
      var ms = g.missions.filter(function (m) { return m.region === r.id; });
      ms.forEach(function (m) {
        var mc = m.kind === 'purge' ? '#ff2a55' : m.kind === 'relay' ? '#c792ff' : '#ff3df2';
        s += '<circle class="pulse" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (rad + 1) + '" fill="none" stroke="' + mc + '" stroke-width=".35"/>';
      });
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + rad + '" fill="' + col + '" fill-opacity=".18" stroke="' + col + '" stroke-width=".3"/>';
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r=".7" fill="' + col + '"/>';
      s += '<text x="' + p[0] + '" y="' + (p[1] + rad + 2.6) + '" fill="#cfdbe9" font-size="2.1" text-anchor="middle">' + r.name.toUpperCase() + '</text>';
      s += '<text x="' + p[0] + '" y="' + (p[1] + rad + 5) + '" fill="' + col + '" font-size="1.9" text-anchor="middle">' + (vis ? 'INFECTION ' + Math.round(inf) + '%' : 'INFECTION ' + XG.Backdrop.roughBand(inf).label) + '</text>';
      if (ms.length) s += '<text x="' + (p[0] + rad + 1) + '" y="' + (p[1] - rad + .6) + '" fill="#ff6b85" font-size="2">⚠ ' + ms.length + '</text>';
    });
    return s + '</svg>';
  }

  function missionCard(g, m) {
    var cls = m.kind === 'relay' ? 'story' : m.kind === 'uplink' ? 'final' : '';
    var rew = m.kind === 'uplink' ? 'Ends the war.' : 'Reward: ' + m.reward.salvage + ' salvage' + ', §' + St.missionCredits(m) + ', region infection -' + m.reward.infection + '%';
    var ready = g.soldiers.filter(function (s) { return S.available(g, s); }).length;
    return '<div class="mission ' + cls + '"><div class="mh"><span class="mn">' + m.name + '</span><span class="' + (m.daysLeft !== null && m.daysLeft <= 1 ? 'bad' : 'dim') + '">' +
      (m.daysLeft === null ? 'story' : m.daysLeft + 'd left') + '</span></div>' +
      '<div class="dim">' + m.city + ', ' + St.regionData(m.region).name + ' · threat ' + '▮'.repeat(m.diff) + '▯'.repeat(5 - m.diff) + '</div>' +
      '<p>' + m.brief + '<br>' + rew + '</p>' +
      '<button class="primary" data-action="deploy" data-arg="' + m.id + '"' + (ready ? '' : ' disabled title="No operatives fit for duty"') + '>Deploy squad ▸</button></div>';
  }

  function viewCommand(g) {
    var cur = g.research.current, nextFund = 30 - ((g.day - 1) % 30);
    return '<div class="grid2"><div><div class="panel"><h2>Global situation <small>' + (St.infectionVisible(g) ? 'live infection telemetry' : 'research Signal Analysis to see infection') + '</small></h2>' +
      worldMap(g) +
      '<div class="advance-row"><button class="primary big" data-action="advance">Advance time ▸▸</button><button data-action="advance-day">+1 day</button>' +
      '<span class="dim">Funding in ' + nextFund + 'd · Research: ' + (cur ? D.techs[cur].name + ' (' + St.daysLeft(g, cur) + 'd)' : '<span class="warn">idle</span>') + '</span></div></div></div>' +
      '<div><div class="panel"><h2>Missions <small>' + g.missions.length + ' active</small></h2>' +
      (g.missions.length ? g.missions.map(function (m) { return missionCard(g, m); }).join('') : '<p class="dim">No confirmed Lattice activity. Advance time.</p>') +
      '</div><div class="panel" style="margin-top:16px"><h2>Ops feed</h2><div class="feed">' +
      g.log.map(function (l) { return '<div><span class="d">D' + l.day + '</span>' + l.msg + '</div>'; }).join('') + '</div></div></div></div>';
  }

  // ----- research
  function viewResearch(g) {
    var rate = St.researchRate(g), cur = g.research.current;
    var head = '<div class="panel" style="margin-bottom:16px"><h2>Research <small>' + rate.toFixed(0) + ' RP/day · labs ' + St.built(g, 'lab') + ' · server farms ' + St.built(g, 'server') + '</small></h2>' +
      (cur ? '<p>Current project: <b>' + D.techs[cur].name + '</b>, ' + St.daysLeft(g, cur) + ' day(s) left.</p><div class="bar"><div style="width:' +
        Math.round(100 * (g.research.progress[cur] || 0) / D.techs[cur].cost) + '%"></div></div>' : '<p class="warn">No active project. Scientists are drinking coffee and reading the signal again.</p>') + '</div>';
    var order = { active: 0, available: 1, 'needs-item': 2, 'needs-salvage': 2, locked: 3, done: 4 };
    var ids = Object.keys(D.techs).sort(function (a, b) { return order[St.techState(g, a)] - order[St.techState(g, b)]; });
    return head + '<div class="cards">' + ids.map(function (id) {
      var t = D.techs[id], st = St.techState(g, id), btn = '';
      if (st === 'available') btn = '<button class="primary" data-action="research" data-arg="' + id + '">' + (cur ? 'Switch to this' : 'Begin research') + '</button>';
      else if (st === 'active') btn = '<span class="good">▶ In progress</span>';
      else if (st === 'done') btn = '<span class="dim">✓ Complete</span>';
      else if (st === 'needs-item') btn = '<span class="warn">Requires a Relay Core</span>';
      else if (st === 'needs-salvage') btn = '<span class="warn">Needs ' + t.salvage + ' salvage</span>';
      else btn = '<span class="dim">Requires ' + t.req.map(function (r) { return D.techs[r].name; }).join(', ') + '</span>';
      var prog = g.research.progress[id] ? Math.round(100 * g.research.progress[id] / t.cost) : 0;
      return '<div class="card ' + (st === 'needs-item' || st === 'needs-salvage' ? 'locked' : st) + '"><h3>' + t.name + '</h3><p>' + t.desc + '</p>' +
        '<div class="meta">' + t.cost + ' RP · ~' + Math.ceil(t.cost / rate) + ' days' + (t.salvage ? ' · ' + t.salvage + ' salvage' : '') + (prog && st !== 'done' ? ' · ' + prog + '% done' : '') + '</div>' + btn + '</div>';
    }).join('') + '</div>';
  }

  // ----- engineering
  function viewEngineering(g) {
    var p = St.power(g);
    var grid = g.base.map(function (b, i) {
      if (!b) return '<div class="slot empty' + (UI.slot === i ? ' sel' : '') + '" data-action="slot" data-arg="' + i + '">+ build</div>';
      var f = D.facilities[b.type];
      return '<div class="slot' + (b.daysLeft || b.demolish ? ' building' : '') + (UI.slot === i ? ' sel' : '') + '" data-action="slot" data-arg="' + i + '"><b>' + f.name + '</b>' +
        (b.daysLeft ? '<span class="warn">Under construction: ' + b.daysLeft + 'd</span>' : b.demolish ? '<span class="bad">Demolishing (offline): ' + b.demolish + 'd</span>' : '<span class="dim">' + f.desc + '</span>') + '</div>';
    }).join('');
    var side;
    if (UI.slot !== null && !g.base[UI.slot]) {
      side = '<h2>Build in slot ' + (UI.slot + 1) + '</h2><div class="buildlist">' + Object.keys(D.facilities).filter(function (k) { return !D.facilities[k].prebuilt; }).map(function (k) {
        var f = D.facilities[k], why = St.canBuild(g, k, UI.slot);
        return '<button data-action="build" data-arg="' + k + '"' + (why ? ' disabled title="' + why + '"' : '') + '><span><b>' + f.name + '</b><br><span class="dim">' + f.desc +
          '</span>' + (why ? '<br><span class="bad">' + why + '</span>' : '') + '</span><span style="white-space:nowrap">' + St.costText(f.cost) + '<br><span class="dim">' + f.days + 'd · ' + (f.power > 0 ? '+' : '') + f.power + '⚡</span></span></button>';
      }).join('') + '</div>';
    } else if (UI.slot !== null && g.base[UI.slot].daysLeft > 0) {
      var bf = D.facilities[g.base[UI.slot].type];
      side = '<h2>' + bf.name + ' <small>' + g.base[UI.slot].daysLeft + 'd left</small></h2><p class="dim">' + bf.desc + '</p>' +
        '<p>Cancel before it completes for a full refund (' + St.costText(bf.cost) + ').</p>' +
        '<button class="danger" data-action="cancel-build">Cancel construction</button>';
    } else if (UI.slot !== null && g.base[UI.slot].demolish) {
      var df = D.facilities[g.base[UI.slot].type];
      side = '<h2>' + df.name + ' <small>demolishing · ' + g.base[UI.slot].demolish + 'd left</small></h2><p class="dim">Offline. When demolition finishes you get back ' +
        St.costText(St.demolishRefund(g.base[UI.slot].type)) + ' and the slot frees up.</p><button data-action="cancel-demolish">Cancel demolition</button>';
    } else if (UI.slot !== null && !D.facilities[g.base[UI.slot].type].prebuilt) {
      var ty = g.base[UI.slot].type, ef = D.facilities[ty], dwhy = St.canDemolish(g, UI.slot);
      side = '<h2>' + ef.name + '</h2><p class="dim">' + ef.desc + '</p>' +
        '<p>Demolish for a 50% refund (' + St.costText(St.demolishRefund(ty)) + '). Takes ' + St.demolishDays(ty) + ' day(s); the facility goes offline immediately.</p>' +
        '<button class="danger" data-action="demolish"' + (dwhy ? ' disabled' : '') + '>Demolish</button>' + (dwhy ? '<p class="bad">' + dwhy + '</p>' : '');
    } else side = '<h2>Base</h2><p class="dim">Select an empty slot to build, or a slot under construction to cancel it. Consumers reserve power as soon as construction starts.</p>';
    var fab = Object.keys(D.fabrication).map(function (id) {
      var f = D.fabrication[id], why = St.canFabricate(g, id), c = St.fabCost(g, id);
      var done = !f.repeatable && g.fabricated[id];
      return '<div class="card' + (done ? ' done' : '') + '"><h3>' + f.name + (f.repeatable && g.fabricated[id] ? ' ×' + g.fabricated[id] : '') + '</h3><p>' + f.desc + '</p><div class="meta">' + St.costText(c) + '</div>' +
        (done ? '<span class="dim">✓ Fabricated</span>' : '<button class="primary" data-action="fabricate" data-arg="' + id + '"' + (why ? ' disabled' : '') + '>Fabricate</button>' + (why ? '<span class="dim">' + why + '</span>' : '')) + '</div>';
    }).join('');
    return '<div class="grid2"><div class="panel"><h2>Bunker <small>power ' + p.used + '/' + p.total + '</small></h2><div class="basegrid">' + grid + '</div></div>' +
      '<div class="panel">' + side + '</div></div><div class="panel" style="margin-top:16px"><h2>Fabrication <small>needs a Fabrication Bay</small></h2><div class="cards">' + fab + '</div></div>';
  }

  // ----- barracks
  // Barracks columns: [key, header, sort value]. Click a header to sort by it; click again to reverse.
  var BARRACKS_COLS = [
    ['name', 'Name', function (g, s) { return s.name.toLowerCase(); }],
    ['cls', 'Class', function (g, s) { return D.classes[s.cls].name; }],
    ['rank', 'Rank', function (g, s) { return s.xp; }],
    ['hp', 'HP', function (g, s) { return s.hp / S.stats(g, s).maxHp; }],
    ['status', 'Status', function (g, s) { return S.available(g, s) ? 0 : S.stats(g, s).maxHp - s.hp; }],
    ['aim', 'Aim', function (g, s) { return S.stats(g, s).aim; }],
    ['hack', 'Hack', function (g, s) { return S.stats(g, s).hackSkill || -1; }],
    ['missions', 'Missions', function (g, s) { return s.missions; }],
    ['kills', 'Kills', function (g, s) { return s.kills; }]
  ];
  UI.sortBy = function (key) {
    if (UI.sort.key === key) UI.sort.dir = -UI.sort.dir;
    else { UI.sort.key = key; UI.sort.dir = key === 'name' || key === 'cls' || key === 'status' ? 1 : -1; } // numbers: biggest first
    UI.render();
  };
  function sortedSoldiers(g) {
    var col = BARRACKS_COLS.filter(function (c) { return c[0] === UI.sort.key; })[0];
    var list = g.soldiers.slice();
    if (!col) return list;
    return list.sort(function (a, b) {
      var x = col[2](g, a), y = col[2](g, b);
      return (x < y ? -1 : x > y ? 1 : a.id - b.id) * (x === y ? 1 : UI.sort.dir);
    });
  }
  function viewBarracks(g) {
    var rows = sortedSoldiers(g).map(function (s) {
      var st = S.stats(g, s), C = D.classes[s.cls], ok = S.available(g, s);
      var heal = St.built(g, 'infirmary') ? 2 : 1;
      return '<tr><td class="who">' + UI.portrait(s) + s.name + '</td><td>' + C.name + '</td><td>' + S.rankName(s) + ' <span class="dim">(' + s.xp + ' xp)</span></td>' +
        '<td>' + hpBar(s.hp, st.maxHp) + '</td><td>' + (ok ? '<span class="good">Ready</span>' : '<span class="warn">' + (C.machine ? 'Repairing' : 'Wounded') + ' ' + Math.ceil((st.maxHp - s.hp) / heal) + 'd</span>') + '</td>' +
        '<td>' + st.aim + '</td><td>' + (st.hackSkill ? st.hackSkill + (s.hacks ? ' <span class="dim">(' + s.hacks + ' hacks)</span>' : '') : '<span class="dim">—</span>') + '</td><td>' + s.missions + '</td><td>' + s.kills + '</td></tr>';
    }).join('');
    var hire = ['trooper', 'hacker', 'scientist'].map(function (c) {
      return '<button data-action="hire" data-arg="' + c + '"' + (g.credits < D.tuning.hireCost ? ' disabled' : '') + ' title="' + D.classes[c].blurb + '">Recruit ' + D.classes[c].name + ' (§' + D.tuning.hireCost + ')</button>';
    }).join(' ');
    var mem = g.memorial.length ? '<table><tr><th>Name</th><th>Class</th><th>Fell</th><th>Missions</th><th>Kills</th></tr>' + g.memorial.map(function (s) {
      return '<tr><td>' + s.name + '</td><td>' + D.classes[s.cls].name + '</td><td>Day ' + s.diedDay + ', ' + s.diedAt + '</td><td>' + s.missions + '</td><td>' + s.kills + '</td></tr>';
    }).join('') + '</table>' : '<p class="dim">No names on the wall. Keep it that way.</p>';
    return '<div class="panel"><h2>Operatives <small>squad size ' + St.squadSize(g) + '</small></h2><div style="overflow-x:auto"><table class="sortable"><tr>' + BARRACKS_COLS.map(function (c) {
        var on = UI.sort.key === c[0];
        return '<th data-action="sort" data-arg="' + c[0] + '" class="' + (on ? 'on' : '') + '" title="Sort by ' + c[1].toLowerCase() + '">' + c[1] + (on ? (UI.sort.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
      }).join('') + '</tr>' + rows + '</table></div>' +
      '<div class="advance-row">' + hire + '</div></div>' +
      '<div class="panel" style="margin-top:16px"><h2>Classes</h2>' + Object.keys(D.classes).map(function (c) {
        var C = D.classes[c]; return '<p><span class="glyph" style="color:' + C.color + '">' + C.glyph + '</span><b>' + C.name + '</b>: ' + C.blurb + '</p>';
      }).join('') + '</div>' +
      '<div class="panel" style="margin-top:16px"><h2>Memorial</h2>' + mem + '</div>';
  }

  // ----- archive
  function viewArchive(g) {
    var st = g.stats;
    return '<div class="grid2"><div class="panel"><h2>Archive <small>story so far</small></h2>' +
      g.storySeen.map(function (k) { return '<div class="mission"><div class="mh"><span class="mn">' + D.story[k].title + '</span><button data-action="replay" data-arg="' + k + '">Read</button></div></div>'; }).join('') +
      '<h2 style="margin-top:16px">Record</h2><p>Missions won ' + st.missionsWon + ' · lost ' + st.missionsLost + ' · expired ' + st.expired + ' · hostiles destroyed ' + st.kills + '</p>' +
      '<div class="advance-row"><button class="danger" data-action="abandon">Abandon campaign</button><button data-action="to-title">Save &amp; quit to title</button></div></div>' +
      '<div class="panel"><h2>Field manual</h2>' +
      '<p><b>Goal:</b> research your way to the Lattice uplink and sever it before Convergence hits 100%. Skipped missions and infected regions speed the clock up.</p>' +
      '<p><b>Combat:</b> each operative has 2 AP. Moving costs 1 (blue range) or 2 (amber dash range). Shooting and most abilities end the turn. Medkit, Scan, Shield cost 1 AP.</p>' +
      '<p><b>Cover:</b> half cover −20 aim, full cover −40, judged from the side facing the shooter. Cover only counts in full when the shot comes in within 30° of head-on; it fades to half value as the angle steepens to about 63°, and past that the side gives nothing. No cover means you\'re flanked: easier to hit, +25 crit.</p>' +
      '<p><b>Controls:</b> click an operative to select (or Tab; with an ability armed, Tab cycles its targets). Click a tile to move. Click an enemy to aim, click again to fire. Keys 1–5 pick abilities (press the same key again to fire), O = Overclock, Enter = end turn, Esc / right-click = cancel.</p>' +
      '<p><b>Hacking:</b> drones are easy, Wardens hard, Harmonics impossible. With Lattice Grammar, a successful hack hands you the machine for 2 turns.</p>' +
      '<p class="dim">Press <b>?</b> any time for the searchable glossary, or ⚙ for sound, speed and palette settings.</p></div></div>';
  }

  // ------------------------------------------------------- squad select
  UI.squadSelect = function (m, launch) {
    var g = UI.g, size = St.squadSize(g), chosen = [];
    g.soldiers.forEach(function (s) { if (S.available(g, s) && chosen.length < size) chosen.push(s.id); });
    function draw() {
      UI.modal('<h1>' + m.name + '</h1><p class="dim">' + m.city + ' · ' + m.brief + '</p><p>Select up to <b>' + size + '</b> operatives (' + chosen.length + ' chosen).</p>' +
        g.soldiers.map(function (s) {
          var C = D.classes[s.cls], st = S.stats(g, s), ok = S.available(g, s), on = chosen.indexOf(s.id) >= 0;
          return '<div class="pick ' + (on ? 'on' : '') + (ok ? '' : ' off') + '" data-pick="' + s.id + '">' + UI.portrait(s) + '<span style="flex:1">' +
            s.name + '<br><span class="dim">' + S.rankName(s) + ' ' + C.name + ' · aim ' + st.aim + (st.hackSkill ? ' · hack ' + st.hackSkill : '') + ' · HP ' + s.hp + '/' + st.maxHp + (ok ? '' : ' · not fit for duty') + '</span></span>' + (on ? '✓' : '') + '</div>';
        }).join('') +
        '<div class="modal-actions"><button id="sq-cancel">Cancel</button><button class="primary" id="sq-go"' + (chosen.length ? '' : ' disabled') + '>Launch ▸</button></div>');
      UI.paintPortraits();
      document.querySelectorAll('[data-pick]').forEach(function (el) {
        el.onclick = function () {
          var id = +el.getAttribute('data-pick'), s = g.soldiers.filter(function (x) { return x.id === id; })[0];
          if (!S.available(g, s)) return;
          var i = chosen.indexOf(id);
          if (i >= 0) chosen.splice(i, 1); else if (chosen.length < size) chosen.push(id);
          draw();
        };
      });
      $('sq-cancel').onclick = UI.closeModal;
      $('sq-go').onclick = function () {
        UI.closeModal();
        launch(chosen.map(function (id) { return g.soldiers.filter(function (x) { return x.id === id; })[0]; }));
      };
    }
    draw();
  };

  UI.results = function (out, done) {
    var g = UI.g, m = out.mission, win = out.outcome === 'win';
    var lines = out.deaths.map(function (s) { return '<div class="bad">✝ ' + s.name + ' (KIA)</div>'; }).concat(out.promotions.map(function (s) {
      return '<div class="good">▲ ' + s.name + ' promoted to ' + S.rankName(s) + '</div>';
    }));
    UI.modal('<h1 class="' + (win ? 'good' : 'bad') + '">' + (win ? 'MISSION SUCCESS' : out.outcome === 'abort' ? 'SQUAD EXTRACTED' : 'MISSION FAILED') + '</h1>' +
      '<p>' + m.name + ' · ' + m.city + '</p>' +
      (win ? '<p>Recovered <b>' + out.salvage + '</b> salvage' + (out.credits ? ' and <b>§' + out.credits + '</b>' : '') + '. ' + St.regionData(m.region).name + ' infection ' + out.infection + '%.</p>'
        : '<p class="bad">' + St.regionData(m.region).name + ' infection +' + out.infection + '%. Convergence +2%.' + (m.kind !== 'purge' ? ' The objective remains; you can try again.' : '') + '</p>') +
      (lines.length ? lines.join('') : '<p class="dim">No casualties, no promotions.</p>') +
      '<div class="modal-actions"><button class="primary" id="res-ok">Return to Command</button></div>');
    $('res-ok').onclick = function () { UI.closeModal(); done(); };
  };

  return UI;
})();
