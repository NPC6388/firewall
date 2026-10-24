// FIREWALL: RNG, game state model, soldiers, save/load.
var XG = globalThis.XG = globalThis.XG || {};

// mulberry32: small, fast, seedable. State is one integer so it serializes with the save.
XG.RNG = function (seed) {
  this.s = (seed >>> 0) || 1;
};
XG.RNG.prototype.next = function () {
  var t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
XG.RNG.prototype.int = function (lo, hi) { return lo + Math.floor(this.next() * (hi - lo + 1)); };
XG.RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
XG.RNG.prototype.chance = function (pct) { return this.next() * 100 < pct; };
XG.RNG.prototype.shuffle = function (arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(this.next() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
};

XG.State = {
  SAVE_KEY: 'firewall-save-v1',

  newGame: function (seed) {
    var D = XG.DATA;
    seed = seed || (Date.now() & 0x7fffffff);
    var rng = new XG.RNG(seed);
    var g = {
      version: 1,
      seed: seed,
      rngState: 0,
      day: 1,
      credits: D.start.credits,
      salvage: D.start.salvage,
      convergence: D.start.convergence,
      regions: D.regions.map(function (r) { return { id: r.id, infection: rng.int(8, 22) }; }),
      base: [],
      soldiers: [],
      memorial: [],
      nextSoldierId: 1,
      research: { current: null, progress: {}, done: [] },
      fabricated: {},
      flags: {},
      items: {},
      missions: [],
      nextMissionIn: 2,
      nextMissionId: 1,
      storyQueue: ['intro'],
      storySeen: [],
      log: [],
      stats: { missionsWon: 0, missionsLost: 0, kills: 0, expired: 0 },
      over: null
    };
    // 3x4 base grid; slot 0 is the prebuilt command center
    for (var i = 0; i < 12; i++) g.base.push(null);
    g.base[0] = { type: 'command', daysLeft: 0 };

    ['trooper', 'trooper', 'hacker', 'scientist', 'trooper', 'hacker'].forEach(function (c) {
      g.soldiers.push(XG.State.makeSoldier(g, c, rng));
    });
    g.rngState = rng.s;
    XG.State.log(g, 'FIREWALL activated. HALCYON online (air-gapped).');
    return g;
  },

  rng: function (g) {
    // Borrow the game's RNG; caller must call XG.State.saveRng(g, r) after use.
    var r = new XG.RNG(1); r.s = g.rngState; return r;
  },
  saveRng: function (g, r) { g.rngState = r.s; },

  makeSoldier: function (g, cls, rng) {
    var D = XG.DATA, C = D.classes[cls];
    var name;
    if (cls === 'sentinel') {
      var n = g.soldiers.concat(g.memorial).filter(function (s) { return s.cls === 'sentinel'; }).length;
      name = D.sentinelNames[n % D.sentinelNames.length];
    } else {
      name = rng.pick(D.firstNames) + ' "' + rng.pick(D.callsigns) + '" ' + rng.pick(D.lastNames);
    }
    return {
      id: g.nextSoldierId++, cls: cls, name: name, xp: 0, kills: 0, missions: 0,
      hp: C.hp, // current; max is derived
      aimRoll: rng.int(-4, 4)
    };
  },

  rankIndex: function (s) {
    var r = 0;
    XG.DATA.ranks.forEach(function (rk, i) { if (s.xp >= rk.xp) r = i; });
    return r;
  },
  rankName: function (s) { return XG.DATA.ranks[XG.State.rankIndex(s)].name; },

  // Derived combat stats, including global upgrades.
  stats: function (g, s) {
    var D = XG.DATA, C = D.classes[s.cls], W = D.weapons[C.weapon];
    var rk = XG.State.rankIndex(s);
    var maxHp = C.hp + rk * D.rankBonus.hp + (g.flags.armor && !C.machine ? 3 : 0);
    var coil = g.flags.coil ? 1 : 0;
    return {
      maxHp: maxHp,
      aim: C.aim + s.aimRoll + rk * D.rankBonus.aim,
      mobility: C.mobility,
      armor: C.armor || 0,
      dmg: [W.dmg[0] + coil, W.dmg[1] + coil * 2],
      range: W.range, close: W.close, crit: W.crit,
      hackSkill: C.hackSkill ? C.hackSkill + rk * 5 + (s.hacks || 0) : 0 // +1 per successful hack
    };
  },

  available: function (g, s) { return s.hp >= XG.State.stats(g, s).maxHp && !(s.critical > 0); },

  log: function (g, msg) {
    g.log.unshift({ day: g.day, msg: msg });
    if (g.log.length > 80) g.log.length = 80;
  },

  save: function (g) {
    try { localStorage.setItem(XG.State.SAVE_KEY, JSON.stringify(g)); return true; } catch (e) { return false; }
  },
  load: function () {
    try {
      var raw = localStorage.getItem(XG.State.SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  clear: function () {
    try { localStorage.removeItem(XG.State.SAVE_KEY); } catch (e) { /* ignore */ }
  }
};
