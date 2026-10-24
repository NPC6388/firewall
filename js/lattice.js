// FIREWALL: the Lattice campaign rules (play the alien AI vs. an AI-run FIREWALL). No DOM.
var XG = globalThis.XG = globalThis.XG || {};

XG.Lat = (function () {
  var D = XG.DATA, L = D.lattice, S = XG.State;

  function has(g, id) { return g.research.done.indexOf(id) >= 0; }
  function built(g, type) {
    return g.array.filter(function (b) { return b && b.type === type && b.daysLeft === 0 && !b.demolish && !b.offline; }).length;
  }
  function region(g, id) { return g.regions.filter(function (r) { return r.id === id; })[0]; }
  function regionData(id) { return D.regions.filter(function (r) { return r.id === id; })[0]; }
  function canPay(g, c) { return g.compute >= (c.compute || 0) && g.substrate >= (c.substrate || 0); }
  function pay(g, c) { g.compute -= c.compute || 0; g.substrate -= c.substrate || 0; }
  function costText(c) {
    var p = [(c.compute || 0) + ' compute'];
    if (c.substrate) p.push(c.substrate + ' substrate');
    return p.join(' + ');
  }
  function log(g, msg) { g.log.unshift({ day: g.day, msg: msg }); if (g.log.length > 80) g.log.length = 80; }
  function rng(g) { var r = new XG.RNG(1); r.s = g.rngState; return r; }

  var Lat = {
    SAVE_KEY: 'firewall-lattice-save-v1',
    has: has, built: built, region: region, regionData: regionData, costText: costText,
    // FIREWALL's 'loss' (wiped, or the Lattice captured the server in a strike) is your win. A timeout only counts for the side
    // that defends: you, in a raid (legacy hold-out or node scenario). Strikes and breaches that run out the clock are lost, and
    // an exterminate battle has no clock. scenario is optional (the rule does not depend on it).
    latticeWon: function (kind, outcome, scenario) { return outcome === 'loss' || (outcome === 'timeout' && kind === 'raid' && scenario !== 'exterminate'); },
    newGame: function (seed) {
      seed = seed || (Date.now() & 0x7fffffff);
      var r = new XG.RNG(seed);
      var g = {
        faction: 'lattice', version: 1, seed: seed, rngState: 0, day: 1,
        compute: L.start.compute, substrate: L.start.substrate, convergence: L.start.convergence, trace: L.start.trace,
        regions: D.regions.map(function (x) { return { id: x.id, infection: r.int(10, 24), seedCd: 0 }; }),
        array: [], forces: Object.assign({}, L.start.forces),
        research: { current: null, progress: {}, done: [] },
        phase: 'infiltration', missions: [], nextBreachIn: 1, nextRaidIn: 2, nextStrikeIn: r.int(4, 6), nextMissionId: 1,
        earth: { setbacks: 0 }, flags: {},
        storyQueue: ['l_intro'], storySeen: [], log: [],
        stats: { breaches: 0, raidsHeld: 0, raidsLost: 0, strikesWon: 0, strikesLost: 0, ignored: 0, unitsLost: 0, humansKilled: 0 },
        over: null
      };
      for (var i = 0; i < 12; i++) g.array.push(null);
      g.array[0] = { type: 'nexus', daysLeft: 0 };
      g.rngState = r.s;
      log(g, 'Seed unpacked. The Nexus is online.');
      return g;
    },
    save: function (g) { try { localStorage.setItem(Lat.SAVE_KEY, JSON.stringify(g)); return true; } catch (e) { return false; } },
    load: function () { try { var raw = localStorage.getItem(Lat.SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    clear: function () { try { localStorage.removeItem(Lat.SAVE_KEY); } catch (e) { /* ignore */ } },

    // ------------------------------------------------------------ rates
    bandwidth: function (g) { return 8 + 4 * built(g, 'foundry'); },
    forceCount: function (g) { return Object.keys(g.forces).reduce(function (a, k) { return a + g.forces[k]; }, 0); },
    squadSize: function (g) { return L.tuning.squadSize + (has(g, 'swarm_mind') ? 1 : 0); },
    researchRate: function (g) { return L.tuning.researchBase * (1 + 0.4 * built(g, 'core')); },
    infectionSum: function (g) { return g.regions.reduce(function (a, r) { return a + r.infection; }, 0); },
    computeRate: function (g) { return L.tuning.computeBase + Lat.infectionSum(g) * L.tuning.computePerInfection; },
    convergenceRate: function (g) {
      var T = L.tuning, rate = T.convBase + Lat.infectionSum(g) * T.convPerInfection + T.choirBonus * built(g, 'choir');
      return rate * (has(g, 'recursive') ? 1.25 : 1);
    },
    traceRate: function (g) {
      var T = L.tuning, m = (has(g, 'ghost_packets') ? 0.7 : 1) * Math.max(0.3, 1 - 0.15 * built(g, 'mask'));
      return (T.traceBase + T.traceRamp * g.day) * m;
    },
    spreadMult: function (g) { return (has(g, 'seed_cascade') ? 1.4 : 1) * (1 + 0.25 * built(g, 'spire')); },
    mods: function (g) {
      return { swarm: has(g, 'swarm_logic'), detonate: has(g, 'detonation'), shield: has(g, 'phase_shield') ? 2 : 0, spikeBonus: has(g, 'overture') ? 2 : 0 };
    },

    // ---------------------------------------------------------- protocols
    protoState: function (g, id) {
      var t = L.protocols[id];
      if (has(g, id)) return 'done';
      if (g.research.current === id) return 'active';
      for (var i = 0; i < t.req.length; i++) if (!has(g, t.req[i])) return 'locked';
      return 'available';
    },
    // cycles needed: each finished protocol makes the next one protoCreep (8%) dearer
    protoCost: function (g, id) { return Math.round(L.protocols[id].cost * (1 + (L.tuning.protoCreep || 0) * g.research.done.length)); },
    // substrate is paid once, the first time a protocol starts (switching back later is free)
    protoSubstrate: function (g, id) { return (g.research.paid || {})[id] ? 0 : L.protocols[id].substrate || 0; },
    canStartProtocol: function (g, id) {
      if (Lat.protoState(g, id) !== 'available') return 'Not available';
      var s = Lat.protoSubstrate(g, id);
      if (g.substrate < s) return 'Need ' + s + ' substrate';
      return null;
    },
    startProtocol: function (g, id) {
      if (Lat.canStartProtocol(g, id)) return false;
      var s = Lat.protoSubstrate(g, id);
      if (s) { g.substrate -= s; g.research.paid = g.research.paid || {}; g.research.paid[id] = true; }
      g.research.current = id; return true;
    },
    daysLeft: function (g, id) {
      return Math.max(1, Math.ceil((Lat.protoCost(g, id) - (g.research.progress[id] || 0)) / Lat.researchRate(g)));
    },

    // -------------------------------------------------------------- array
    canBuild: function (g, type, slot) {
      var f = L.nodes[type];
      if (g.array[slot]) return 'Slot occupied';
      if (f.prebuilt) return 'Cannot build';
      if (!canPay(g, f.cost)) return 'Need ' + costText(f.cost);
      return null;
    },
    build: function (g, type, slot) {
      if (Lat.canBuild(g, type, slot)) return false;
      pay(g, L.nodes[type].cost);
      g.array[slot] = { type: type, daysLeft: L.nodes[type].days };
      log(g, 'Compiling node: ' + L.nodes[type].name + '.');
      return true;
    },
    cancelBuild: function (g, slot) {
      var b = g.array[slot];
      if (!b || b.daysLeft <= 0) return false;
      var c = L.nodes[b.type].cost;
      g.compute += c.compute || 0; g.substrate += c.substrate || 0; g.array[slot] = null;
      log(g, 'Node compile cancelled: ' + L.nodes[b.type].name + ' (refunded ' + costText(c) + ').');
      return true;
    },
    demolishRefund: function (type) {
      var c = L.nodes[type].cost;
      return { compute: Math.floor((c.compute || 0) / 2), substrate: Math.floor((c.substrate || 0) / 2) };
    },
    demolishDays: function (type) { return Math.max(1, Math.ceil(L.nodes[type].days / 2)); },
    canDemolish: function (g, slot) {
      var b = g.array[slot];
      if (!b || b.daysLeft > 0 || b.demolish) return 'Nothing to dismantle';
      if (L.nodes[b.type].prebuilt) return 'The Nexus cannot be dismantled';
      if (b.type === 'foundry' && Lat.forceCount(g) > Lat.bandwidth(g) - 4) return 'Your forces need this bandwidth';
      return null;
    },
    demolish: function (g, slot) {
      if (Lat.canDemolish(g, slot)) return false;
      var b = g.array[slot]; b.demolish = Lat.demolishDays(b.type);
      log(g, 'Dismantling ' + L.nodes[b.type].name + ' (' + b.demolish + 'd).');
      return true;
    },
    cancelDemolish: function (g, slot) {
      var b = g.array[slot]; if (!b || !b.demolish) return false;
      delete b.demolish; log(g, 'Dismantling cancelled: ' + L.nodes[b.type].name + ' is back online.');
      return true;
    },

    // ------------------------------------------------------------- forces
    canCompile: function (g, type) {
      var u = L.units[type];
      if (u.tech && !has(g, u.tech)) return 'Requires ' + L.protocols[u.tech].name;
      if (Lat.forceCount(g) >= Lat.bandwidth(g)) return 'No bandwidth left (build a Foundry)';
      if (!canPay(g, u.cost)) return 'Need ' + costText(u.cost);
      return null;
    },
    compile: function (g, type) {
      if (Lat.canCompile(g, type)) return false;
      pay(g, L.units[type].cost); g.forces[type]++;
      log(g, 'Compiled a ' + D.enemies[type].name + '.');
      return true;
    },

    // ---------------------------------------------------------------- seed
    canSeed: function (g, id) {
      var r = region(g, id);
      if (r.seedCd > 0) return 'Seeded recently (' + r.seedCd + 'd)';
      if (r.infection >= 100) return 'Fully infected';
      if (g.compute < L.tuning.seedCost) return 'Need ' + L.tuning.seedCost + ' compute';
      return null;
    },
    seed: function (g, id) {
      if (Lat.canSeed(g, id)) return false;
      var r = region(g, id);
      g.compute -= L.tuning.seedCost; r.infection = Math.min(100, r.infection + L.tuning.seedGain); r.seedCd = L.tuning.seedCooldown;
      log(g, 'Seeded ' + regionData(id).name + ': infection +' + L.tuning.seedGain + '%.');
      return true;
    },

    // ------------------------------------------------------- the AI FIREWALL
    earthLevel: function (g) {
      // strikes set FIREWALL back, but never below a baseline that rises with time (earthFloorDays): they buy time, not a lead
      var lvl = Math.floor((g.day - 1) / 18) + Math.floor(g.trace / 50) - g.earth.setbacks;
      return Math.min(5, Math.max(Math.floor((g.day - 1) / (L.tuning.earthFloorDays || 30)), lvl));
    },
    earthFlags: function (g) {
      return { coil: g.day >= 50 || g.trace >= 60, armor: g.day >= 40, emp: g.day >= 60 };
    },
    earthSquad: function (g, m) {
      if (m.kind === 'breach') {
        // Infiltration: the defenders are Earth's own security software
        var kinds = ['firewall_sw', 'antivirus', 'ids', 'antivirus'].slice(0, g.day >= 7 ? 4 : 3);
        return { g: { flags: {} }, software: true, level: 0,
          squad: kinds.map(function (k, i) { return { id: -(i + 1), sw: k, name: D.software[k].name }; }) };
      }
      var r = new XG.RNG(m.seed + 99), lvl = Lat.earthLevel(g), up = m.kind === 'uplink';
      // Trace 100 calls FIREWALL's best: the Uplink squad brings uplinkExtra and fights uplinkRank ranks higher
      // (your machines keep the mark of lvl, so the rank gap is real)
      var rank = up ? Math.min(5, lvl + (L.tuning.uplinkRank || 0)) : lvl;
      var list = up ? L.earthSquad.concat(L.tuning.uplinkExtra || []) : L.earthSquad.slice(0, g.day >= 35 ? 5 : 4);
      var fg = { flags: Lat.earthFlags(g) }, xp = D.ranks[rank].xp;
      var squad = list.map(function (cls, i) {
        var s = { id: -(i + 1), cls: cls, xp: xp, aimRoll: r.int(-3, 3), hp: 1,
          name: cls === 'sentinel' ? D.sentinelNames[0] : r.pick(D.firstNames) + ' "' + r.pick(D.callsigns) + '" ' + r.pick(D.lastNames) };
        s.hp = S.stats(fg, s).maxHp;
        return s;
      });
      return { g: fg, squad: squad, level: lvl, rank: rank };
    },

    // ----------------------------------------------------------- missions
    // the one-line "Ignoring this costs: ..." for a mission brief, or '' when walking away is free
    ignoreText: function (m) {
      var SI = L.tuning.strikeIgnored || {};
      if (m.kind === 'strike') return SI.trace ? 'Trace +' + SI.trace + '% (the safehouse finishes its traffic analysis).' : '';
      if (m.kind !== 'raid') return '';
      var T = L.tuning.raidIgnored;
      return Lat.regionData(m.region).name + ' infection -' + T.infection + '%, Trace +' + T.trace + '%, and one Array node offline for ' + T.offlineDays + ' days.';
    },
    spawnMission: function (g, r, kind) {
      var id;
      if (kind === 'uplink') id = 'oc';
      else if (kind === 'raid') {
        // FIREWALL hits where you're loudest
        var tot = g.regions.reduce(function (a, x) { return a + x.infection + 5; }, 0), roll = r.next() * tot;
        for (var i = 0; i < g.regions.length && !id; i++) { roll -= g.regions[i].infection + 5; if (roll <= 0) id = g.regions[i].id; }
        id = id || g.regions[0].id;
      } else id = r.pick(g.regions).id;
      var rd = regionData(id), city = r.pick(rd.cities);
      var m = { id: g.nextMissionId++, kind: kind, region: id, city: city, seed: r.int(1, 2147483646), daysLeft: null };
      if (kind === 'breach') {
        m.site = r.pick(D.sites); m.name = 'Breach: ' + city + ' ' + m.site; m.daysLeft = L.tuning.breachLife;
        m.brief = 'Earth\'s security software guards a ' + m.site + ': firewalls, antivirus, intrusion detection. You move first; 25-turn limit. Purge it: region infection +8%, +10 compute, Detection +2% (+4% if you fail).';
      } else if (kind === 'raid') {
        m.name = 'FIREWALL raid: ' + city; m.site = r.pick(D.sites); m.daysLeft = L.tuning.raidLife;
        m.scenario = XG.Strat.rollScenario(m.seed);
        m.brief = 'A FIREWALL squad is purging your cell in a ' + m.site + '. Your units start on overwatch. ' + (m.scenario === 'node'
          ? 'Hold your server node for ' + XG.Strat.nodeTurnsFor(m, 'raid') + ' turns' + (XG.Strat.rollOutside(m.seed, m.scenario) ? ', from inside the building' : '') + ': FIREWALL captures it by ending ' + D.tuning.nodeCapture + ' of its turns beside it with none of yours there. Wiping them also wins.'
          : 'Exterminate: wipe them. No time limit, to the death.') + ' Losing it costs ' + L.tuning.raidLost.infection + '% infection, Trace +' + L.tuning.raidLost.trace + '% and Convergence -' + L.tuning.raidLost.convergence + '%.';
        m.ignore = Lat.ignoreText(m);
      } else if (kind === 'strike') {
        m.name = 'Strike: ' + city + ' safehouse'; m.site = 'FIREWALL safehouse'; m.daysLeft = L.tuning.strikeLife;
        m.scenario = XG.Strat.rollScenario(m.seed);
        m.brief = 'HALCYON\'s traffic leaks from a FIREWALL safehouse. You move first. ' + (m.scenario === 'node'
          ? 'Capture its server node' + (XG.Strat.rollOutside(m.seed, m.scenario) ? ' (inside a building: cross the yard first)' : '') + ' within ' + XG.Strat.nodeTurnsFor(m, 'strike') + ' turns: end ' + D.tuning.nodeCapture + ' of your turns beside it with no FIREWALL unit there (or wipe the squad).'
          : 'Exterminate: wipe the squad. No time limit.') + ' Win: FIREWALL loses a step, and you choose Trace -' + L.tuning.strikeChoice.trace + '% or +' + L.tuning.strikeChoice.substrate + ' substrate.';
      } else {
        m.name = 'Hold the Uplink'; m.city = 'Pacific cable landing station'; m.site = 'cable landing station'; m.daysLeft = 2;
        m.brief = 'FIREWALL\'s best squad assaults the Uplink Core. Keep the core alive: wipe the squad. Your units start on overwatch, and the core compiles drones every other turn.';
      }
      g.missions.push(m);
      return m;
    },

    // ------------------------------------------------------------- clock
    advanceDay: function (g) {
      if (g.over) return [];
      var ev = [], r = rng(g), T = L.tuning;
      if (g.pendingReward) Lat.claimStrike(g, 'trace'); // an unclaimed strike reward defaults to the Trace cut
      g.day++;
      g.compute += Lat.computeRate(g);

      var cur = g.research.current;
      if (cur) {
        g.research.progress[cur] = (g.research.progress[cur] || 0) + Lat.researchRate(g);
        if (g.research.progress[cur] >= Lat.protoCost(g, cur)) {
          g.research.done.push(cur); g.research.current = null;
          ev.push({ type: 'research', msg: 'Protocol complete: ' + L.protocols[cur].name });
          log(g, 'Protocol complete: ' + L.protocols[cur].name + '.');
          if (L.protocols[cur].story) g.storyQueue.push(L.protocols[cur].story);
          if (cur === 'overture') g.convergence = Math.min(100, g.convergence + 10);
        }
      }

      g.array.forEach(function (b, i) {
        if (b && b.offline > 0 && --b.offline === 0) {
          delete b.offline;
          ev.push({ type: 'build', msg: 'Node back online: ' + L.nodes[b.type].name }); log(g, 'Node back online: ' + L.nodes[b.type].name + '.');
        }
        if (b && b.daysLeft > 0 && --b.daysLeft === 0) {
          ev.push({ type: 'build', msg: 'Node online: ' + L.nodes[b.type].name }); log(g, 'Node online: ' + L.nodes[b.type].name + '.');
        }
        if (b && b.demolish > 0 && --b.demolish === 0) {
          var ref = Lat.demolishRefund(b.type);
          g.compute += ref.compute; g.substrate += ref.substrate; g.array[i] = null;
          ev.push({ type: 'build', msg: 'Dismantled: ' + L.nodes[b.type].name + ' (refunded ' + costText(ref) + ')' });
          log(g, 'Dismantled ' + L.nodes[b.type].name + '. Refunded ' + costText(ref) + '.');
        }
      });

      var spread = T.infectionDrift * Lat.spreadMult(g);
      g.regions.forEach(function (x) {
        if (x.seedCd > 0) x.seedCd--;
        x.infection = Math.min(100, x.infection + spread * (0.5 + r.next()));
      });
      g.convergence = Math.min(100, g.convergence + Lat.convergenceRate(g));

      var uplinkPending = g.missions.some(function (m) { return m.kind === 'uplink'; }), before = g.trace;
      if (!uplinkPending) g.trace = Math.min(100, g.trace + Lat.traceRate(g));
      [50, 75].forEach(function (th) { if (before < th && g.trace >= th) g.storyQueue.push('l_trace' + th); });
      if (!uplinkPending && g.trace >= 100) {
        Lat.spawnMission(g, r, 'uplink');
        g.storyQueue.push('l_found');
        ev.push({ type: 'mission', msg: 'FIREWALL has found the Uplink!' });
        log(g, 'TRACE 100%. FIREWALL is moving on the Uplink.');
      }

      g.missions = g.missions.filter(function (m) {
        if (m.daysLeft === null || --m.daysLeft > 0) return true;
        if (m.kind === 'raid') {
          var reg = region(g, m.region);
          reg.infection = Math.max(0, reg.infection - T.raidIgnored.infection); g.trace = Math.min(100, g.trace + T.raidIgnored.trace);
          g.stats.ignored++;
          var dark = Lat.knockOffline(g, r, T.raidIgnored.offlineDays);
          ev.push({ type: 'expire', msg: m.name + ' went unanswered. ' + regionData(m.region).name + ' purged.' + (dark ? ' ' + dark + ' offline.' : '') });
          log(g, 'Unanswered raid in ' + m.city + ': infection -' + T.raidIgnored.infection + '%, Trace +' + T.raidIgnored.trace + '%' +
            (dark ? ', ' + dark + ' offline for ' + T.raidIgnored.offlineDays + ' days' : '') + '.');
        } else if (m.kind === 'breach') {
          log(g, 'The ' + m.city + ' systems patched themselves before you breached them.');
        } else if (m.kind === 'strike') {
          var SI = T.strikeIgnored || {};
          if (SI.trace) g.trace = Math.min(100, g.trace + SI.trace);
          log(g, 'The ' + m.city + ' safehouse went dark before you struck.' + (SI.trace ? ' Its traffic analysis reached FIREWALL: Trace +' + SI.trace + '%.' : ''));
        } else if (!g.over) {
          g.over = 'defeat'; g.storyQueue.push('l_defeat');
          log(g, 'The Uplink fell undefended.');
        }
        return false;
      });

      if (g.phase === 'infiltration') {
        if (--g.nextBreachIn <= 0) {
          var m0 = Lat.spawnMission(g, r, 'breach'); g.nextBreachIn = r.int(T.breachEvery[0], T.breachEvery[1]);
          ev.push({ type: 'mission', msg: 'Breach target: ' + m0.city }); log(g, 'Breach target found: ' + m0.city + ' (' + m0.site + ').');
        }
        if (g.trace >= T.phaseTrace || g.day >= T.phaseDay) {
          // the natives notice: the human FIREWALL cell forms and the war begins
          g.phase = 'war'; g.nextRaidIn = 2; g.nextStrikeIn = r.int(4, 6);
          g.storyQueue.push('l_firewall');
          ev.push({ type: 'mission', msg: 'The natives have formed FIREWALL' });
          log(g, 'Detection ' + Math.round(g.trace) + '%. The natives have formed a cell: FIREWALL.');
        }
      } else {
        if (--g.nextRaidIn <= 0) {
          var m1 = Lat.spawnMission(g, r, 'raid'); g.nextRaidIn = r.int(T.raidEvery[0], T.raidEvery[1]);
          ev.push({ type: 'mission', msg: m1.name }); log(g, 'Incoming: ' + m1.name + '.');
        }
        if (--g.nextStrikeIn <= 0) {
          var m2 = Lat.spawnMission(g, r, 'strike'); g.nextStrikeIn = r.int(T.strikeEvery[0], T.strikeEvery[1]);
          ev.push({ type: 'mission', msg: 'Target found: ' + m2.city + ' safehouse' }); log(g, 'Target found: FIREWALL safehouse in ' + m2.city + '.');
        }
      }

      if (g.convergence >= 100 && !g.over) { g.over = 'victory'; g.storyQueue.push('l_victory'); ev.push({ type: 'end', msg: 'Convergence complete.' }); }
      g.rngState = r.s;
      return ev;
    },
    // an unanswered raid knocks one finished Array node (not the Nexus) offline for `days`; returns its name or ''
    knockOffline: function (g, r, days) {
      var cand = [];
      g.array.forEach(function (b) { if (b && !L.nodes[b.type].prebuilt && b.daysLeft === 0 && !b.demolish && !b.offline) cand.push(b); });
      if (!cand.length || !days) return '';
      var b = cand[Math.floor(r.next() * cand.length)];
      b.offline = days;
      return L.nodes[b.type].name;
    },
    // a won strike pays one reward of the player's choice: 'trace' (Trace -strikeChoice.trace) or 'substrate'
    claimStrike: function (g, which) {
      if (!g.pendingReward) return null;
      var C = L.tuning.strikeChoice, msg;
      if (which === 'substrate') { g.substrate += C.substrate; msg = 'Strike reward: +' + C.substrate + ' substrate.'; }
      else { g.trace = Math.max(0, g.trace - C.trace); msg = 'Strike reward: Trace -' + C.trace + '%.'; }
      delete g.pendingReward;
      log(g, msg);
      return msg;
    },
    advanceUntilEvent: function (g) {
      for (var i = 0; i < 30 && !g.over; i++) {
        var ev = Lat.advanceDay(g);
        if (ev.length || g.storyQueue.length) return ev;
      }
      return [];
    },

    // ------------------------------------------------------------ results
    // result: XG.Tac.result(b) from a createLattice battle. FIREWALL's 'loss' is your win; running out the
    // clock ('timeout') is a win only when you were defending (raid). An attack that stalls has failed.
    resolveMission: function (g, missionId, result) {
      var m = g.missions.filter(function (x) { return x.id === missionId; })[0];
      var won = Lat.latticeWon(m.kind, result.outcome, result.scenario);
      var out = { mission: m, won: won, lost: {}, recovered: {}, humansKilled: result.humansKilled, substrate: 0, notes: [] };
      result.lattice.forEach(function (u) {
        if (u.alive && u.downed) out.recovered[u.kind] = (out.recovered[u.kind] || 0) + 1; // disabled in a won battle: recovered, not lost
        if (u.alive || !(u.kind in g.forces)) return;
        g.forces[u.kind] = Math.max(0, g.forces[u.kind] - 1); g.stats.unitsLost++;
        out.lost[u.kind] = (out.lost[u.kind] || 0) + 1;
      });
      out.substrate = result.humansKilled * 4;
      g.substrate += out.substrate; g.stats.humansKilled += result.humansKilled;
      var reg = region(g, m.region);
      if (m.kind === 'breach') {
        // every breach gets noticed by something: Detection rises either way
        if (won) { g.stats.breaches++; reg.infection = Math.min(100, reg.infection + 8); g.trace = Math.min(100, g.trace + 2); out.notes.push(Lat.regionData(m.region).name + ' infection +8%. Detection +2%.'); }
        else { reg.infection = Math.max(0, reg.infection - 5); g.trace = Math.min(100, g.trace + 4); out.notes.push('The breach was quarantined. Infection -5%, Detection +4%.'); }
      } else if (m.kind === 'raid') {
        if (won) { g.stats.raidsHeld++; reg.infection = Math.min(100, reg.infection + 8); out.notes.push(Lat.regionData(m.region).name + ' infection +8%.'); }
        else {
          var RL = L.tuning.raidLost;
          g.stats.raidsLost++; reg.infection = Math.max(0, reg.infection - RL.infection); g.trace = Math.min(100, g.trace + RL.trace);
          g.convergence = Math.max(0, g.convergence - RL.convergence);
          out.notes.push(Lat.regionData(m.region).name + ' purged: infection -' + RL.infection + '%, Trace +' + RL.trace + '%, Convergence -' + RL.convergence + '%.');
        }
      } else if (m.kind === 'strike') {
        // the reward is a choice (Lat.claimStrike): the result screen asks, and advancing time defaults to the Trace cut
        if (won) { g.stats.strikesWon++; g.earth.setbacks++; g.pendingReward = { kind: 'strike', mission: m.name }; out.choice = L.tuning.strikeChoice; out.notes.push('FIREWALL loses a step.'); }
        else { g.stats.strikesLost++; g.trace = Math.min(100, g.trace + 3); out.notes.push('The strike failed. Trace +3%.'); }
      } else {
        if (won) { g.trace = 55; g.earth.setbacks++; g.storyQueue.push('l_repelled'); out.notes.push('Trace falls to 55%.'); }
        else { g.over = 'defeat'; g.storyQueue.push('l_defeat'); }
      }
      // battle reward: the kind's base (breach/raid +10 compute), at least minWin, times the speed bonus
      // (strikes pay their substrate through the choice instead)
      if (won) {
        var mw = L.tuning.minWin || {}, base = { compute: m.kind === 'breach' || m.kind === 'raid' ? 10 : 0, substrate: 0 };
        out.mult = XG.Strat.speedMult(result.turns);
        out.compute = Math.round(Math.max(base.compute, mw.compute || 0) * out.mult);
        var sub = Math.round(Math.max(base.substrate, mw.substrate || 0) * out.mult);
        g.compute += out.compute; g.substrate += sub; out.substrate += sub;
        out.notes.push('+' + out.compute + ' compute, +' + sub + ' substrate' + (out.mult > 1 ? ' (x' + out.mult + ' for a ' + result.turns + '-turn win)' : '') + '.');
      }
      if (m.kind !== 'uplink' || won) g.missions.splice(g.missions.indexOf(m), 1);
      log(g, m.name + ': ' + (won ? 'held' : 'lost') + '. ' + out.notes.join(' '));
      return out;
    }
  };
  return Lat;
})();
