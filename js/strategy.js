// FIREWALL: campaign rules (time, research, base, missions, Convergence). No DOM.
var XG = globalThis.XG = globalThis.XG || {};

XG.Strat = (function () {
  var D = XG.DATA, S = XG.State;
  var OP_A = ['Silent', 'Iron', 'Glass', 'Cold', 'Burning', 'Hollow', 'Broken', 'Last', 'Red', 'Quiet', 'Black', 'Grey'];
  var OP_B = ['Antenna', 'Static', 'Lantern', 'Circuit', 'Harbor', 'Choir', 'Firewall', 'Signal', 'Echo', 'Meridian', 'Ladder', 'Wire'];

  function has(g, tech) { return g.research.done.indexOf(tech) >= 0; }
  function built(g, type) {
    return g.base.filter(function (b) { return b && b.type === type && b.daysLeft === 0 && !b.demolish; }).length;
  }
  function region(g, id) { return g.regions.filter(function (r) { return r.id === id; })[0]; }
  function regionData(id) { return D.regions.filter(function (r) { return r.id === id; })[0]; }
  function canPay(g, cost) { return g.credits >= (cost.credits || 0) && g.salvage >= (cost.salvage || 0); }
  function pay(g, cost) { g.credits -= cost.credits || 0; g.salvage -= cost.salvage || 0; }
  function costText(cost) {
    var p = ['§' + (cost.credits || 0)];
    if (cost.salvage) p.push(cost.salvage + ' salvage');
    return p.join(' + ');
  }

  var Strat = {
    has: has, built: built, region: region, regionData: regionData, costText: costText,

    power: function (g) {
      var total = 0, used = 0;
      g.base.forEach(function (b) {
        if (!b || b.demolish) return; // facilities being demolished are offline
        var p = D.facilities[b.type].power;
        if (p > 0) { if (b.daysLeft === 0) total += p; } else used -= p; // consumers reserve power while building
      });
      return { total: total, used: used };
    },

    researchRate: function (g) {
      return D.tuning.researchBase * (1 + 0.4 * built(g, 'lab') + 0.15 * built(g, 'server'));
    },
    squadSize: function (g) { return has(g, 'squad_size') ? 5 : 4; },
    overclockCharges: function (g) { return has(g, 'halcyon') ? 1 + built(g, 'server') : 0; },
    infectionVisible: function (g) { return has(g, 'signal_analysis'); },

    convergenceRate: function (g) {
      var inf = g.regions.reduce(function (a, r) { return a + r.infection; }, 0);
      var rate = D.tuning.convBase + inf * D.tuning.convPerInfection;
      if (has(g, 'firewall')) rate *= 0.7;
      return rate;
    },

    // ------------------------------------------------------------ research
    techState: function (g, id) {
      var t = D.techs[id];
      if (has(g, id)) return 'done';
      if (g.research.current === id) return 'active';
      for (var i = 0; i < t.req.length; i++) if (!has(g, t.req[i])) return 'locked';
      if (t.item && !g.items[t.item]) return 'needs-item';
      if (t.salvage && !g.research.progress[id] && g.salvage < t.salvage) return 'needs-salvage';
      return 'available';
    },
    startResearch: function (g, id) {
      var st = Strat.techState(g, id);
      if (st !== 'available') return false;
      var t = D.techs[id];
      if (t.salvage && !g.research.progress[id]) { g.salvage -= t.salvage; g.research.progress[id] = 0.0001; }
      g.research.current = id;
      return true;
    },
    // Real RP cost: each finished tech adds tuning.techCreep (8%) of the base cost to every tech not yet done.
    techCost: function (g, id) {
      var t = D.techs[id], n = g.research.done.length - (has(g, id) ? 1 : 0);
      return Math.round(t.cost * (1 + (D.tuning.techCreep || 0) * n));
    },
    daysLeft: function (g, id) {
      var done = g.research.progress[id] || 0;
      return Math.max(1, Math.ceil((Strat.techCost(g, id) - done) / Strat.researchRate(g)));
    },

    // ------------------------------------------------------------- base
    canBuild: function (g, type, slot) {
      var f = D.facilities[type];
      if (g.base[slot]) return 'Slot occupied';
      if (f.prebuilt) return 'Cannot build';
      if (f.tech && !has(g, f.tech)) return 'Requires ' + D.techs[f.tech].name;
      if (!canPay(g, f.cost)) return 'Need ' + costText(f.cost);
      if (f.power < 0) {
        var p = Strat.power(g);
        if (p.used - f.power > p.total) return 'Not enough power (' + (p.total - p.used) + ' free)';
      }
      return null;
    },
    build: function (g, type, slot) {
      if (Strat.canBuild(g, type, slot)) return false;
      pay(g, D.facilities[type].cost);
      g.base[slot] = { type: type, daysLeft: D.facilities[type].days };
      S.log(g, 'Construction started: ' + D.facilities[type].name + '.');
      return true;
    },
    // Unfinished construction can be cancelled for a full refund.
    cancelBuild: function (g, slot) {
      var b = g.base[slot];
      if (!b || b.daysLeft <= 0) return false;
      var cost = D.facilities[b.type].cost;
      g.credits += cost.credits || 0; g.salvage += cost.salvage || 0;
      g.base[slot] = null;
      S.log(g, 'Construction cancelled: ' + D.facilities[b.type].name + ' (refunded ' + costText(cost) + ').');
      return true;
    },

    // Finished facilities can be demolished: offline at once, 50% refund after half the build time.
    demolishRefund: function (type) {
      var c = D.facilities[type].cost;
      return { credits: Math.floor((c.credits || 0) / 2), salvage: Math.floor((c.salvage || 0) / 2) };
    },
    demolishDays: function (type) { return Math.max(1, Math.ceil(D.facilities[type].days / 2)); },
    canDemolish: function (g, slot) {
      var b = g.base[slot];
      if (!b || b.daysLeft > 0 || b.demolish) return 'Nothing to demolish';
      var f = D.facilities[b.type];
      if (f.prebuilt) return 'The bunker core cannot be demolished';
      if (f.power > 0) {
        var p = Strat.power(g);
        if (p.used > p.total - f.power) return 'Would leave facilities without power (' + p.used + ' in use)';
      }
      return null;
    },
    demolish: function (g, slot) {
      if (Strat.canDemolish(g, slot)) return false;
      var b = g.base[slot];
      b.demolish = Strat.demolishDays(b.type);
      S.log(g, 'Demolition started: ' + D.facilities[b.type].name + ' (' + b.demolish + 'd).');
      return true;
    },
    cancelDemolish: function (g, slot) {
      var b = g.base[slot];
      if (!b || !b.demolish) return false;
      var f = D.facilities[b.type], p = Strat.power(g);
      if (f.power < 0 && p.used - f.power > p.total) return false;
      delete b.demolish;
      S.log(g, 'Demolition cancelled: ' + f.name + ' is back online.');
      return true;
    },

    // ------------------------------------------------------- fabrication
    fabCost: function (g, id) {
      // repeatable items with a costStep get dearer with every one already made (the Sentinel chassis)
      var f = D.fabrication[id], c = f.cost, st = f.costStep || {}, n = g.fabricated[id] || 0;
      var m = 1 - 0.15 * Math.max(0, built(g, 'workshop') - 1);
      return { credits: Math.round(((c.credits || 0) + n * (st.credits || 0)) * m), salvage: Math.round(((c.salvage || 0) + n * (st.salvage || 0)) * m) };
    },
    canFabricate: function (g, id) {
      var f = D.fabrication[id];
      if (!has(g, f.tech)) return 'Requires ' + D.techs[f.tech].name;
      if (!f.repeatable && g.fabricated[id]) return 'Already fabricated';
      if (id === 'sentinel' && Strat.rosterFull(g)) return 'Roster full (' + D.tuning.rosterCap + ')';
      if (!built(g, 'workshop')) return 'Requires a Fabrication Bay';
      if (!canPay(g, Strat.fabCost(g, id))) return 'Need ' + costText(Strat.fabCost(g, id));
      return null;
    },
    fabricate: function (g, id) {
      if (Strat.canFabricate(g, id)) return false;
      var f = D.fabrication[id];
      pay(g, Strat.fabCost(g, id));
      g.fabricated[id] = (g.fabricated[id] || 0) + 1;
      if (f.flag) g.flags[f.flag] = true;
      if (id === 'sentinel') {
        var r = S.rng(g); g.soldiers.push(S.makeSoldier(g, 'sentinel', r)); S.saveRng(g, r);
      }
      if (id === 'faraday_armor') g.soldiers.forEach(function (s) { if (!D.classes[s.cls].machine) s.hp += 3; });
      S.log(g, 'Fabricated: ' + f.name + '.');
      return true;
    },

    // Recruits get dearer with every hire (g.hired; old saves start at 0), and the roster holds rosterCap people and machines.
    hireCost: function (g) { var T = D.tuning; return Math.min(T.hireMax || T.hireCost, T.hireCost + (T.hireStep || 0) * (g.hired || 0)); },
    rosterFull: function (g) { return g.soldiers.length >= (D.tuning.rosterCap || 99); },
    canHire: function (g) {
      if (Strat.rosterFull(g)) return 'Roster full (' + D.tuning.rosterCap + ')';
      if (g.credits < Strat.hireCost(g)) return 'Need §' + Strat.hireCost(g);
      return null;
    },
    hire: function (g, cls) {
      if (Strat.canHire(g) || cls === 'sentinel') return false;
      g.credits -= Strat.hireCost(g);
      g.hired = (g.hired || 0) + 1;
      var r = S.rng(g), s = S.makeSoldier(g, cls, r); S.saveRng(g, r);
      g.soldiers.push(s);
      S.log(g, 'Recruited ' + D.classes[cls].name + ' ' + s.name + '.');
      return s;
    },

    // ----------------------------------------------------------- missions
    // Raid scenario for an ordinary mission: 'node' (capture / hold the server) or 'exterminate' (no time limit), seeded by the
    // mission seed so it never touches the campaign RNG. Used by both campaigns (Lattice raids and strikes too).
    rollScenario: function (seed) {
      var r = new XG.RNG((Math.imul((seed >>> 0) || 1, 2246822519) ^ 0x27D4EB2F) >>> 0);
      return r.next() < D.tuning.nodeChance ? 'node' : 'exterminate';
    },
    // The 'outside' map layout (server inside a building, attackers start in the yard), seeded by the mission seed on its own stream.
    rollOutside: function (seed, scenario) {
      var p = scenario === 'node' ? D.tuning.outsideChance : scenario === 'exterminate' ? D.tuning.outsideChanceExt : 0;
      return !!p && new XG.RNG((Math.imul((seed >>> 0) || 1, 0x85EBCA6B) ^ 0x5BD1E995) >>> 0).next() < p;
    },
    nodeTurnsFor: function (m, kind) { return (Strat.rollOutside(m.seed, m.scenario) ? D.tuning.nodeTurnsOutside : D.tuning.nodeTurns)[kind || m.kind]; },
    scenarioTag: function (m) { return m.scenario === 'node' ? 'NODE' : m.scenario === 'exterminate' ? 'EXTERMINATE' : ''; },
    // Difficulty = how many rows of tuning.difficultyDays the day has reached (1 on day 1; 7 from day 109 by default).
    difficulty: function (g) {
      var rows = D.tuning.difficultyDays, n = 0;
      for (var i = 0; i < rows.length; i++) if (g.day >= rows[i]) n++;
      return Math.max(1, n);
    },
    // What letting a mission expire costs (shown on the mission card, applied in advanceDay).
    expireCost: function (m) {
      var P = D.tuning.expirePenalty;
      return { infection: P.infection, convergence: P.convergence, credits: P.credits || 0 };
    },

    spawnMission: function (g, r, kind) {
      kind = kind || 'purge';
      var regionId;
      if (kind === 'uplink') regionId = 'oc';
      else {
        // weight by infection: the Lattice is loudest where it's strongest
        var total = g.regions.reduce(function (a, x) { return a + x.infection + 10; }, 0), roll = r.next() * total;
        for (var i = 0; i < g.regions.length; i++) { roll -= g.regions[i].infection + 10; if (roll <= 0) { regionId = g.regions[i].id; break; } }
        regionId = regionId || g.regions[0].id;
      }
      var rd = regionData(regionId), diff = Strat.difficulty(g);
      var m = {
        id: g.nextMissionId++, kind: kind, region: regionId, city: r.pick(rd.cities),
        site: r.pick(D.sites), diff: diff, daysLeft: null, seed: r.int(1, 2147483646)
      };
      if (kind === 'purge') {
        m.name = 'Operation ' + r.pick(OP_A) + ' ' + r.pick(OP_B);
        m.daysLeft = r.int(D.tuning.missionLife[0], D.tuning.missionLife[1]) + (built(g, 'array') ? 2 : 0);
        m.reward = { salvage: r.int(8, 14) + diff * 3, credits: r.int(0, 2) * 10, infection: r.int(12, 20) };
        m.scenario = Strat.rollScenario(m.seed);
        m.brief = m.scenario === 'node'
          ? 'Lattice cell guarding a server node in a ' + m.site + '. Capture it: end ' + D.tuning.nodeCapture + ' of your turns with an operative beside the server and no hostile there, within ' + Strat.nodeTurnsFor(m) + ' turns. Wiping them out also works.' + (Strat.rollOutside(m.seed, m.scenario) ? ' The server is inside a building: cross the yard and break in.' : '')
          : 'Lattice cell entrenched in a ' + m.site + '. Exterminate: eliminate all hostiles. No time limit.' + (Strat.rollOutside(m.seed, m.scenario) ? ' They hold a building: cross the yard and break in.' : '');
      } else if (kind === 'relay') {
        m.name = 'Relay Trace'; m.diff = Math.max(2, diff);
        m.reward = { salvage: 25, credits: 30, infection: 20 };
        m.brief = 'A Lattice Relay is bundling traffic in a ' + m.site + '. Destroy it (it spawns drones) and wipe the guard. The core survives the blast.';
      } else {
        m.name = 'Sever the Uplink'; m.city = 'Pacific cable landing station'; m.site = 'cable landing station';
        m.diff = Math.max(4, diff);
        m.reward = { salvage: 0, credits: 0, infection: 0 };
        m.brief = 'The Lattice ground uplink. Destroy the Uplink Core, or get a Hacker adjacent and Sever it 3 times. Defenders spawn every turn.';
      }
      g.missions.push(m);
      return m;
    },

    // ---------------------------------------------------------- the clock
    advanceDay: function (g) {
      if (g.over) return [];
      var ev = [], r = S.rng(g), T = D.tuning;
      g.day++;

      // research
      var cur = g.research.current;
      if (cur) {
        g.research.progress[cur] = (g.research.progress[cur] || 0) + Strat.researchRate(g);
        if (g.research.progress[cur] >= Strat.techCost(g, cur)) {
          g.research.done.push(cur); g.research.current = null;
          ev.push({ type: 'research', msg: 'Research complete: ' + D.techs[cur].name });
          S.log(g, 'Research complete: ' + D.techs[cur].name + '.');
          if (D.techs[cur].story) g.storyQueue.push(D.techs[cur].story);
          if (cur === 'lattice_grammar') Strat.spawnMission(g, r, 'relay');
          if (cur === 'triangulation') Strat.spawnMission(g, r, 'uplink');
        }
      }

      // construction
      g.base.forEach(function (b, i) {
        if (b && b.daysLeft > 0 && --b.daysLeft === 0) {
          ev.push({ type: 'build', msg: 'Construction complete: ' + D.facilities[b.type].name });
          S.log(g, 'Construction complete: ' + D.facilities[b.type].name + '.');
        }
        if (b && b.demolish > 0 && --b.demolish === 0) {
          var ref = Strat.demolishRefund(b.type);
          g.credits += ref.credits; g.salvage += ref.salvage; g.base[i] = null;
          ev.push({ type: 'build', msg: 'Demolition complete: ' + D.facilities[b.type].name + ' (refunded ' + costText(ref) + ')' });
          S.log(g, 'Demolition complete: ' + D.facilities[b.type].name + '. Refunded ' + costText(ref) + '.');
        }
      });

      // healing / repair (machines repair for tuning.repairSalvage per HP, as far as the salvage goes)
      var heal = built(g, 'infirmary') ? 2 : 1;
      g.soldiers.forEach(function (s) {
        var mx = S.stats(g, s).maxHp, gain = Math.min(heal, mx - s.hp);
        if (gain > 0 && D.classes[s.cls].machine && T.repairSalvage) {
          gain = Math.min(gain, Math.floor(g.salvage / T.repairSalvage));
          g.salvage -= gain * T.repairSalvage;
        }
        if (gain > 0) {
          s.hp += gain;
          if (s.hp === mx) S.log(g, s.name + ' is fit for duty.');
        }
      });

      // the Lattice spreads
      var drift = T.infectionDrift * (has(g, 'firewall') ? 0.7 : 1);
      g.regions.forEach(function (x) { x.infection = Math.min(100, x.infection + drift * (0.5 + r.next())); });
      var before = g.convergence;
      g.convergence = Math.min(100, g.convergence + Strat.convergenceRate(g));

      // mission expiry
      g.missions = g.missions.filter(function (m) {
        if (m.daysLeft === null) return true;
        if (--m.daysLeft > 0) return true;
        var reg = region(g, m.region), ec = Strat.expireCost(m), lost = Math.min(g.credits, ec.credits);
        reg.infection = Math.min(100, reg.infection + ec.infection);
        g.convergence = Math.min(100, g.convergence + ec.convergence);
        g.credits -= lost; // panic in the region: its government cuts funding at once
        g.stats.expired++;
        ev.push({ type: 'expire', msg: m.name + ' expired. ' + regionData(m.region).name + ' falls further' + (lost ? ' and cuts §' + lost + ' of funding' : '') + '.' });
        S.log(g, m.name + ' (' + m.city + ') expired. Convergence +' + ec.convergence + '%' + (lost ? ', funding -§' + lost : '') + '.');
        return false;
      });

      // new missions
      if (--g.nextMissionIn <= 0) {
        var m = Strat.spawnMission(g, r, 'purge');
        g.nextMissionIn = r.int(T.missionEvery[0], T.missionEvery[1]);
        ev.push({ type: 'mission', msg: 'New mission: ' + m.name + ' — ' + m.city });
        S.log(g, 'Lattice activity detected: ' + m.city + ' (' + m.name + ').');
      }

      // monthly funding
      if ((g.day - 1) % 30 === 0) {
        var vis = Strat.infectionVisible(g);
        var fund = Math.round(g.regions.reduce(function (a, x) { return a + T.fundingPerRegion * (1 - x.infection / 100); }, 0));
        g.credits += fund;
        ev.push({ type: 'funding', msg: 'Monthly funding: §' + fund + (vis ? '' : ' (infection data unavailable)') });
        S.log(g, 'Monthly funding received: §' + fund + '.');
      }

      // taunts + defeat
      [50, 75, 90].forEach(function (th) {
        if (before < th && g.convergence >= th) g.storyQueue.push('taunt_' + th);
      });
      if (g.convergence >= 100) { g.over = 'defeat'; g.storyQueue.push('defeat'); ev.push({ type: 'end', msg: 'Convergence complete.' }); }

      S.saveRng(g, r);
      return ev;
    },

    // Advance until something worth stopping for happens (cap 30 days).
    advanceUntilEvent: function (g) {
      for (var i = 0; i < 30 && !g.over; i++) {
        var ev = Strat.advanceDay(g);
        if (ev.length || g.storyQueue.length) return ev;
      }
      return [];
    },

    // --------------------------------------------------------- results
    // result: { outcome:'win'|'loss'|'abort', units:[{sid, hp, alive, kills, held}], salvage }
    // held: hostiles the unit hacked that were still ours at the end; each earns XP like a kill (not counted as a kill).
    // Credits a mission pays on success: its reward, but never below the minimum (the final mission ends the war instead).
    // Speed multiplier for a won battle that took `turns` turns (1 when unknown).
    speedMult: function (turns) {
      var T = D.tuning, f = T.rewardFast || 4, sl = T.rewardSlow || 14, mx = T.rewardMaxMult || 3;
      if (!(turns > 0)) return 1;
      return Math.round(Math.max(1, Math.min(mx, mx - (mx - 1) * (turns - f) / (sl - f))) * 100) / 100;
    },
    missionCredits: function (m) { return m.kind === 'uplink' ? 0 : Math.max(D.tuning.minMissionCredits || 0, (m.reward && m.reward.credits) || 0); },
    resolveMission: function (g, missionId, result) {
      var m = g.missions.filter(function (x) { return x.id === missionId; })[0];
      var out = { mission: m, outcome: result.outcome, deaths: [], promotions: [], salvage: 0, credits: 0, infection: 0 };
      result.units.forEach(function (u) {
        var s = g.soldiers.filter(function (x) { return x.id === u.sid; })[0];
        if (!s) return;
        if (!u.alive) {
          g.soldiers.splice(g.soldiers.indexOf(s), 1);
          s.diedDay = g.day; s.diedAt = m.name + ', ' + m.city;
          g.memorial.push(s); out.deaths.push(s);
          S.log(g, s.name + ' KIA at ' + m.city + '.');
          return;
        }
        var rk = S.rankIndex(s);
        s.hp = Math.max(1, u.hp); s.missions++; s.kills += u.kills; s.hacks = (s.hacks || 0) + (u.hacks || 0);
        s.xp += (result.outcome === 'win' ? 1 : 0) + u.kills + (u.held || 0);
        g.stats.kills += u.kills;
        if (S.rankIndex(s) > rk) out.promotions.push(s);
      });

      // restock the grenades and medkits used (survivors and the fallen alike), paid in salvage as far as it goes
      var used = { grenade: 0, medkit: 0 };
      result.units.forEach(function (u) { if (u.spent) { used.grenade += u.spent.grenade || 0; used.medkit += u.spent.medkit || 0; } });
      var RS = D.tuning.restock || {};
      out.used = used;
      var restockCost = used.grenade * (RS.grenade || 0) + used.medkit * (RS.medkit || 0);

      var reg = region(g, m.region);
      if (result.outcome === 'win') {
        g.stats.missionsWon++;
        out.mult = Strat.speedMult(result.turns);
        out.salvage = Math.round((m.reward.salvage || 0) * out.mult) + (result.salvage || 0);
        out.credits = Math.round(Strat.missionCredits(m) * out.mult);
        out.infection = -(m.reward.infection || 0);
        g.salvage += out.salvage; g.credits += out.credits;
        reg.infection = Math.max(0, reg.infection + out.infection);
        if (m.kind === 'relay') { g.items.relay_core = 1; g.storyQueue.push('beat_relay'); g.convergence = Math.max(0, g.convergence - 5); }
        if (m.kind === 'uplink') { g.over = 'victory'; g.storyQueue.push('victory'); }
        g.missions.splice(g.missions.indexOf(m), 1);
        S.log(g, m.name + ' succeeded. ' + regionData(m.region).name + ' infection ' + out.infection + '%.');
      } else {
        g.stats.missionsLost++;
        out.infection = 8;
        reg.infection = Math.min(100, reg.infection + 8);
        g.convergence = Math.min(100, g.convergence + 2);
        if (m.kind === 'purge') g.missions.splice(g.missions.indexOf(m), 1);
        S.log(g, m.name + ' failed. Convergence +2%.');
        if (g.convergence >= 100 && !g.over) { g.over = 'defeat'; g.storyQueue.push('defeat'); }
      }
      out.restock = Math.min(g.salvage, restockCost); // after the rewards, so a won mission pays for its own grenades
      g.salvage -= out.restock;
      if (out.restock) S.log(g, 'Restocked ' + [used.grenade ? used.grenade + ' grenade' + (used.grenade > 1 ? 's' : '') : '', used.medkit ? used.medkit + ' medkit' + (used.medkit > 1 ? 's' : '') : ''].filter(Boolean).join(' and ') + ': ' + out.restock + ' salvage.');
      return out;
    }
  };
  return Strat;
})();
