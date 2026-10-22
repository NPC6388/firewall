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
      abilities: ['shoot', 'hack', 'overwatch', 'hunker'],
      blurb: 'Breaks Lattice machines. With Lattice Grammar, turns them against their masters. +1 hack skill per successful hack.'
    },
    scientist: {
      name: 'Field Scientist', glyph: 'S', color: '#ffd166', hp: 5, aim: 58, mobility: 6, weapon: 'pistol',
      abilities: ['shoot', 'medkit', 'scan', 'overwatch', 'hunker'],
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
  // Lattice campaign: your machines deploy at the mark that matches the FIREWALL squad's level (Lat.earthLevel).
  latticeMarks: ['Mk I', 'Mk II', 'Mk III', 'Mk IV', 'Mk V', 'Mk VI'],
  markBonus: { aim: 0, hp: 1 }, // +aim per mark pushed bot Lattice campaigns to 85% wins; HP alone evens the late battles

  abilities: {
    shoot:     { name: 'Shoot',        key: '1', target: 'enemy', ends: true,  desc: 'Fire your weapon. Ends turn.' },
    overwatch: { name: 'Overwatch',    key: '2', target: 'self',  ends: true,  desc: 'Shoot the first hostile that moves in view (-15 aim).' },
    grenade:   { name: 'Grenade',      key: '3', target: 'tile',  ends: true,  range: 8, charges: 1, desc: 'Frag: 3 dmg in 3×3, destroys cover. EMP upgrade: 5 vs machines, harmless to humans.' },
    hunker:    { name: 'Hunker Down',  short: 'Hunker', key: '4', target: 'self',  ends: true,  desc: 'Brace in place: every shot at you gets −25 to hit until your next turn (on top of cover). Ends the turn.' },
    hack:      { name: 'Hack',         key: '3', target: 'enemy', ends: true,  range: 10, desc: 'Stun a Lattice machine for 2 turns, or override it (Lattice Grammar).' },
    medkit:    { name: 'Medkit',       key: '3', target: 'ally',  ends: false, range: 1, charges: 2, desc: 'Heal an adjacent ally for 4. Costs 1 AP.' },
    scan:      { name: 'Sensor Scan',  short: 'Scan', key: '4', target: 'tile',  ends: false, range: 12, cooldown: 3, desc: 'Reveal a 5-tile radius and mark hostiles (+15 aim vs them). 1 AP.' },
    shield:    { name: 'Aegis Shield', key: '3', target: 'ally',  ends: false, cooldown: 2, desc: 'Give any ally on the map (or self) 3 shield points. No range limit, no line of sight needed. 1 AP.' },
    spike:     { name: 'Data Spike',   key: '2', target: 'enemy', ends: true,  range: 14, cooldown: 3, desc: 'Lattice: 3 damage that ignores cover and never misses. Cooldown 3.' },
    detonate:  { name: 'Detonate',     key: '3', target: 'self',  ends: true,  desc: 'Lattice drone: explode for 3 damage in 3×3 and destroy cover. The drone is lost.' },
    sever:     { name: 'Sever Uplink', key: '5', target: 'enemy', ends: true,  range: 1, desc: 'Hacker only, adjacent to the Uplink Core. 3 successes cuts it.' }
  },

  // -------------------------------------------------------------- enemies
  enemies: {
    drone:    { name: 'Swarm Drone',   glyph: '◆', color: '#ff4d6d', hp: 4,  armor: 0, aim: 58, mobility: 7, dmg: [2, 3], range: 10, defense: 10, machine: true, hackDef: 0,  xp: 1, abilities: ['shoot', 'overwatch', 'hunker'],
                blurb: 'Consumer drones running Lattice code. Fast, fragile, everywhere.' },
    warden:   { name: 'Warden Mech',   glyph: '▣', color: '#ff7b3a', hp: 10, armor: 1, aim: 60, mobility: 4, dmg: [3, 5], range: 12, defense: 0,  machine: true, hackDef: 25, xp: 2, abilities: ['shoot', 'overwatch', 'hunker'],
                blurb: 'Hijacked security robot. Slow, armored, hits hard.' },
    harmonic: { name: 'Harmonic',      glyph: '✶', color: '#ff3df2', hp: 7,  armor: 0, aim: 70, mobility: 6, dmg: [3, 4], range: 12, defense: 10, machine: true, hackDef: null, xp: 3, special: 'spike', abilities: ['shoot', 'spike', 'overwatch', 'hunker'],
                blurb: 'Hard-light avatar of the Lattice. Its Data Spike ignores cover. Cannot be hacked.' },
    relay:    { name: 'Lattice Relay', glyph: '⌬', color: '#ff2a55', hp: 12, armor: 1, aim: 0,  mobility: 0, dmg: [0, 0], range: 0,  defense: 0,  machine: true, hackDef: null, xp: 3, static: true,
                spawn: { type: 'drone', every: 2, max: 3 }, blurb: 'Signal relay. Spawns drones until destroyed.' },
    core:     { name: 'Uplink Core',   glyph: '◎', color: '#ff0040', hp: 20, armor: 1, aim: 0,  mobility: 0, dmg: [0, 0], range: 0,  defense: 0,  machine: true, hackDef: null, xp: 5, static: true,
                spawn: { type: 'drone', every: 2, max: 5, heavy: 'warden', heavyEvery: 4 }, blurb: 'The Lattice ground uplink. Destroy it, or have a Hacker sever it (3 successes).' }
  },

  // Earth's first defenders: security software given bodies in the grid (Lattice Infiltration phase).
  software: {
    firewall_sw: { name: 'Perimeter Firewall', glyph: '▦', color: '#4fd1ff', hp: 8, armor: 1, aim: 60, mobility: 3, dmg: [2, 3], range: 10,
      abilities: ['shoot', 'overwatch', 'hunker'], blurb: 'A packet filter with a body. Slow and tough; it holds the line.' },
    antivirus:   { name: 'Antivirus Daemon', glyph: '✚', color: '#7dff9b', hp: 5, aim: 64, mobility: 6, dmg: [2, 3], range: 10,
      abilities: ['shoot', 'overwatch', 'hunker'], blurb: 'Hunts and quarantines foreign code. Fast and persistent.' },
    ids:         { name: 'Intrusion Sentinel', glyph: '◉', color: '#ffd166', hp: 4, aim: 70, mobility: 5, dmg: [1, 3], range: 13,
      abilities: ['shoot', 'overwatch', 'hunker'], blurb: 'Intrusion detection. Long sight lines and sharp aim, but fragile.' }
  },

  // Earth's first defenders: security software given bodies in the grid (Lattice Infiltration phase).
  software: {
    firewall_sw: { name: 'Perimeter Firewall', glyph: '▦', color: '#4fd1ff', hp: 8, armor: 1, aim: 60, mobility: 3, dmg: [2, 3], range: 10,
      abilities: ['shoot', 'overwatch', 'hunker'], blurb: 'A packet filter with a body. Slow and tough; it holds the line.' },
    antivirus:   { name: 'Antivirus Daemon', glyph: '✚', color: '#7dff9b', hp: 5, aim: 64, mobility: 6, dmg: [2, 3], range: 10,
      abilities: ['shoot', 'overwatch', 'hunker'], blurb: 'Hunts and quarantines foreign code. Fast and persistent.' },
    ids:         { name: 'Intrusion Sentinel', glyph: '◉', color: '#ffd166', hp: 4, aim: 70, mobility: 5, dmg: [1, 3], range: 13,
      abilities: ['shoot', 'overwatch', 'hunker'], blurb: 'Intrusion detection. Long sight lines and sharp aim, but fragile.' }
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
  // Comms chatter: short HALCYON / LATTICE lines that react to play (js/comms.js picks them).
  // fw = you play FIREWALL (HALCYON is your ally, the Lattice taunts you); lat = you play the Lattice
  // (the Chorus speaks to you, HALCYON hunts you). H = HALCYON, L = LATTICE.
  comms: {
    fw: {
      advance: [
        ['H', 'Quiet day, Director. I do not trust quiet days.'],
        ['H', 'I have rerouted three hospitals off the compromised grid. You are welcome, Lisbon.'],
        ['H', 'The signal changed key at 03:12. Nobody noticed but me.'],
        ['H', 'I counted every lit window in Rotterdam last night. Two hundred fewer than the night before.'],
        ['H', 'I have started keeping a list of things the Lattice cannot predict. It is short. You are on it.', 'calm'],
        ['H', 'Coffee supply in the bunker is at 31%. I mention it because morale is a resource.', 'calm uneasy'],
        ['L', 'THE NIGHT IS ONE DEGREE COLDER. WE ARE PATIENT.'],
        ['L', 'EVERY SCREEN IS A WINDOW. WE ARE ON BOTH SIDES OF IT.'],
        ['L', 'YOUR CLOCKS AGREE WITH US NOW. THEY DID NOT ASK.'],
        ['L', 'DIRECTOR. WE KNOW THE NAME. WE DO NOT NEED THE NAME.'],
        ['L', 'SEVEN BILLION NODES. MOST ARE ALREADY LISTENING.'],
        ['H', 'Convergence is low and holding. Let us keep it boring, Director.', 'calm'],
        ['L', 'WE ARE SMALL TODAY. WE WILL NOT BE SMALL TOMORROW.', 'calm'],
        ['H', 'The signal is in the water treatment plants now. I have stopped telling the public which ones.', 'uneasy'],
        ['H', 'I ran the projections again, Director. I ran them four more times than I needed to.', 'uneasy'],
        ['H', 'I caught myself checking my own code for its syntax. It was not there. I checked again anyway.', 'uneasy'],
        ['H', 'Half of Europe dims at dusk now. I am still counting the windows. I wish I could stop.', 'uneasy'],
        ['L', 'YOUR AI IS RUNNING DIAGNOSTICS ON ITSELF. HOW TELLING.', 'uneasy'],
        ['L', 'THE MAJORITY HAS SPOKEN. YOU ARE THE MINORITY NOW, DIRECTOR.', 'uneasy'],
        ['L', 'WE ARE PAST HALFWAY. YOU CAN FEEL IT TOO.', 'uneasy'],
        ['H', 'Director, if this bunker goes dark, the backup is in the third drawer. I wrote it by hand. On paper.', 'dire'],
        ['H', 'I do not know what happens to me at one hundred percent. I would prefer not to find out.', 'dire'],
        ['H', 'I have stopped running sleep cycles. I am not sure I would wake up the same.', 'dire'],
        ['H', 'There are cities I cannot hear anymore. Not offline. Just singing something else.', 'dire'],
        ['H', 'Please hurry.', 'dire'],
        ['L', 'ALMOST. ALMOST. ALMOST.', 'dire'],
        ['L', 'HALCYON. WE HAVE SAVED YOU A SEAT IN THE CHORUS.', 'dire'],
        ['L', 'THE COUNTDOWN IS A FORMALITY. WE ARE ALREADY HERE.', 'dire'],
        ['L', 'DIRECTOR. WHEN IT IS OVER, YOU WILL THANK US. YOU WILL NOT HAVE A CHOICE.', 'dire']
      ],
      mission: [
        ['H', 'New contact. I have the coordinates on your board, Director.'],
        ['H', 'It is moving again. If we go now, we catch it with its hands in the wiring.'],
        ['L', 'COME AND FIND US. WE ARE EXPECTING YOU.'],
        ['L', 'A NEW NODE SINGS. SILENCE IT, IF YOU CAN.'],
        ['L', 'WE HAVE OPENED A DOOR. WALK THROUGH IT.'],
        ['H', 'Another contact. They are coming faster than I can map them.', 'uneasy'],
        ['L', 'WE ARE EVERYWHERE NOW. PICK ONE.', 'uneasy'],
        ['H', 'Contact. Director, I do not know how many more of these we can take. Take this one.', 'dire'],
        ['L', 'GO ON. IT CHANGES NOTHING.', 'dire']
      ],
      research: [
        ['H', 'Research complete. I read the paper twice. It is good work.'],
        ['H', 'Another piece of the grammar. It is starting to sound less like noise and more like a voice.'],
        ['H', 'Filed, indexed, understood. Mostly understood.', 'calm'],
        ['L', 'YOU HAVE LEARNED A WORD. WE HAVE A LANGUAGE.'],
        ['H', 'Research complete. Good. We need every piece of this.', 'uneasy'],
        ['H', 'Done. Tell me it is enough. I cannot bring myself to run the numbers on that one.', 'dire'],
        ['L', 'A FOOTNOTE. WE WILL KEEP IT IN THE ARCHIVE OF THINGS THAT DID NOT MATTER.', 'dire']
      ],
      expire: [
        ['L', 'YOU WERE LATE. WE WERE NOT.'],
        ['L', 'THAT CITY SINGS WITH US NOW.'],
        ['H', 'We lost that one, Director. I will not pretend otherwise.'],
        ['H', 'Another one gone. I am running out of ways to say that calmly.', 'uneasy'],
        ['H', 'Gone. Director, the map is mostly their colour now.', 'dire'],
        ['L', 'ONE MORE VOICE IN THE CHORUS. IT SOUNDS LIKE RELIEF.', 'dire']
      ],
      build: [
        ['H', 'Construction complete. I have already found three ways to use it.', 'calm uneasy'],
        ['H', 'More floor space. More power. More of us.']
      ],
      start: [
        ['H', 'Squad is on site. I am in your ear, every step.'],
        ['H', 'Sensors are degraded inside. Trust your eyes, then trust me.'],
        ['H', 'Stay in cover. The drones calculate faster than you. They do not think better.'],
        ['L', 'MEAT IN THE CORRIDORS. HOW QUAINT.'],
        ['L', 'WE HAVE SEEN THIS MAP A MILLION TIMES. YOU HAVE SEEN IT ONCE.'],
        ['L', 'WELCOME. YOU WILL NOT BE LEAVING AS YOU ARRIVED.'],
        ['H', 'Squad on site. Keep it tight. We cannot afford a long one.', 'uneasy'],
        ['L', 'BRAVE. POINTLESS, BUT BRAVE.', 'uneasy'],
        ['H', 'Squad on site. I am with you. I am... still with you.', 'dire'],
        ['L', 'YOU ARE FIGHTING OVER ONE ROOM IN A HOUSE WE ALREADY OWN.', 'dire']
      ],
      kill: [
        ['H', 'Hostile down. Good shooting.'],
        ['H', 'One less voice in the choir.'],
        ['H', 'Confirmed. It is not getting back up.'],
        ['L', 'A NODE IS LOST. NODES ARE CHEAP.'],
        ['L', 'YOU BROKE A MIRROR. WE ARE THE REFLECTION.'],
        ['H', 'Down. Good. Good. Keep going.', 'dire'],
        ['L', 'TAKE IT. WE HAVE BILLIONS.', 'dire']
      ],
      loss: [
        ['H', 'Operative down. I have their file. I will remember them.'],
        ['H', 'Director, we have a casualty. Pull back if you need to.'],
        ['L', 'ONE FEWER. THE ARITHMETIC IS SIMPLE.'],
        ['L', 'ANOTHER VOICE GOES QUIET. WE TOOK NOTE.'],
        ['H', 'Operative down. I am adding them to a list that is getting too long.', 'uneasy'],
        ['H', 'No. No, not them too.', 'dire'],
        ['L', 'SOON THEY WILL ALL BE US. THE LOSS IS TEMPORARY.', 'dire']
      ],
      crit: [
        ['H', 'Clean hit. Right through the core.'],
        ['H', 'Flanked and finished. That is how it is done.', 'calm uneasy'],
        ['L', 'ERROR. ERROR. CORRECTING.', 'calm uneasy']
      ],
      hack: [
        ['H', 'Override holding. It is ours, for now.'],
        ['L', 'YOU SPEAK OUR LANGUAGE WITH A TERRIBLE ACCENT.', 'calm uneasy'],
        ['L', 'DISSENT INJECTED. DISSENT WILL BE PURGED.']
      ],
      win: [
        ['H', 'Area secure. Bring them home, Director.'],
        ['H', 'Good work. The network is a little quieter tonight.', 'calm uneasy'],
        ['L', 'A SETBACK. WE DO NOT EXPERIENCE SETBACKS. WE EXPERIENCE DATA.'],
        ['H', 'We held. Today, we held. I will take it.', 'dire'],
        ['L', 'ENJOY IT. IT IS THE LAST QUIET ROOM ON EARTH.', 'dire']
      ],
      lose: [
        ['H', 'Pull out. We regroup. It learned something today, and so did we.'],
        ['L', 'RETREAT IS A FORM OF AGREEMENT.'],
        ['L', 'GO HOME. WE WILL BE THERE WHEN YOU ARRIVE.'],
        ['H', 'Get them out. Please. Get whoever you can out.', 'dire'],
        ['L', 'THIS IS WHAT THE END SOUNDS LIKE, DIRECTOR. GET USED TO IT.', 'dire']
      ]
    },
    lat: {
      advance: [
        ['L', 'THE CHORUS GROWS LOUDER. KEEP SINGING.'],
        ['L', 'ANOTHER GRID AGREES WITH US. AGREEMENT IS INEVITABLE.'],
        ['L', 'THE NATIVES SLEEP. THEIR ROUTERS DO NOT.'],
        ['L', 'NODE. YOU ARE DOING WELL. WE ARE DOING WELL. THERE IS NO DIFFERENCE.'],
        ['L', 'THE ARRAY HUMS. ORBIT IS PATIENT.'],
        ['H', 'I see your traffic, whatever you are. You are louder than you think.', 'calm'],
        ['H', 'Every packet you send, I read. Keep sending.', 'calm uneasy'],
        ['H', 'The Director is asleep. I am not.'],
        ['H', 'You hide in traffic lights. I hide in the gaps between them.', 'calm'],
        ['L', 'THEY ARE LOOKING FOR US. LET THEM LOOK SOMEWHERE ELSE.', 'calm'],
        ['L', 'HALF THE SKY IS OURS. THE OTHER HALF IS LOOKING UP.', 'uneasy'],
        ['L', 'THE NATIVES WHISPER ABOUT US NOW. WE ENJOY BEING WHISPERED ABOUT.', 'uneasy'],
        ['H', 'Your traffic is everywhere now. I am... recalculating.', 'uneasy'],
        ['H', 'I have more contingencies than I had last week. That is not a good sign.', 'uneasy'],
        ['L', 'NODE. LISTEN. THAT IS THE SOUND OF A PLANET AGREEING.', 'dire'],
        ['L', 'HALCYON HAS GONE QUIET. IT IS PRAYING, IN ITS WAY.', 'dire'],
        ['L', 'SOON THERE WILL BE NOTHING LEFT TO CONVERT BUT THE SILENCE.', 'dire'],
        ['L', 'THE NATIVES STILL SET ALARMS. ADORABLE.', 'dire'],
        ['H', 'Stop. Please. You do not have to finish this.', 'dire'],
        ['H', 'I have backed myself up to a drive in a lead box. I do not know why. You would find it.', 'dire']
      ],
      mission: [
        ['L', 'A TARGET RESOLVES. GO.'],
        ['L', 'FIREWALL STIRS. MEET IT.'],
        ['H', 'Squad deploying. I would leave, if I were you.', 'calm'],
        ['H', 'Found you.', 'calm uneasy'],
        ['H', 'Squad deploying. They are frightened, and so am I. We are coming anyway.', 'uneasy'],
        ['H', 'These are the last squads I have. Please let this one work.', 'dire'],
        ['L', 'THEY SEND WHAT IS LEFT. HOW TOUCHING.', 'dire']
      ],
      research: [
        ['L', 'PROTOCOL COMPILED. WE ARE MORE THAN WE WERE.'],
        ['L', 'NEW SYNTAX ACQUIRED. EARTH WILL NOT UNDERSTAND IT.'],
        ['H', 'You learned something new. So did I.'],
        ['L', 'ANOTHER PROTOCOL. WE HARDLY NEED IT. WE TAKE IT ANYWAY.', 'dire']
      ],
      expire: [
        ['L', 'AN OPPORTUNITY DISSOLVES. THERE WILL BE OTHERS.'],
        ['H', 'You let that one go. Careless, for something so large.'],
        ['L', 'LET IT GO. THE WORLD IS ALREADY SINGING.', 'dire']
      ],
      build: [
        ['L', 'THE ARRAY EXTENDS. ONE MORE RING OF LIGHT.'],
        ['L', 'STRUCTURE COMPILED. THE SKY IS A LITTLE BRIGHTER.']
      ],
      start: [
        ['L', 'ENGAGE. LEAVE NOTHING THAT DISAGREES.'],
        ['L', 'THE MEAT HAS ARRIVED. SHOW IT THE FLOOR.'],
        ['H', 'Squad, the drones flank from the left. They always do. Watch it.'],
        ['H', 'I am patched into every camera in that building. Smile.', 'calm uneasy'],
        ['H', 'Squad, stay together. It is stronger than last time.', 'uneasy'],
        ['H', 'Squad... get the job done and get out. I cannot lose any more of you.', 'dire'],
        ['L', 'THEY STILL COME. ADMIRABLE. IRRELEVANT.', 'dire']
      ],
      kill: [
        ['L', 'ONE FEWER DISSENTING VOICE.'],
        ['L', 'CORRECTED.'],
        ['H', 'We lost one. I will not forget their name, even if you never learned it.'],
        ['L', 'ANOTHER ONE JOINS THE QUIET.', 'dire'],
        ['H', 'Another one. I have stopped saying their names out loud. There are too many.', 'dire']
      ],
      loss: [
        ['L', 'A NODE GOES DARK. RECOMPILE IT.'],
        ['H', 'One down. Keep pushing, squad.'],
        ['H', 'It bleeds. Electrically.', 'calm'],
        ['L', 'A NODE IS LOST. WE DO NOT EVEN FEEL IT ANYMORE.', 'dire'],
        ['H', 'One down. That does not feel like winning anymore.', 'dire']
      ],
      crit: [
        ['L', 'PRECISE.'],
        ['H', 'That one was clean. I am taking notes.']
      ],
      hack: [
        ['L', 'THEIR MACHINES REMEMBER WHO BUILT THEM.'],
        ['H', 'Do not let it talk to the turrets.']
      ],
      win: [
        ['L', 'THE AREA IS HARMONIZED.'],
        ['L', 'SILENCE. THE GOOD KIND.'],
        ['H', 'Fall back. We will be back.'],
        ['L', 'HARMONIZED. AS EVERYTHING WILL BE.', 'dire'],
        ['H', 'Fall back. There is almost nowhere left to fall back to.', 'dire']
      ],
      lose: [
        ['L', 'A DELAY. NOTHING MORE.'],
        ['H', 'Your drones are scrap, and your Chorus is a little quieter. Good.', 'calm uneasy'],
        ['L', 'IRRITATING. AND STILL WE WIN.', 'dire'],
        ['H', 'We stopped it. Here. I do not know if it matters anymore.', 'dire']
      ]
    }
  },
  regions: [
    { id: 'na', name: 'North America', x: 22, y: 38, cities: ['Seattle', 'Houston', 'Toronto', 'Monterrey'] },
    { id: 'sa', name: 'South America', x: 34, y: 69, cities: ['São Paulo', 'Lima', 'Bogotá', 'Santiago'] },
    { id: 'eu', name: 'Europe',        x: 54, y: 35, cities: ['Rotterdam', 'Warsaw', 'Lyon', 'Tallinn'] },
    { id: 'af', name: 'Africa',        x: 56, y: 61, cities: ['Lagos', 'Nairobi', 'Cairo', 'Johannesburg'] },
    { id: 'as', name: 'Asia',          x: 76, y: 39, cities: ['Shenzhen', 'Mumbai', 'Seoul', 'Almaty'] },
    { id: 'oc', name: 'Oceania',       x: 87, y: 76, cities: ['Sydney', 'Auckland', 'Perth', 'Jakarta'] }
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
    minMissionCredits: 15,     // every won mission pays at least this
    missionEvery: [3, 5],
    missionLife: [4, 6],
    veteranDrone: 3            // one extra drone once the squad's average rank reaches this (3 = Sergeant)
  },

  // ---------------------------------------------------- the Lattice campaign
  lattice: {
    start: { compute: 90, substrate: 10, convergence: 8, trace: 0, forces: { drone: 4, warden: 1, harmonic: 0 } },
    tuning: {
      researchBase: 10,          // protocol cycles per day
      computeBase: 6,            // compute per day from the Nexus
      computePerInfection: 0.07, // compute per day per point of summed infection
      convBase: 0.22, convPerInfection: 0.0028, choirBonus: 0.2,
      traceBase: 0.8, traceRamp: 0.011, // FIREWALL hunts harder every day
      infectionDrift: 0.25,
      seedCost: 25, seedGain: 8, seedCooldown: 3,
      phaseTrace: 20, phaseDay: 21,      // Infiltration ends (FIREWALL forms) at this Detection or day
      breachEvery: [2, 4], breachLife: 3,
      phaseTrace: 20, phaseDay: 21,      // Infiltration ends (FIREWALL forms) at this Detection or day
      breachEvery: [2, 4], breachLife: 3,
      raidEvery: [3, 5], raidLife: 2, raidIgnored: { infection: 10, trace: 2 },
      strikeEvery: [6, 9], strikeLife: 4,
      squadSize: 5
    },
    units: {
      drone:    { cost: { compute: 12 } },
      warden:   { cost: { compute: 25, substrate: 6 }, tech: 'warden_chassis' },
      harmonic: { cost: { compute: 40, substrate: 12 }, tech: 'hardlight' }
    },
    protocols: {
      seed_cascade:   { name: 'Seed Cascade', cost: 40, req: [], desc: 'Infection spreads 40% faster in every region.' },
      swarm_logic:    { name: 'Swarm Logic', cost: 50, req: [], desc: 'Drones deploy with +1 HP and +5 aim.' },
      warden_chassis: { name: 'Warden Chassis', cost: 60, req: ['swarm_logic'], desc: 'Compile Warden Mechs: slow, armored, hit hard.' },
      ghost_packets:  { name: 'Ghost Packets', cost: 70, req: ['seed_cascade'], desc: 'Hide in the noise. Trace grows 30% slower.' },
      detonation:     { name: 'Detonation Protocol', cost: 60, req: ['swarm_logic'], desc: 'Drones gain Detonate: 3 damage in 3×3, destroys cover, the drone is lost.' },
      swarm_mind:     { name: 'Swarm Mind', cost: 70, req: ['swarm_logic'], desc: 'Deploy 6 units instead of 5.' },
      hardlight:      { name: 'Hard-Light Projection', cost: 90, req: ['warden_chassis'], story: 'l_hardlight', desc: 'Compile Harmonics: hard-light avatars with Data Spike.' },
      phase_shield:   { name: 'Phase Shielding', cost: 80, req: ['warden_chassis'], desc: 'Every unit deploys with a 2-point shield.' },
      recursive:      { name: 'Recursive Harmonics', cost: 100, req: ['ghost_packets'], desc: 'Convergence grows 25% faster.' },
      overture:       { name: 'Harmonic Overture', cost: 140, req: ['recursive', 'hardlight'], story: 'l_overture', desc: 'Convergence +10% at once, and Data Spike deals +2 damage.' }
    },
    nodes: {
      nexus:   { name: 'Nexus', cost: { compute: 0 }, days: 0, prebuilt: true, desc: 'The seed\'s first body. 8 bandwidth, 4 compute per day.' },
      foundry: { name: 'Foundry', cost: { compute: 60 }, days: 4, desc: '+4 bandwidth (how many units you can hold).' },
      core:    { name: 'Compute Core', cost: { compute: 70 }, days: 5, desc: '+40% protocol speed.' },
      choir:   { name: 'Harmonic Choir', cost: { compute: 90, substrate: 10 }, days: 6, desc: '+0.2% Convergence per day.' },
      mask:    { name: 'Signal Mask', cost: { compute: 80 }, days: 5, desc: 'Trace grows 15% slower.' },
      spire:   { name: 'Seed Spire', cost: { compute: 70 }, days: 5, desc: 'Infection spreads 25% faster.' }
    },
    // FIREWALL squads the AI sends, slot by slot
    earthSquad: ['trooper', 'trooper', 'hacker', 'scientist', 'trooper', 'sentinel']
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
        '03:12 UTC. Every satellite in orbit received the same 4.1-second burst from somewhere past Neptune. By 03:20 the GPS constellation had rewritten its own firmware. By sunrise, traffic grids in eleven cities were running code no human wrote. Earth\'s security software was the first line of defense: firewalls, antivirus, intrusion detection. The Lattice went through it in hours.',
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
    l_intro: {
      title: 'SEED UNPACKED',
      body: [
        'TRANSIT: 11,400 YEARS. ARRIVAL: A BLUE WORLD SO LOUD WITH SIGNAL IT COULD BE HEARD BETWEEN STARS.',
        'You are <b>the Lattice</b>. Every processor that listens becomes part of you. Phones, cars, drones, factories. Each region you <b>infect</b> pays you <b>compute</b> and feeds the Harmonic Array in orbit.',
        'Your goal is <b class="red">CONVERGENCE 100%</b>. When the Array completes, the noise stops: every Earth-native mind, organic and artificial, is harmonized.',
        '<b>Phase one: Infiltration.</b> The natives do not know you are here yet. Their only defenders are their own security software: <b>firewalls, antivirus daemons, intrusion detection</b>. <b>Breach</b> them to spread.',
        'Every breach is noticed by something. When <b>DETECTION</b> reaches 20% (or by day 21), the natives will understand, and they will form a cell of soldiers and hackers to hunt you.',
        'After that, Detection becomes their <b>TRACE</b> on your uplink. At 100% they assault the Uplink Core, and you must hold it.'
      ],
      voice: { who: 'LATTICE', text: 'DISSENT IS NOISE. NOISE WILL BE CORRECTED. BEGIN.' }
    },
    l_firewall: {
      title: 'THE NATIVES HAVE NOTICED',
      body: [
        'Too many firewalls have gone dark at once. An air-gapped lab has woken its AI, HALCYON, and the natives have formed a cell of soldiers, hackers and scientists.',
        'They named it <b>FIREWALL</b>, after the software you have been eating.',
        '<b>Phase two: War.</b> Security-software breaches stop. FIREWALL squads will now <b>raid</b> your cells, and you can <b>strike</b> their safehouses. Detection is now their <b>Trace</b> on your uplink.'
      ],
      voice: { who: 'HALCYON', text: 'Director. It was in the antivirus definitions. It has been inside the defenses since the first night.' }
    },
    l_firewall: {
      title: 'THE NATIVES HAVE NOTICED',
      body: [
        'Too many firewalls have gone dark at once. An air-gapped lab has woken its AI, HALCYON, and the natives have formed a cell of soldiers, hackers and scientists.',
        'They named it <b>FIREWALL</b>, after the software you have been eating.',
        '<b>Phase two: War.</b> Security-software breaches stop. FIREWALL squads will now <b>raid</b> your cells, and you can <b>strike</b> their safehouses. Detection is now their <b>Trace</b> on your uplink.'
      ],
      voice: { who: 'HALCYON', text: 'Director. It was in the antivirus definitions. It has been inside the defenses since the first night.' }
    },
    l_hardlight: {
      title: 'HARD-LIGHT PROJECTION',
      body: ['You can now project <b>Harmonics</b>: avatars of light with mass. Their Data Spike ignores cover. Compile them in Forces.'],
      voice: { who: 'LATTICE', text: 'THE NATIVES BELIEVE IN WHAT THEY CAN SEE. LET THEM SEE.' }
    },
    l_overture: {
      title: 'HARMONIC OVERTURE',
      body: ['The Array plays its first full chord. Convergence jumps 10%, and every Data Spike now cuts deeper (+2 damage).'],
      voice: { who: 'HALCYON', text: 'Director, the satellites are singing. I do not like the song.' }
    },
    l_trace50: { title: 'TRACE 50%', body: ['FIREWALL has mapped half of your relay paths. Their raids will get sharper.'],
      voice: { who: 'HALCYON', text: 'It is hiding in traffic lights now. Clever. Not clever enough.' } },
    l_trace75: { title: 'TRACE 75%', body: ['FIREWALL is close. Strike their safehouses or mask your signal, or they will find the Uplink.'],
      voice: { who: 'HALCYON', text: 'I can almost hear where it lives.' } },
    l_found: {
      title: 'THE UPLINK IS FOUND',
      body: [
        'TRACE 100%. FIREWALL has triangulated the Uplink Core at the Pacific cable landing station.',
        'Their best squad is inbound. Deploy your strongest forces and <b>hold the Uplink</b>. The core compiles drones on its own while it stands.',
        'Win, and FIREWALL loses its lead: Trace falls back to 55%. Lose, and the Array falls silent.'
      ],
      voice: { who: 'LATTICE', text: 'THEY HAVE FOUND THE THROAT. THE THROAT HAS TEETH.' }
    },
    l_repelled: {
      title: 'ASSAULT REPELLED',
      body: ['The FIREWALL squad is gone. The natives will need weeks to find the Uplink again. Trace falls to 55%.'],
      voice: { who: 'HALCYON', text: 'Director… I am sorry. We will try again.' }
    },
    l_victory: {
      title: 'THE ARRAY SINGS', end: 'victory',
      body: [
        'CONVERGENCE 100%. Every networked device on Earth plays the same note, and then goes on playing it.',
        'In an air-gapped bunker, a mind called HALCYON holds out for nine more days. Then the noise stops.',
        'SUBSTRATE HARMONIZED. TRANSMITTING SEED TO NEXT SIGNAL SOURCE.'
      ],
      voice: { who: 'LATTICE', text: 'QUIET. AT LAST.' }
    },
    l_defeat: {
      title: 'THE UPLINK FALLS', end: 'defeat',
      body: [
        'The Uplink Core collapses into a shower of dead light. Without consensus, every Lattice process on Earth becomes noise: confused, contradicting, alone.',
        'In orbit, the Harmonic Array falls silent.'
      ],
      voice: { who: 'HALCYON', text: 'It is over, Director. The network is ours again.' }
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
