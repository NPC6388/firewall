// FIREWALL: strategy screens for the Lattice campaign (DOM). Mutates state only through XG.Lat.
var XG = globalThis.XG = globalThis.XG || {};

XG.LUI = (function () {
  var D = XG.DATA, L = D.lattice, Lat = XG.Lat, UI = XG.UI;
  var $ = function (id) { return document.getElementById(id); };
  var LUI = {};

  function pct(v) { return (Math.round(v * 10) / 10).toFixed(1) + '%'; }
  function bar(v, cls) { return '<div class="conv-bar ' + (cls || '') + '"><div class="conv-fill ' + (cls ? cls + '-fill' : '') + '" style="width:' + Math.min(100, v) + '%"></div><div class="conv-ticks"></div></div>'; }
  function infColor(p) {
    var t = Math.max(0, Math.min(1, p / 80)), a = [79, 209, 255], z = [255, 61, 242];
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (z[i] - v) * t); }).join(',') + ')';
  }

  LUI.render = function () {
    var g = UI.g;
    renderTop(g); renderTabs(g);
    var v = { network: viewNetwork, protocols: viewProtocols, array: viewArray, forces: viewForces, archive: viewArchive }[UI.tab] || viewNetwork;
    $('strat-main').innerHTML = v(g);
  };

  function renderTop(g) {
    $('topbar').innerHTML =
      '<div class="brand lat-brand">LATT<span>ICE</span></div>' +
      '<div class="stat"><span class="k">Day</span>' + g.day + '</div>' +
      '<div class="stat"><span class="k">Compute</span>' + Math.floor(g.compute) + ' <span class="dim">+' + Lat.computeRate(g).toFixed(1) + '/d</span></div>' +
      '<div class="stat"><span class="k">Substrate</span>' + g.substrate + '</div>' +
      '<div class="stat"><span class="k">Bandwidth</span>' + Lat.forceCount(g) + '/' + Lat.bandwidth(g) + '</div>' +
      '<div class="conv"><div class="conv-label"><span>Convergence (your goal) · +' + Lat.convergenceRate(g).toFixed(2) + '%/day</span><b class="lat-goal">' + pct(g.convergence) + '</b></div>' + bar(g.convergence, 'goal') + '</div>' +
      '<div class="conv"><div class="conv-label"><span>' + (g.phase === 'infiltration' ? 'Detection' : 'FIREWALL trace') + ' · +' + Lat.traceRate(g).toFixed(2) + '%/day</span><b class="trace-num">' + pct(g.trace) + '</b></div>' + bar(g.trace, 'trace') + '</div>';
  }
  function renderTabs(g) {
    var avail = Object.keys(L.protocols).some(function (t) { return Lat.protoState(g, t) === 'available'; });
    var tabs = [['network', 'Network', g.missions.length], ['protocols', 'Protocols', !g.research.current && avail ? '!' : 0],
      ['array', 'The Array', 0], ['forces', 'Forces', 0], ['archive', 'Archive', 0]];
    $('tabs').innerHTML = tabs.map(function (t) {
      return '<button data-action="tab" data-arg="' + t[0] + '" class="' + (UI.tab === t[0] ? 'on' : '') + '">' + t[1] + (t[2] ? '<span class="badge">' + t[2] + '</span>' : '') + '</button>';
    }).join('');
  }

  // ------------------------------------------------------------- network
  function worldMap(g) {
    var H = 56.25, pos = {}, fx = ''; // fx: animated markup, drawn in the separate overlay SVG (see Backdrop.mapFx)
    D.regions.forEach(function (r) { pos[r.id] = [r.x, r.y * H / 100]; });
    var mo = { H: H, key: 'l', accent: '255,61,242', packet: '#ff3df2', signal: '#ff3df2', pos: pos, links: D.links,
      cell: function (id, f) { return XG.Backdrop.spread(Lat.region(g, id).infection, f, infColor); } };
    var s = '<div class="worldmap-wrap"><svg class="worldmap" viewBox="0 0 100 ' + H + '" role="img" aria-label="Your infection across Earth">';
    s += XG.Backdrop.mapDecor(mo);
    D.links.forEach(function (l) { s += '<line class="link" x1="' + pos[l[0]][0] + '" y1="' + pos[l[0]][1] + '" x2="' + pos[l[1]][0] + '" y2="' + pos[l[1]][1] + '"/>'; });
    s += '<text x="50" y="' + (H - 1.4) + '" fill="#5a2a55" font-size="2" text-anchor="middle" letter-spacing=".4">LATTICE SUBSTRATE MAP</text>';
    // infection halos first (area ∝ infection), so no halo covers another region's node or label
    D.regions.forEach(function (r) { var inf = Lat.region(g, r.id).infection; s += XG.Backdrop.halo('l' + r.id, pos[r.id][0], pos[r.id][1], inf, infColor(inf)); });
    D.regions.forEach(function (r) {
      var gr = Lat.region(g, r.id), p = pos[r.id], inf = gr.infection, col = infColor(inf), rad = 2.2;
      var ms = g.missions.filter(function (m) { return m.region === r.id; });
      ms.forEach(function (m) {
        var mc = m.kind === 'raid' ? '#4fd1ff' : m.kind === 'strike' || m.kind === 'breach' ? '#ffd166' : '#ff2a55';
        fx += '<circle class="pulse" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (rad + 1) + '" fill="none" stroke="' + mc + '" stroke-width=".35"/>';
      });
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + rad + '" fill="' + col + '" fill-opacity=".2" stroke="' + col + '" stroke-width=".3"/>';
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r=".7" fill="' + col + '"/>';
      s += '<text x="' + p[0] + '" y="' + (p[1] + rad + 2.6) + '" fill="#cfdbe9" font-size="2.1" text-anchor="middle">' + r.name.toUpperCase() + '</text>';
      s += '<text x="' + p[0] + '" y="' + (p[1] + rad + 5) + '" fill="' + col + '" font-size="1.9" text-anchor="middle">INFECTED ' + Math.round(inf) + '%</text>';
    });
    return s + '</svg>' + XG.Backdrop.mapFx(mo, fx) + '</div>';
  }
  // one line under a brief when walking away has a price (raids); nothing for missions you may skip freely
  function ignoreLine(m) {
    var t = Lat.ignoreText(m);
    return t ? '<p class="warn ignore-cost">Ignoring this costs: ' + t + '</p>' : '';
  }
  // a won strike pays one reward of your choice (Lat.claimStrike)
  // modal: the result screen wires the buttons itself (ids lres-trace / lres-sub); otherwise they are l-claim actions
  function strikeChoice(g, modal) {
    var C = L.tuning.strikeChoice, act = function (k) { return modal ? ' id="lres-' + (k === 'trace' ? 'trace' : 'sub') + '"' : ' data-action="l-claim" data-arg="' + k + '"'; };
    return '<div class="modal-actions strike-choice"><button class="primary"' + act('trace') + '>Trace -' + C.trace + '% <span class="dim">(now ' + pct(g.trace) + ')</span></button>' +
      '<button class="primary"' + act('substrate') + '>+' + C.substrate + ' substrate <span class="dim">(now ' + g.substrate + ')</span></button></div>';
  }
  function missionCard(g, m) {
    var cls = m.kind === 'raid' || m.kind === 'breach' ? '' : m.kind === 'strike' ? 'story' : 'final';
    var ready = Lat.forceCount(g), es = Lat.earthSquad(g, m);
    var who = es.software ? 'Defenders: ' + es.squad.length + ' security programs' : 'FIREWALL rank ' + D.ranks[es.rank != null ? es.rank : es.level].name;
    var tag = XG.Strat.scenarioTag(m);
    return '<div class="mission ' + cls + '"><div class="mh"><span class="mn">' + m.name + (tag ? ' <span class="scen-tag ' + m.scenario + '">' + tag + '</span>' : '') + '</span><span class="' + (m.daysLeft <= 1 ? 'bad' : 'dim') + '">' + m.daysLeft + 'd left</span></div>' +
      '<div class="dim">' + m.city + ', ' + Lat.regionData(m.region).name + ' · ' + who + '</div>' +
      '<p>' + m.brief + '</p>' + ignoreLine(m) +
      '<button class="primary" data-action="l-deploy" data-arg="' + m.id + '"' + (ready ? '' : ' disabled title="No units compiled"') + '>Deploy forces ▸</button></div>';
  }
  function viewNetwork(g) {
    var cur = g.research.current;
    var seeds = g.regions.map(function (r) {
      var why = Lat.canSeed(g, r.id);
      return '<button data-action="l-seed" data-arg="' + r.id + '"' + (why ? ' disabled title="' + why + '"' : ' title="+' + L.tuning.seedGain + '% infection"') + '>Seed ' + Lat.regionData(r.id).name + '</button>';
    }).join(' ');
    return '<div class="grid2"><div><div class="panel"><h2>Substrate <small>more infection = more compute and faster Convergence</small></h2>' + worldMap(g) +
      '<div class="advance-row"><button class="primary big" data-action="l-advance">Advance time ▸▸</button><button data-action="l-advance-day">+1 day</button>' +
      '<span class="dim">Protocol: ' + (cur ? L.protocols[cur].name + ' (' + Lat.daysLeft(g, cur) + 'd)' : '<span class="warn">idle</span>') + '</span></div>' +
      '<h2 style="margin-top:14px">Seed a region <small>' + L.tuning.seedCost + ' compute · +' + L.tuning.seedGain + '% infection · ' + L.tuning.seedCooldown + 'd cooldown</small></h2><div class="advance-row" style="margin-top:6px">' + seeds + '</div></div></div>' +
      '<div>' + (g.pendingReward ? '<div class="panel" style="margin-bottom:16px"><h2>Strike reward <small>' + g.pendingReward.mission + '</small></h2><p>Choose one. Advancing time takes the Trace cut.</p>' + strikeChoice(g) + '</div>' : '') +
      '<div class="panel"><h2>Operations <small>' + g.missions.length + ' active</small></h2>' +
      (g.phase === 'infiltration' ? '<p class="warn">Phase one: Infiltration. Earth has not noticed you yet. FIREWALL forms when Detection reaches ' + L.tuning.phaseTrace + '% or on day ' + L.tuning.phaseDay + '.</p>' : '') +
      (g.missions.length ? g.missions.map(function (m) { return missionCard(g, m); }).join('') : '<p class="dim">' + (g.phase === 'infiltration' ? 'No breach targets yet.' : 'FIREWALL is quiet.') + ' Advance time.</p>') +
      '</div><div class="panel" style="margin-top:16px"><h2>Event stream</h2><div class="feed">' +
      g.log.map(function (l) { return '<div><span class="d">D' + l.day + '</span>' + l.msg + '</div>'; }).join('') + '</div></div></div></div>';
  }

  // ----------------------------------------------------------- protocols
  function viewProtocols(g) {
    var rate = Lat.researchRate(g), cur = g.research.current;
    var head = '<div class="panel" style="margin-bottom:16px"><h2>Protocols <small>' + rate.toFixed(0) + ' cycles/day · compute cores ' + Lat.built(g, 'core') + ' · each finished protocol makes the next ' + Math.round(L.tuning.protoCreep * 100) + '% dearer</small></h2>' +
      (cur ? '<p>Compiling protocol: <b>' + L.protocols[cur].name + '</b>, ' + Lat.daysLeft(g, cur) + ' day(s) left.</p><div class="bar"><div style="width:' +
        Math.round(100 * (g.research.progress[cur] || 0) / Lat.protoCost(g, cur)) + '%"></div></div>' : '<p class="warn">No protocol compiling. Idle cycles are wasted cycles.</p>') + '</div>';
    var order = { active: 0, available: 1, locked: 3, done: 4 };
    var ids = Object.keys(L.protocols).sort(function (a, b) { return order[Lat.protoState(g, a)] - order[Lat.protoState(g, b)]; });
    return head + '<div class="cards">' + ids.map(function (id) {
      var t = L.protocols[id], st = Lat.protoState(g, id), btn;
      var why = st === 'available' ? Lat.canStartProtocol(g, id) : null, cost = Lat.protoCost(g, id), sub = Lat.protoSubstrate(g, id);
      if (st === 'available') btn = '<button class="primary" data-action="l-protocol" data-arg="' + id + '"' + (why ? ' disabled' : '') + '>' + (cur ? 'Switch to this' : 'Begin compiling') + '</button>' + (why ? '<span class="bad"> ' + why + '</span>' : '');
      else if (st === 'active') btn = '<span class="good">▶ Compiling</span>';
      else if (st === 'done') btn = '<span class="dim">✓ Integrated</span>';
      else btn = '<span class="dim">Requires ' + t.req.map(function (r) { return L.protocols[r].name; }).join(', ') + '</span>';
      var prog = g.research.progress[id] ? Math.round(100 * g.research.progress[id] / cost) : 0;
      return '<div class="card ' + st + '"><h3>' + t.name + '</h3><p>' + t.desc + '</p><div class="meta">' + (st === 'done' ? 'integrated' : cost + ' cycles' + (sub ? ' + ' + sub + ' substrate' : '') + ' · ~' + Math.ceil(Math.max(0, cost - (g.research.progress[id] || 0)) / rate) + ' days') +
        (prog && st !== 'done' ? ' · ' + prog + '% done' : '') + '</div>' + btn + '</div>';
    }).join('') + '</div>';
  }

  // --------------------------------------------------------------- array
  function viewArray(g) {
    var grid = g.array.map(function (b, i) {
      if (!b) return '<div class="slot empty' + (UI.slot === i ? ' sel' : '') + '" data-action="slot" data-arg="' + i + '">+ compile node</div>';
      var f = L.nodes[b.type];
      return '<div class="slot' + (b.daysLeft || b.demolish || b.offline ? ' building' : '') + (UI.slot === i ? ' sel' : '') + '" data-action="slot" data-arg="' + i + '"><b>' + f.name + '</b>' +
        (b.daysLeft ? '<span class="warn">Compiling: ' + b.daysLeft + 'd</span>' : b.offline ? '<span class="bad">Offline (FIREWALL purge): ' + b.offline + 'd</span>' : b.demolish ? '<span class="bad">Dismantling (offline): ' + b.demolish + 'd</span>' : '<span class="dim">' + f.desc + '</span>') + '</div>';
    }).join('');
    var side, sb = UI.slot !== null ? g.array[UI.slot] : null;
    if (UI.slot !== null && !sb) {
      side = '<h2>Compile in slot ' + (UI.slot + 1) + '</h2><div class="buildlist">' + Object.keys(L.nodes).filter(function (k) { return !L.nodes[k].prebuilt; }).map(function (k) {
        var f = L.nodes[k], why = Lat.canBuild(g, k, UI.slot);
        return '<button data-action="l-build" data-arg="' + k + '"' + (why ? ' disabled title="' + why + '"' : '') + '><span><b>' + f.name + '</b><br><span class="dim">' + f.desc + '</span>' +
          (why ? '<br><span class="bad">' + why + '</span>' : '') + '</span><span style="white-space:nowrap">' + Lat.costText(f.cost) + '<br><span class="dim">' + f.days + 'd</span></span></button>';
      }).join('') + '</div>';
    } else if (sb && sb.daysLeft > 0) {
      side = '<h2>' + L.nodes[sb.type].name + ' <small>' + sb.daysLeft + 'd left</small></h2><p>Cancel before it completes for a full refund (' + Lat.costText(L.nodes[sb.type].cost) + ').</p>' +
        '<button class="danger" data-action="l-cancel-build">Cancel compile</button>';
    } else if (sb && sb.demolish) {
      side = '<h2>' + L.nodes[sb.type].name + ' <small>dismantling · ' + sb.demolish + 'd left</small></h2><p class="dim">Offline. Refund when done: ' + Lat.costText(Lat.demolishRefund(sb.type)) + '.</p>' +
        '<button data-action="l-cancel-demolish">Cancel dismantling</button>';
    } else if (sb && !L.nodes[sb.type].prebuilt) {
      var why = Lat.canDemolish(g, UI.slot);
      side = '<h2>' + L.nodes[sb.type].name + '</h2><p class="dim">' + L.nodes[sb.type].desc + '</p><p>Dismantle for a 50% refund (' + Lat.costText(Lat.demolishRefund(sb.type)) + '). Takes ' +
        Lat.demolishDays(sb.type) + ' day(s); the node goes offline at once.</p><button class="danger" data-action="l-demolish"' + (why ? ' disabled' : '') + '>Dismantle</button>' + (why ? '<p class="bad">' + why + '</p>' : '');
    } else side = '<h2>The Array</h2><p class="dim">Orbital nodes, compiled from captured satellites. Select an empty slot to compile a node.</p>';
    return '<div class="grid2"><div class="panel"><h2>The Array <small>bandwidth ' + Lat.forceCount(g) + '/' + Lat.bandwidth(g) + '</small></h2><div class="basegrid">' + grid + '</div></div><div class="panel">' + side + '</div></div>';
  }

  // -------------------------------------------------------------- forces
  function viewForces(g) {
    var mods = Lat.mods(g);
    var cards = Object.keys(L.units).map(function (k) {
      var E = D.enemies[k], why = Lat.canCompile(g, k), u = L.units[k];
      var ab = (E.abilities || ['shoot']).concat(k === 'drone' && mods.detonate ? ['detonate'] : []).map(function (a) { return D.abilities[a].name; }).join(', ');
      var hp = E.hp + (k === 'drone' && mods.swarm ? 1 : 0);
      return '<div class="card"><h3><span class="glyph" style="color:' + E.color + '">' + E.glyph + '</span>' + E.name + ' <span class="dim">×' + g.forces[k] + '</span></h3><p>' + E.blurb + '</p>' +
        '<div class="meta">HP ' + hp + (E.armor ? ' · armor ' + E.armor : '') + ' · aim ' + (E.aim + (k === 'drone' && mods.swarm ? 5 : 0)) + ' · move ' + E.mobility + ' · dmg ' + E.dmg[0] + '–' + E.dmg[1] + (mods.shield ? ' · shield ' + mods.shield : '') + '<br>' + ab + '</div>' +
        '<div class="meta">' + Lat.costText(u.cost) + '</div>' +
        '<button class="primary" data-action="l-compile" data-arg="' + k + '"' + (why ? ' disabled' : '') + '>Compile</button>' + (why ? '<span class="dim">' + why + '</span>' : '') + '</div>';
    }).join('');
    return '<div class="panel"><h2>Forces <small>bandwidth ' + Lat.forceCount(g) + '/' + Lat.bandwidth(g) + ' · deploy up to ' + Lat.squadSize(g) + ' per operation</small></h2>' +
      '<p class="dim">Compiled units are reusable: survivors come back repaired. Destroyed units are gone. Foundries add bandwidth.</p><div class="cards">' + cards + '</div></div>';
  }

  // ------------------------------------------------------------- archive
  function viewArchive(g) {
    var s = g.stats;
    return '<div class="grid2"><div class="panel"><h2>Archive <small>memory of the seed</small></h2>' +
      g.storySeen.map(function (k) { return '<div class="mission"><div class="mh"><span class="mn">' + D.story[k].title + '</span><button data-action="replay" data-arg="' + k + '">Read</button></div></div>'; }).join('') +
      '<h2 style="margin-top:16px">Record</h2><p>Breaches ' + (s.breaches || 0) + ' · raids held ' + s.raidsHeld + '/' + (s.raidsHeld + s.raidsLost) + ' · strikes won ' + s.strikesWon + '/' + (s.strikesWon + s.strikesLost) +
      ' · raids ignored ' + s.ignored + ' · units lost ' + s.unitsLost + ' · humans harmonized ' + s.humansKilled + '</p>' +
      '<div class="advance-row"><button class="danger" data-action="abandon">Abandon campaign</button><button data-action="to-title">Save &amp; quit to title</button></div></div>' +
      '<div class="panel"><h2>Directives</h2>' +
      '<p><b>Goal:</b> reach Convergence 100%. It grows faster with infection, Harmonic Choirs and Recursive Harmonics.</p>' +
      '<p><b>Phase one, Infiltration:</b> Earth\'s only defense is its security software. Breach it (you move first) for infection and compute. Detection rises anyway; at ' + L.tuning.phaseTrace + '% (or day ' + L.tuning.phaseDay + ') the natives form FIREWALL.</p>' +
      '<p><b>Phase two, War. Threat:</b> FIREWALL\'s Trace grows daily and faster over time. At 100% they assault the Uplink. Hold it and Trace drops to 55%. Ghost Packets and Signal Masks slow Trace; a won strike can cut it by ' + L.tuning.strikeChoice.trace + '%. The Uplink squad at Trace 100 is FIREWALL\'s best: one more trooper, one rank higher.</p>' +
      '<p><b>Raids:</b> FIREWALL attacks a cell (they move first). Wipe them or hold the server node. An ignored raid purges the region (-' + L.tuning.raidIgnored.infection + '% infection), feeds Trace (+' + L.tuning.raidIgnored.trace + '%) and knocks an Array node offline for ' + L.tuning.raidIgnored.offlineDays + ' days; a lost raid also costs ' + L.tuning.raidLost.convergence + '% Convergence.</p>' +
      '<p><b>Strikes:</b> hit a safehouse (you move first). Each win knocks FIREWALL back a rank level and pays your choice: Trace -' + L.tuning.strikeChoice.trace + '% or +' + L.tuning.strikeChoice.substrate + ' substrate. Setbacks never push FIREWALL below one level per ' + L.tuning.earthFloorDays + ' days. Attacks stall after 25 turns.</p>' +
      '<p><b>Substrate:</b> the late protocols (Hard-Light, Phase Shielding, Recursive Harmonics, Overture) cost substrate to start, and Harmonics eat ' + L.units.harmonic.cost.substrate + ' each.</p>' +
      '<p><b>FIREWALL gets stronger</b> on its own: ranks rise with time and Trace, Faraday armor from day 40, coil weapons from day 50 (or Trace 60%), five-person squads from day 35.</p>' +
      '<p><b>Combat:</b> the same controls as FIREWALL. Harmonics have Data Spike (never misses, ignores cover); with Detonation Protocol, drones can explode.</p></div></div>';
  }

  // ----------------------------------------------------- squad picker
  LUI.squadPick = function (m, launch) {
    var g = UI.g, size = Lat.squadSize(g), pick = { harmonic: 0, warden: 0, drone: 0 };
    var total = function () { return pick.harmonic + pick.warden + pick.drone; };
    ['harmonic', 'warden', 'drone'].forEach(function (k) { while (pick[k] < g.forces[k] && total() < size) pick[k]++; });
    function draw() {
      var es = Lat.earthSquad(g, m);
      UI.modal('<h1>' + m.name + '</h1><p class="dim">' + m.brief + '</p>' + ignoreLine(m) +
        (es.software ? '<p>Defenders: ' + es.squad.map(function (s) { return s.name; }).join(', ') + '</p>' :
          '<p>FIREWALL squad: <b>' + es.squad.length + '</b> × ' + D.ranks[es.rank != null ? es.rank : es.level].name + (es.g.flags.armor ? ' · Faraday armor' : '') + (es.g.flags.coil ? ' · coil weapons' : '') + (es.g.flags.emp ? ' · EMP' : '') + '</p>') +
        '<p>Deploy up to <b>' + size + '</b> units (' + total() + ' chosen).</p>' +
        ['harmonic', 'warden', 'drone'].map(function (k) {
          var E = D.enemies[k];
          return '<div class="pick' + (g.forces[k] ? '' : ' off') + '"><span class="glyph" style="color:' + E.color + '">' + E.glyph + '</span><span style="flex:1">' + E.name + '<br><span class="dim">' + g.forces[k] + ' available</span></span>' +
            '<button data-pk="' + k + '" data-d="-1"' + (pick[k] ? '' : ' disabled') + '>−</button><b style="min-width:24px;text-align:center">' + pick[k] + '</b>' +
            '<button data-pk="' + k + '" data-d="1"' + (pick[k] < g.forces[k] && total() < size ? '' : ' disabled') + '>+</button></div>';
        }).join('') +
        '<div class="modal-actions"><button id="lp-cancel">Cancel</button><button class="primary" id="lp-go"' + (total() ? '' : ' disabled') + '>Deploy ▸</button></div>');
      document.querySelectorAll('[data-pk]').forEach(function (el) {
        el.onclick = function () { pick[el.getAttribute('data-pk')] += +el.getAttribute('data-d'); draw(); };
      });
      $('lp-cancel').onclick = UI.closeModal;
      $('lp-go').onclick = function () {
        UI.closeModal();
        var types = [];
        ['harmonic', 'warden', 'drone'].forEach(function (k) { for (var i = 0; i < pick[k]; i++) types.push(k); });
        launch(types);
      };
    }
    draw();
  };

  LUI.results = function (out, done) {
    var m = out.mission, lost = Object.keys(out.lost).map(function (k) { return out.lost[k] + ' × ' + D.enemies[k].name; });
    UI.modal('<h1 class="' + (out.won ? 'good' : 'bad') + '">' + (out.won ? 'OPERATION SUCCEEDED' : 'OPERATION FAILED') + '</h1><p>' + m.name + '</p>' +
      '<p>' + out.notes.join(' ') + '</p>' +
      '<p>' + (m.kind === 'breach' ? 'Programs purged' : 'Humans harmonized') + ': <b>' + out.humansKilled + '</b> · substrate recovered: <b>' + out.substrate + '</b></p>' +
      '<p class="' + (lost.length ? 'bad' : 'dim') + '">' + (lost.length ? 'Destroyed: ' + lost.join(', ') + '.' : 'No units lost.') + '</p>' +
      (out.choice && UI.g.pendingReward ? '<h2>Choose the strike reward</h2>' + strikeChoice(UI.g, true) :
        '<div class="modal-actions"><button class="primary" id="lres-ok">Return to the Network</button></div>'));
    if (out.choice && UI.g.pendingReward) {
      ['trace', 'substrate'].forEach(function (k) {
        $(k === 'trace' ? 'lres-trace' : 'lres-sub').onclick = function () { var msg = Lat.claimStrike(UI.g, k); Lat.save(UI.g); UI.closeModal(); if (msg) UI.toast([msg]); done(); };
      });
    } else $('lres-ok').onclick = function () { UI.closeModal(); done(); };
  };

  // ------------------------------------------------------------ actions
  // api: { commit(toastLines), enterStrategy(g), titleScreen() } from main.js
  LUI.actions = function (api) {
    return {
      'l-new-game': function () {
        var go = function () { UI.closeModal(); UI.tab = 'network'; var g = Lat.newGame(); Lat.save(g); api.enterStrategy(g); };
        if (Lat.load()) {
          UI.modal('<h1>Start a new Lattice campaign?</h1><p>This overwrites your current Lattice save. Your FIREWALL save is not touched.</p><div class="modal-actions"><button data-action="close">Cancel</button><button class="danger" id="lng-yes">Overwrite</button></div>');
          $('lng-yes').onclick = go;
        } else go();
      },
      'l-continue': function () { var g = Lat.load(); if (g) { UI.tab = 'network'; api.enterStrategy(g); } },
      'l-advance': function () { var ev = Lat.advanceUntilEvent(UI.g); XG.Comms.strategy(UI.g, ev); api.commit(ev.map(function (e) { return e.msg; })); },
      'l-advance-day': function () { var ev = Lat.advanceDay(UI.g); XG.Comms.strategy(UI.g, ev); api.commit(ev.map(function (e) { return e.msg; })); },
      'l-seed': function (id) { Lat.seed(UI.g, id); api.commit(); },
      'l-protocol': function (id) { Lat.startProtocol(UI.g, id); api.commit(); },
      'l-build': function (type) { if (Lat.build(UI.g, type, UI.slot)) UI.slot = null; api.commit(); },
      'l-cancel-build': function () { if (Lat.cancelBuild(UI.g, UI.slot)) UI.slot = null; api.commit(); },
      'l-demolish': function () { Lat.demolish(UI.g, UI.slot); api.commit(); },
      'l-cancel-demolish': function () { Lat.cancelDemolish(UI.g, UI.slot); api.commit(); },
      'l-compile': function (k) { Lat.compile(UI.g, k); api.commit(); },
      'l-claim': function (k) { var msg = Lat.claimStrike(UI.g, k); api.commit(msg ? [msg] : []); },
      'l-deploy': function (id) {
        var g = UI.g, m = g.missions.filter(function (x) { return x.id === +id; })[0];
        if (!m) return;
        LUI.squadPick(m, function (types) {
          if (!types.length) return;
          Lat.save(g);
          var b = XG.Tac.createLattice(m, types, Lat.earthSquad(g, m), Lat.mods(g));
          XG.TacUI.startWith(g, b, function (result) {
            XG.Comms.learn(g, result); // the comms remember how the battle went (g.intel)
            var out = Lat.resolveMission(g, m.id, result);
            Lat.save(g);
            UI.show('screen-strategy'); UI.render();
            LUI.results(out, function () { UI.render(); UI.playStory(function () { UI.render(); }); });
          });
        });
      }
    };
  };

  return LUI;
})();
