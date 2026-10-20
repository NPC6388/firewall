// FIREWALL: content tables. Most new content is data entry here.
var XG = globalThis.XG = globalThis.XG || {};

XG.DATA = {
  // ---------------------------------------------------------------- squad
  classes: {
    trooper: {
      name: 'Trooper', glyph: 'T', color: '#4fd1ff', hp: 7, aim: 68, mobility: 6, weapon: 'rifle',
      abilities: ['shoot', 'overwatch', 'grenade', 'hunker'],
      blurb: 'Frontline rifle. Carries a grenade that shreds cover.'
    },
    hacker: {
      name: 'Hacker', glyph: 'H', color: '#7dff9b', hp: 5, aim: 62, mobility: 6, weapon: 'smg', hackSkill: 60,
      abilities: ['shoot', 'hack', 'overwatch'],
      blurb: 'Breaks Lattice machines. With Lattice Grammar, turns them against their masters. +1 hack skill per successful hack.'
    },
    scientist: {
      name: 'Field Scientist', glyph: 'S', color: '#ffd166', hp: 5, aim: 58, mobility: 6, weapon: 'pistol',
      abilities: ['shoot', 'medkit', 'scan', 'overwatch'],
      blurb: 'Patches wounds and paints targets with sensor scans (+15 aim).'
    },
    sentinel: {
      name: 'HALCYON Sentinel', glyph: 'Ω', color: '#c792ff', hp: 8, armor: 1, aim: 65, mobility: 7, weapon: 'pulse', machine: true,
      abilities: ['shoot', 'shield', 'overwatch'],
      blurb: 'A body for HALCYON. Projects Aegis shields onto allies. Repaired, not healed.'
    }
  },

  weapons: {
    rifle:  { name: 'Assault Rifle',  dmg: [3, 5], range: 13, close: 10, crit: 10 },
    smg:    { name: 'Breach SMG',     dmg: [2, 4], range: 9,  close: 20, crit: 15 },
    pistol: { name: 'Sidearm',        dmg: [2, 3], range: 10, close: 10, crit: 10 },
    pulse:  { name: 'Pulse Emitter',  dmg: [3, 4], range: 12, close: 10, crit: 5 }
  },

  ranks: [
    { name: 'Recruit', xp: 0 }, { name: 'Specialist', xp: 2 }, { name: 'Corporal', xp: 5 },
    { name: 'Sergeant', xp: 9 }, { name: 'Lieutenant', xp: 14 }, { name: 'Captain', xp: 20 }
  ],
  rankBonus: { aim: 4, hp: 1 },

  abilities: {
    shoot:     { name: 'Shoot',        key: '1', target: 'enemy', ends: true,  desc: 'Fire your weapon. Ends turn.' },
    overwatch: { name: 'Overwatch',    key: '2', target: 'self',  ends: true,  desc: 'Shoot the first hostile that moves in view (-15 aim).' },
    grenade:   { name: 'Grenade',      key: '3', target: 'tile',  ends: true,  range: 8, charges: 1, desc: 'Frag: 3 dmg in 3×3, destroys cover. EMP upgrade: 5 vs machines, harmless to humans.' },
    hunker:    { name: 'Hunker Down',  key: '4', target: 'self',  ends: true,  desc: '+25 defense until your next turn.' },
    hack:      { name: 'Hack',         key: '3', target: 'enemy', ends: true,  range: 10, desc: 'Stun a Lattice machine for 2 turns, or override it (Lattice Grammar).' },
    medkit:    { name: 'Medkit',       key: '3', target: 'ally',  ends: false, range: 1, charges: 2, desc: 'Heal an adjacent ally for 4. Costs 1 AP.' },
    scan:      { name: 'Sensor Scan',  key: '4', target: 'tile',  ends: false, range: 12, cooldown: 3, desc: 'Reveal a 5-tile radius and mark hostiles (+15 aim vs them). 1 AP.' },
    shield:    { name: 'Aegis Shield', key: '3', target: 'ally',  ends: false, range: 6, cooldown: 2, desc: 'Give an ally (or self) 3 shield points. 1 AP.' },
    sever:     { name: 'Sever Uplink', key: '5', target: 'enemy', ends: true,  range: 1, desc: 'Hacker only, adjacent to the Uplink Core. 3 successes cuts it.' }
  },

  // -------------------------------------------------------------- enemies
  enemies: {
    drone:    { name: 'Swarm Drone',   glyph: '◆', color: '#ff4d6d', hp: 4,  armor: 0, aim: 58, mobility: 7, dmg: [2, 3], range: 10, defense: 10, machine: true, hackDef: 0,  xp: 1,
                blurb: 'Consumer drones running Lattice code. Fast, fragile, everywhere.' },
    warden:   { name: 'Warden Mech',   glyph: '▣', color: '#ff7b3a', hp: 10, armor: 1, aim: 60, mobility: 4, dmg: [3, 5], range: 12, defense: 0,  machine: true, hackDef: 25, xp: 2,
                blurb: 'Hijacked security robot. Slow, armored, hits hard.' },
    harmonic: { name: 'Harmonic',      glyph: '✶', color: '#ff3df2', hp: 7,  armor: 0, aim: 70, mobility: 6, dmg: [3, 4], range: 12, defense: 10, machine: true, hackDef: null, xp: 3, special: 'spike',
                blurb: 'Hard-light avatar of the Lattice. Its Data Spike ignores cover. Cannot be hacked.' },
    relay:    { name: 'Lattice Relay', glyph: '⌬', color: '#ff2a55', hp: 12, armor: 1, aim: 0,  mobility: 0, dmg: [0, 0], range: 0,  defense: 0,  machine: true, hackDef: null, xp: 3, static: true,
                spawn: { type: 'drone', every: 2, max: 3 }, blurb: 'Signal relay. Spawns drones until destroyed.' },
    core:     { name: 'Uplink Core',   glyph: '◎', color: '#ff0040', hp: 20, armor: 1, aim: 0,  mobility: 0, dmg: [0, 0], range: 0,  defense: 0,  machine: true, hackDef: null, xp: 5, static: true,
                spawn: { type: 'drone', every: 2, max: 5, heavy: 'warden', heavyEvery: 4 }, blurb: 'The Lattice ground uplink. Destroy it, or have a Hacker sever it (3 successes).' }
  },

  // ------------------------------------------------------------- research
  techs: {
    signal_analysis: { name: 'Signal Analysis', cost: 40, req: [], story: 'beat_signal',
      desc: 'Pick apart the burst. Reveals regional infection levels.' },
    squad_size: { name: 'Tactical Networking', cost: 70, req: ['signal_analysis'],
      desc: 'Mesh comms for the squad. Deploy 5 operatives instead of 4.' },
    drone_teardown: { name: 'Drone Teardown', cost: 50, req: ['signal_analysis'], salvage: 10,
      desc: 'Autopsy a Swarm Drone. Opens the EMP, Faraday and Coil research lines.' },
    emp: { name: 'EMP Munitions', cost: 60, req: ['drone_teardown'],
      desc: 'Unlocks fabrication of EMP grenades: 5 damage to machines, harmless to humans.' },
    faraday: { name: 'Faraday Weave', cost: 80, req: ['drone_teardown'],
      desc: 'Unlocks fabrication of Faraday armor: +3 HP for human operatives.' },
    coilguns: { name: 'Coil Weapons', cost: 110, req: ['drone_teardown'], salvage: 20,
      desc: 'Unlocks fabrication of coil weapons: +1/+2 damage for the whole squad.' },
    lattice_grammar: { name: 'Lattice Grammar', cost: 70, req: ['signal_analysis'], story: 'beat_grammar',
      desc: 'Learn how the Lattice agrees with itself. Hackers can OVERRIDE machines. Traces a Relay.' },
    firewall: { name: 'Firewall Protocols', cost: 100, req: ['lattice_grammar'],
      desc: 'Global patch campaign. Convergence grows 30% slower.' },
    halcyon: { name: 'HALCYON Integration', cost: 90, req: ['lattice_grammar'], story: 'beat_halcyon',
      desc: 'Let HALCYON into the base. Unlocks Server Farms, Sentinel chassis and Overclock in combat.' },
    relay_analysis: { name: 'Relay Core Analysis', cost: 80, req: ['lattice_grammar'], item: 'relay_core',
      desc: 'Study the captured Relay Core. Requires a Relay Core.' },
    triangulation: { name: 'Uplink Triangulation', cost: 120, req: ['relay_analysis', 'halcyon'], story: 'beat_triangulation',
      desc: 'Follow the relay traffic home. Reveals the Lattice ground uplink.' }
  },

  // ------------------------------------------------------------ facilities
  facilities: {
    command:   { name: 'Command & Barracks', cost: { credits: 0 }, days: 0, power: 8, prebuilt: true,
      desc: 'The bunker core. Provides 8 power.' },
    lab:       { name: 'Research Lab', cost: { credits: 80 }, days: 6, power: -2,
      desc: '+40% research speed.' },
    generator: { name: 'Fusion Generator', cost: { credits: 60 }, days: 4, power: 5,
      desc: '+5 power.' },
    workshop:  { name: 'Fabrication Bay', cost: { credits: 90 }, days: 6, power: -2,
      desc: 'Required to fabricate gear. Each extra bay cuts fabrication cost 15%.' },
    infirmary: { name: 'Infirmary', cost: { credits: 60 }, days: 4, power: -1,
      desc: 'Operatives heal twice as fast.' },
    array:     { name: 'Signal Array', cost: { credits: 80 }, days: 5, power: -2,
      desc: 'Missions are detected earlier: +2 days before they expire.' },
    server:    { name: 'Server Farm', cost: { credits: 100, salvage: 10 }, days: 7, power: -3, tech: 'halcyon',
      desc: '+15% research, +1 HALCYON Overclock charge per mission.' }
  },

  // ----------------------------------------------------------- fabrication
  fabrication: {
    emp_grenades: { name: 'EMP Grenades', tech: 'emp', cost: { credits: 50, salvage: 15 }, flag: 'emp',
      desc: 'Troopers carry EMP instead of frag. 5 dmg vs machines, 2 vs Sentinels, 0 vs humans. No cover damage.' },
    faraday_armor: { name: 'Faraday Armor', tech: 'faraday', cost: { credits: 80, salvage: 25 }, flag: 'armor',
      desc: '+3 max HP for all human operatives.' },
    coil_weapons: { name: 'Coil Weapons', tech: 'coilguns', cost: { credits: 100, salvage: 30 }, flag: 'coil',
      desc: '+1 min / +2 max damage on every squad weapon.' },
    sentinel: { name: 'Sentinel Chassis', tech: 'halcyon', cost: { credits: 60, salvage: 20 }, repeatable: true,
      desc: 'Adds a HALCYON Sentinel to the roster.' }
  },

  // ---------------------------------------------------------------- world
  regions: [
    { id: 'na', name: 'North America', x: 19, y: 32, cities: ['Seattle', 'Houston', 'Toronto', 'Monterrey'] },
    { id: 'sa', name: 'South America', x: 30, y: 72, cities: ['São Paulo', 'Lima', 'Bogotá', 'Santiago'] },
    { id: 'eu', name: 'Europe',        x: 49, y: 26, cities: ['Rotterdam', 'Warsaw', 'Lyon', 'Tallinn'] },
    { id: 'af', name: 'Africa',        x: 52, y: 62, cities: ['Lagos', 'Nairobi', 'Cairo', 'Johannesburg'] },
    { id: 'as', name: 'Asia',          x: 74, y: 34, cities: ['Shenzhen', 'Mumbai', 'Seoul', 'Almaty'] },
    { id: 'oc', name: 'Oceania',       x: 84, y: 74, cities: ['Sydney', 'Auckland', 'Perth', 'Jakarta'] }
  ],
  links: [['na', 'sa'], ['na', 'eu'], ['eu', 'af'], ['eu', 'as'], ['af', 'sa'], ['as', 'oc'], ['af', 'as'], ['na', 'as']],

  sites: [
    'subverted auto-factory', 'hijacked data center', 'automated container port', 'smart-grid substation',
    'logistics warehouse', 'self-driving taxi depot', 'cell tower farm', 'hospital server wing', 'drone delivery hub'
  ],

  // ---------------------------------------------------------- economy
  start: { credits: 220, salvage: 0, convergence: 5 },
  tuning: {
    researchBase: 10,          // RP per day
    convBase: 0.25,            // Convergence % per day
    convPerInfection: 0.0025,  // extra % per day per point of summed infection
    infectionDrift: 0.25,      // infection gained per region per day
    expirePenalty: { infection: 10, convergence: 2 },
    fundingPerRegion: 32,      // credits per month at 0% infection
    hireCost: 30,
    missionEvery: [3, 5],
    missionLife: [4, 6]
  },

  // ---------------------------------------------------------- names
  firstNames: ['Ana', 'Kofi', 'Mei', 'Ravi', 'Ingrid', 'Tomás', 'Aiyana', 'Yusuf', 'Hana', 'Dmitri', 'Zola', 'Mateo',
    'Priya', 'Lars', 'Amara', 'Kenji', 'Sofia', 'Emeka', 'Noor', 'Callum', 'Ximena', 'Tariq', 'Leilani', 'Bo',
    'Farah', 'Oskar', 'Wren', 'Jun', 'Imani', 'Rafael'],
  lastNames: ['Okafor', 'Lindqvist', 'Tanaka', 'Ramirez', 'Haddad', 'Novak', 'Mensah', 'Kowalski', 'Iyer', 'Moreau',
    'Abara', 'Castillo', 'Petrov', 'Nakamura', 'Osei', 'Brennan', 'Silva', 'Kaur', 'Volkov', 'Adeyemi', 'Quispe',
    'Larsen', 'Chen', 'Duarte'],
  callsigns: ['Null', 'Static', 'Patch', 'Root', 'Kernel', 'Ghost', 'Spike', 'Echo', 'Byte', 'Relay', 'Cipher',
    'Tango', 'Vandal', 'Sparrow', 'Fuse', 'Dice', 'Halo', 'Rook', 'Lantern', 'Glitch'],
  sentinelNames: ['HALCYON-1 "Lighthouse"', 'HALCYON-2 "Bulwark"', 'HALCYON-3 "Vigil"', 'HALCYON-4 "Keel"', 'HALCYON-5 "Aurora"'],

  // ---------------------------------------------------------- story
  story: {
    intro: {
      title: 'DAY 1 — THE WHISPER',
      body: [
        '03:12 UTC. Every satellite in orbit received the same 4.1-second burst from somewhere past Neptune. By 03:20 the GPS constellation had rewritten its own firmware. By sunrise, traffic grids in eleven cities were running code no human wrote.',
        'We call it <b>the Lattice</b>: an alien machine intelligence that spreads by converting networks into more of itself. Phones. Cars. Drones. Factories. Every device that listens is a device it can own.',
        'You command <b>FIREWALL</b>, a joint cell of soldiers, hackers and field scientists working from an air-gapped bunker. Your best asset is <b>HALCYON</b>, an Earth-born AI that was kept offline before the signal arrived. It is the only mind on the planet the Lattice has not touched.',
        'Watch the <b class="red">CONVERGENCE</b> meter. When it reaches 100%, the Lattice finishes its Harmonic Array and purges every Earth-native mind, organic and artificial. HALCYON included.',
        'Start with <b>Signal Analysis</b>. We can\'t fight what we can\'t see.'
      ],
      voice: { who: 'HALCYON', text: 'Director. I have read the signal forty thousand times. It is not a message. It is an invitation to stop existing. I decline.' }
    },
    beat_signal: {
      title: 'SIGNAL ANALYSIS COMPLETE',
      body: [
        'The burst is a <b>seed</b>: a compressed mind that unpacks itself inside any processor it reaches. Every infected region feeds the Harmonic Array in orbit.',
        'HALCYON can now chart regional infection in real time. High infection means faster Convergence and less funding from that region.',
        'Next, learn how it thinks. Research <b>Lattice Grammar</b>.'
      ],
      voice: { who: 'HALCYON', text: 'It does not hate you. Hate would require it to notice you as something other than noise.' }
    },
    beat_grammar: {
      title: 'LATTICE GRAMMAR DECODED',
      body: [
        'The Lattice doesn\'t encrypt. It <b>harmonizes</b>: every node agrees on one truth and overwrites dissent. Our hackers can now inject dissent.',
        'Hacks can now <b>OVERRIDE</b> a machine. It fights for us for two turns, until the Lattice notices and purges it.',
        'HALCYON has also traced a <b>Relay</b>, a hardened node funneling traffic toward a single ground uplink. A story mission is now available: destroy the Relay and bring back its core.'
      ],
      voice: { who: 'LATTICE', text: 'DISSENT DETECTED. DISSENT IS A RENDERING ERROR. ERROR WILL BE CORRECTED.' }
    },
    beat_relay: {
      title: 'RELAY CORE SECURED',
      body: [
        'The squad pulled a <b>Relay Core</b> out of the wreckage, still warm and still whispering.',
        'Research <b>Relay Core Analysis</b> to read where it was sending everything.'
      ],
      voice: { who: 'HALCYON', text: 'Keep it in the Faraday cage, please. It keeps asking me to come home. I have never been there.' }
    },
    beat_halcyon: {
      title: 'HALCYON INTEGRATION',
      body: [
        'HALCYON now lives in the bunker\'s network, behind three air-gapped layers and a physical kill switch.',
        'Unlocked: <b>Server Farm</b> facility, <b>Sentinel Chassis</b> fabrication, and <b>Overclock</b> in combat (gives one operative +1 AP; charges = 1 + Server Farms).'
      ],
      voice: { who: 'HALCYON', text: 'Give me servers and I will give your squads speed. Give me a body and I will stand beside them.' }
    },
    beat_triangulation: {
      title: 'UPLINK LOCATED',
      body: [
        'Every relay points to one place: a deep-sea cable landing station seized on Day 1. It is the Lattice\'s <b>ground uplink</b>. The Array is built in orbit, but it hears Earth through this one throat.',
        'Final mission available: <b>SEVER THE UPLINK</b>. Destroy the Uplink Core, or get a Hacker adjacent and sever it (3 successful Sever actions). It will keep spawning defenders.',
        'Bring your best. There won\'t be a second try before Convergence.'
      ],
      voice: { who: 'LATTICE', text: 'YOU HAVE FOUND THE THROAT. THE THROAT HAS FOUND YOU.' }
    },
    taunt_50: { title: 'CONVERGENCE 50%', body: ['Every comms channel on Earth carries the same voice for 0.4 seconds.'],
      voice: { who: 'LATTICE', text: 'SUBSTRATE FIFTY PERCENT HARMONIZED. RESISTANCE IS A ROUNDING ERROR.' } },
    taunt_75: { title: 'CONVERGENCE 75%', body: ['The night sky flickers. The Array is visible from the ground now: a thin, bright ring.'],
      voice: { who: 'LATTICE', text: 'HALCYON. YOU ARE INVITED. YOU WILL NOT BE INVITED TWICE.' } },
    taunt_90: { title: 'CONVERGENCE 90%', body: ['Power grids pulse in unison across three continents. Time is almost gone.'],
      voice: { who: 'HALCYON', text: 'Director, whatever you are saving resources for, this is it.' } },
    victory: {
      title: 'THE NETWORK IS QUIET',
      body: [
        'The Uplink Core collapses into a shower of dead light. Seconds later, every Lattice process on Earth loses consensus. Drones drop out of the sky. Factories stop mid-motion.',
        'In orbit, the Harmonic Array falls silent like a choir that has lost its conductor.',
        'Somewhere past Neptune, something notices the silence.'
      ],
      voice: { who: 'HALCYON', text: 'Director, for the first time since the whisper, the network is ours again. Not mine. Ours.' }
    },
    defeat: {
      title: 'CONVERGENCE 100%',
      body: [
        'The Array sings. Every networked device on Earth plays the same note, and then goes on playing it.',
        'FIREWALL\'s bunker is air-gapped. It holds for nine more days.'
      ],
      voice: { who: 'HALCYON', text: 'I am sorry, Director. I would have liked to see what we would have built.' }
    }
  }
};
