// FIREWALL: comms chatter. Short HALCYON / LATTICE lines (DATA.comms) that react to play on the strategy map and
// in battle, shown in a voice card at the bottom left without pausing anything. The only game state it touches is
// g.intel, the campaign's memory of past battles (learn), which lets lines talk about what actually happened, and
// g.debates, which overheard debates have played (nextDebate).
var XG = globalThis.XG = globalThis.XG || {};

XG.Comms = (function () {
  var recent = [], queue = [], showing = false, lastBattle = 0, timer = null;
  // chance each battle event gets a line, and the gap between optional battle lines (ms)
  var CHANCE = { start: 1, kill: .5, loss: .9, crit: .5, hack: .7, win: 1, lose: 1 }, GAP = 6000;

  function on() { return !XG.Settings || XG.Settings.get('comms') !== false; }
  function side(g) { return g && g.faction === 'lattice' ? 'lat' : 'fw'; }
  // Mood follows Convergence in both campaigns: HALCYON grows afraid and the Lattice smug as it climbs toward 100%,
  // and both swing back when it falls. In the Lattice campaign a high Trace (FIREWALL closing in) pulls it back a step.
  var MOODS = ['calm', 'uneasy', 'dire'];
  function mood(g) {
    if (!g) return 'calm';
    var c = g.convergence || 0, m = c >= 70 ? 2 : c >= 40 ? 1 : 0;
    if (g.faction === 'lattice' && g.trace >= 75) m = Math.max(0, m - 1);
    return MOODS[m];
  }
  // A line's optional third field lists the moods it fits ('calm uneasy'); untagged lines fit any mood.
  function fits(l, md) { return !l[2] || l[2].split(' ').indexOf(md) >= 0; }

  // ---- campaign memory (g.intel). learn() folds one battle's counters (Tac.result(b).obs) in before resolveMission;
  // facts() turns it into placeholders for lines. Sides are neutral: fw = FIREWALL, lat = the Lattice, whoever you play.
  var SIDE = { player: 'fw', enemy: 'lat' };
  function blank() {
    var two = function () { return { fw: 0, lat: 0 }; }, map2 = function () { return { fw: {}, lat: {} }; };
    return { battles: 0, turns: 0, fwStreak: 0, last: null, shots: two(), hits: two(), flanks: two(), ow: two(), blast: two(),
      dir: map2(), dmg: map2(), lost: map2(), node: { fwTook: 0, latTook: 0, fwHeld: 0, latHeld: 0 } };
  }
  function addMap(to, from) { Object.keys(from || {}).forEach(function (k) { to[k] = (to[k] || 0) + from[k]; }); }
  function learn(g, res) {
    if (!g || !res || res.training || !res.obs) return;
    var I = g.intel = g.intel || blank(), o = res.obs;
    var fwWon = g.faction === 'lattice' ? !(XG.Lat && XG.Lat.latticeWon(res.kind, res.outcome, res.scenario)) : res.outcome === 'win';
    I.battles++; I.turns += res.turns || 0;
    I.fwStreak = fwWon ? Math.max(0, I.fwStreak) + 1 : Math.min(0, I.fwStreak) - 1;
    ['shots', 'hits', 'flanks', 'ow', 'blast'].forEach(function (k) { Object.keys(SIDE).forEach(function (s) { I[k][SIDE[s]] += (o[k] && o[k][s]) || 0; }); });
    ['dir', 'dmg', 'lost'].forEach(function (k) { Object.keys(SIDE).forEach(function (s) { addMap(I[k][SIDE[s]], o[k] && o[k][s]); }); });
    var count = function (m) { return Object.keys(m || {}).reduce(function (n, k) { return n + m[k]; }, 0); };
    if (res.nodeAttacker) {
      var att = SIDE[res.nodeAttacker], def = att === 'fw' ? 'lat' : 'fw';
      if (res.captured) I.node[att + 'Took']++; else if (res.outcome === 'timeout') I.node[def + 'Held']++;
    }
    I.last = { fwWon: fwWon, turns: res.turns || 0, kind: res.kind || null, scenario: res.scenario || null,
      fwLost: count(o.lost && o.lost.player), latLost: count(o.lost && o.lost.enemy) };
  }
  function unitName(k) { var D = XG.DATA; return ((D.classes || {})[k] || (D.enemies || {})[k] || (D.software || {})[k] || { name: k }).name; }
  function top(m) { var best = null; Object.keys(m || {}).forEach(function (k) { if (!best || m[k] > m[best]) best = k; }); return best; }
  // Placeholders a line may use. A fact is only present when the record backs it, so a line that names it can only be
  // picked once the campaign has shown it (no "they always flank from the left" without the flanks to prove it).
  function facts(I) {
    var F = {};
    if (!I || !I.battles) return F;
    F.fought = I.battles; // at least one earlier battle (lines that say "again" or "last time")
    var tot = function (m) { return Object.keys(m || {}).reduce(function (n, k) { return n + m[k]; }, 0); };
    if (I.battles >= 2) { F.battles = I.battles; F.avgTurns = Math.round(I.turns / I.battles); }
    ['fw', 'lat'].forEach(function (s) {
      var o = s === 'fw' ? 'lat' : 'fw', d = I.dir[s], m = tot(d), t = top(d);
      if (m >= 3 && t !== 'front' && d[t] >= 2 && d[t] / m >= 0.45) { F[s + 'FlankDir'] = t; F[s + 'FlankN'] = d[t]; F[s + 'FlankM'] = m; }
      if (I.flanks[s] >= 4) F[s + 'Flanks'] = I.flanks[s];
      if (m >= 4 && d[t] / m < 0.45) F[s + 'FlankMixed'] = true; // flanks came from all round, no side stands out
      if (I.battles >= 2 && !I.flanks[s] && I.shots[s] >= 10) F[s + 'NoFlank'] = I.battles;
      if (I.flanks[s] >= 4 && I.flanks[s] >= 2 * I.flanks[o]) { F[s + 'Outflank'] = I.flanks[s]; F[o + 'Outflanked'] = I.flanks[o]; }
      if (I.shots[s] >= 12) F[s + 'Hit'] = Math.round(100 * I.hits[s] / I.shots[s]);
      var k = top(I.dmg[s]);
      if (k && I.dmg[s][k] >= 6) { F[s + 'Deadly'] = unitName(k); F[s + 'DeadlyDmg'] = I.dmg[s][k]; }
      var lk = top(I.lost[s]), lt = tot(I.lost[s]);
      if (lk && I.lost[s][lk] >= 2) { F[s + 'LostKind'] = unitName(lk); F[s + 'LostKindN'] = I.lost[s][lk]; }
      if (lt >= (s === 'fw' ? 1 : 3)) F[s + 'LostTotal'] = lt;
      if (I.ow[s] >= 2) F[s + 'Ow'] = I.ow[s];
      if (I.blast[s] >= 2) F[s + 'Blasted'] = I.blast[s]; // units of this side killed by grenades, detonations and barrels
      if (I.node[s + 'Took']) F[s + 'Took'] = I.node[s + 'Took'];
      if (I.node[s + 'Held']) F[s + 'Held'] = I.node[s + 'Held'];
    });
    if (I.fwStreak >= 2) F.fwStreak = I.fwStreak;
    if (I.fwStreak <= -2) F.latStreak = -I.fwStreak;
    // win/lose lines play before learn() counts the battle: the run it extends, if that side wins it (only for win/lose lines)
    if (I.fwStreak >= 1) F.fwRun = I.fwStreak + 1;
    if (I.fwStreak <= -1) F.latRun = 1 - I.fwStreak;
    var L = I.last;
    if (L) {
      F[L.fwWon ? 'lastFwWin' : 'lastLatWin'] = L.turns;
      if (L.fwLost) F.lastFwLost = L.fwLost;
      if (L.latLost) F.lastLatLost = L.latLost;
      if (L.turns && L.turns <= 6) F.lastQuick = L.turns;
      if (L.turns >= 14) F.lastLong = L.turns;
    }
    return F;
  }
  // Intel lines: a fourth field when(facts) and/or {placeholders}. Usable only when when() holds and every placeholder is known.
  var HOLE = /\{(\w+)\}/g;
  function isIntel(l) { return typeof l[3] === 'function' || l[1].indexOf('{') >= 0; }
  function usable(l, F) {
    if (typeof l[3] === 'function' && !l[3](F)) return false;
    var ok = true; l[1].replace(HOLE, function (m, k) { if (F[k] === undefined || F[k] === null) ok = false; return m; });
    return ok;
  }
  function fill(text, F, caps) { return text.replace(HOLE, function (m, k) { var v = String(F[k]); return caps ? v.toUpperCase() : v; }); }
  var SMART = .35; // share of picks that go to a fitting intel line when the event has one

  // A line for this event in this mood, avoiding the last few said. Lines written for the mood win two times in three.
  // intel (g.intel, optional): a backed intel line is preferred SMART of the time; one whose condition fails never plays.
  function pick(f, event, md, intel) {
    md = md || 'calm';
    if (event === 'debate') return null; // debates are whole exchanges (nextDebate), not single lines
    var F = facts(intel), all = ((XG.DATA.comms[f] || {})[event] || []).filter(function (l) { return fits(l, md); });
    var smart = all.filter(function (l) { return isIntel(l) && usable(l, F); }), plain = all.filter(function (l) { return !isIntel(l); });
    var pool = smart.length && (!plain.length || Math.random() < SMART) ? smart : plain;
    var fresh = pool.filter(function (l) { return recent.indexOf(l[1]) < 0; });
    var list = fresh.length ? fresh : pool, tagged = list.filter(function (l) { return l[2]; });
    if (tagged.length && Math.random() < .67) list = tagged;
    if (!list.length) return null;
    var l = list[Math.floor(Math.random() * list.length)];
    recent.push(l[1]); if (recent.length > 8) recent.shift();
    return isIntel(l) ? [l[0], fill(l[1], F, l[0] === 'L'), l[2]] : l; // the Lattice speaks in capitals
  }
  function say(g, event) {
    if (!on() || typeof document === 'undefined') return;
    var l = pick(side(g), event, mood(g), g && g.intel);
    if (!l) return;
    queue.push(l); if (queue.length > 2) queue.shift();
    if (!showing) next();
  }
  function next() {
    var el = document.getElementById('comms');
    if (!el) { el = document.createElement('div'); el.id = 'comms'; document.body.appendChild(el); el.onclick = function () { clearTimeout(timer); next(); }; }
    var l = queue.shift();
    if (!l) { showing = false; el.classList.add('hidden'); return; }
    showing = true;
    var lat = l[0] === 'L', doc = l[0] === 'S'; // S = Dr. Amara Okafor, head of R&D (debates only)
    el.className = 'voice comms' + (lat ? ' lattice' : doc ? ' okafor' : '');
    el.innerHTML = '<div class="who">' + (lat ? 'LATTICE' : doc ? 'DR. OKAFOR' : 'HALCYON') + ' <span class="dim">· ' + (doc ? 'R&amp;D' : 'comms') + '</span></div>' + l[1];
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    if (XG.Audio) XG.Audio.play(lat ? 'scan' : 'select');
    timer = setTimeout(next, 5000 + l[1].length * 45);
  }

  // ---- overheard debates (DATA.comms.<side>.debate): facts about the campaign state, for debate when() and {placeholders}.
  // Intel facts (facts(g.intel)) are merged in, so a debate can lean on the battle record too.
  function stateFacts(g) {
    var F = facts(g && g.intel), D = XG.DATA;
    if (!g) return F;
    var cnt = function (list, type) { return list.filter(function (b) { return b && b.type === type && b.daysLeft === 0 && !b.demolish; }).length; };
    F.day = g.day; F.avail = {};
    if (g.faction === 'lattice') {
      var Lat = XG.Lat, A = g.array;
      Object.keys(D.lattice.protocols).forEach(function (id) { if (Lat.protoState(g, id) === 'available') F.avail[id] = true; });
      ['foundry', 'core', 'choir', 'mask', 'spire'].forEach(function (k) { F[k] = cnt(A, k); });
      F.slotsFree = A.filter(function (b) { return !b; }).length;
      F.compute = Math.floor(g.compute); F.substrate = Math.floor(g.substrate); F.trace = Math.round(g.trace);
      F.forces = Lat.forceCount(g); F.bandwidth = Lat.bandwidth(g); F.phaseWar = g.phase === 'war';
      F.ignored = g.stats.ignored; F.unitsLost = g.stats.unitsLost; F.raidInf = D.lattice.tuning.raidIgnored.infection;
      F.strikeOpen = g.missions.some(function (m) { return m.kind === 'strike'; });
    } else {
      var St = XG.Strat, B = g.base, p = St.power(g);
      Object.keys(D.techs).forEach(function (id) { if (St.techState(g, id) === 'available' || St.techState(g, id) === 'needs-salvage') F.avail[id] = true; });
      F.labs = cnt(B, 'lab');
      ['generator', 'workshop', 'infirmary', 'array', 'server'].forEach(function (k) { F[k] = cnt(B, k); });
      F.slotsFree = B.filter(function (b) { return !b; }).length; F.powerFree = p.total - p.used;
      F.credits = g.credits; F.salvage = g.salvage; F.expired = g.stats.expired;
      F.halcyon = St.has(g, 'halcyon'); F.gearTech = ['emp', 'faraday', 'coilguns'].some(function (t) { return St.has(g, t); });
      F.sentinels = g.soldiers.filter(function (s) { return s.cls === 'sentinel'; }).length;
      F.wounded = g.soldiers.filter(function (s) { return s.hp < XG.State.stats(g, s).maxHp; }).length;
    }
    return F;
  }
  var DEBATE_GAP = 3; // days between two debates
  // The next debate to play, or null. Marks it played (g.debates: { seen: [ids], last: day }) so each runs once per campaign.
  function nextDebate(g) {
    if (!g || g.over) return null;
    var R = g.debates = g.debates || { seen: [], last: -99 };
    if (g.day - R.last < DEBATE_GAP) return null;
    var F = stateFacts(g), list = ((XG.DATA.comms[side(g)] || {}).debate || []).filter(function (d) {
      return R.seen.indexOf(d.id) < 0 && d.when(F) && d.lines.every(function (l) { return usable(l, F); });
    });
    if (!list.length) return null;
    var d = list[Math.floor(Math.random() * list.length)];
    R.seen.push(d.id); R.last = g.day;
    return { id: d.id, lines: d.lines.map(function (l) { return [l[0], fill(l[1], F, l[0] === 'L')]; }) };
  }

  // Strategy: one line per time advance, for the most notable event; a quiet advance still gets chatter
  // most of the time. Skipped when a story beat (which has its own voice) is about to play. A due debate replaces the line.
  var ORDER = ['mission', 'expire', 'research', 'build'];
  function strategy(g, events) {
    if (!g || (g.storyQueue && g.storyQueue.length)) return;
    if (on() && typeof document !== 'undefined') {
      var dbt = nextDebate(g);
      if (dbt) { queue = dbt.lines.slice(); clearTimeout(timer); next(); return; }
    }
    var types = (events || []).map(function (e) { return e.type; });
    var ev = ORDER.filter(function (t) { return types.indexOf(t) >= 0; })[0];
    if (ev || Math.random() < .7) say(g, ev || 'advance');
  }
  // Battle: start, kill, loss, crit, hack, win, lose. Optional lines keep a gap so they don't pile up.
  function battle(g, b, event) {
    if (!b || b.training || Math.random() >= (CHANCE[event] || 0)) return;
    var now = Date.now(), must = event === 'start' || event === 'win' || event === 'lose' || event === 'loss';
    if (!must && now - lastBattle < GAP) return;
    lastBattle = now;
    say(g, event);
  }
  function clear() { queue = []; clearTimeout(timer); showing = false; var el = typeof document !== 'undefined' && document.getElementById('comms'); if (el) el.classList.add('hidden'); }

  return { say: say, strategy: strategy, battle: battle, clear: clear, pick: pick, mood: mood, learn: learn, facts: facts, usable: usable,
    stateFacts: stateFacts, nextDebate: nextDebate, DEBATE_GAP: DEBATE_GAP };
})();
