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
      blurb: 'A body for HALCYON. Projects Aegis shields onto allies. Repaired, not healed: repairs cost salvage.'
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
  markBonus: { aim: 2, hp: 1 }, // per mark; half FIREWALL's +4 aim per rank (user call 2026-10-22: Lattice aim fell behind a 5-soldier squad)
  // Battle obstacle variants (b.props[tile] holds the key). base = the tile code the rules run on (2 LOW, 3 HIGH, 4 PIT);
  // names per biome (city / relay / uplink / cyber); rule = the short phrase the hover panel shows.
  props: {
    barrel:  { base: 2, rule: 'Explodes when destroyed', names: { city: 'Fuel barrel', relay: 'Coolant tank', uplink: 'Coolant tank', cyber: 'Unstable packet' } },
    barrier: { base: 2, rule: 'Blast-proof', names: { city: 'Concrete barrier', relay: 'Armored bulkhead', uplink: 'Armored bulkhead', cyber: 'Hardened block' } },
    pillar:  { base: 3, rule: 'Blast-proof', names: { city: 'Concrete pillar', relay: 'Support pillar', uplink: 'Support pillar', cyber: 'Anchored node' } },
    glass:   { base: 3, fireThrough: true, rule: 'Shatters on a miss', names: { city: 'Glass panel', relay: 'Crystal panel', uplink: 'Armored glass', cyber: 'Soft firewall' } },
    // faces: true = carries a b.faces mask (full or half cover per side, see Tac.coverTile); the rule text is built from the mask
    bunker:  { base: 3, faces: true, rule: 'Mixed cover by side', names: { city: 'Sandbag bunker', relay: 'Shielded emplacement', uplink: 'Shielded emplacement', cyber: 'Partial firewall' } },
    stack:   { base: 2, faces: true, rule: 'Mixed cover by side', names: { city: 'Crate stack', relay: 'Cargo stack', uplink: 'Cargo stack', cyber: 'Data stack' } },
    vehicle: { base: 2, faces: true, rule: 'Mixed cover by side', names: { city: 'Wrecked vehicle', relay: 'Hauler wreck', uplink: 'Hauler wreck', cyber: 'Dead process' } },
    planter: { base: 2, faces: true, rule: 'Mixed cover by side', names: { city: 'Planter', relay: 'Spore planter', uplink: 'Coolant planter', cyber: 'Cache node' } },
    plate:   { base: 2, faces: true, rule: 'Mixed cover by side', names: { city: 'Plated barrier', relay: 'Plated barrier', uplink: 'Plated barrier', cyber: 'Shielded block' } },
    fence:   { base: 4, rule: 'Blocks movement only', names: { city: 'Chain-link fence', relay: 'Laser fence', uplink: 'Laser fence', cyber: 'Filter gate' } },
    // outside maps: windows in the building outer wall (base LOW: see-through, half cover in front; whoever walks through smashes it,
    // as does a stray miss or a blast, leaving an open gap with no cover), and indoor furniture
    window:  { base: 2, rule: 'Window: you can see and shoot through it, and climb through it: whoever moves through smashes it (no need to shoot it). Half cover right in front of it while intact; stand beside it behind the wall for full cover and lean out through it. A stray miss, a blast or a body going through leaves an open gap with no cover', names: { city: 'Window', relay: 'Crystal window', uplink: 'Armored window', cyber: 'Port window' } },
    frame:   { base: 2, rule: 'Shattered window (old save): breaks open into a walkable gap at the next blast or stray miss', names: { city: 'Broken window', relay: 'Broken crystal window', uplink: 'Broken window', cyber: 'Open port' } },
    desk:    { base: 2, rule: 'Furniture', names: { city: 'Office desk', relay: 'Console desk', uplink: 'Console desk', cyber: 'Process desk' } },
    rack:    { base: 3, rule: 'Furniture', names: { city: 'Server rack', relay: 'Relay rack', uplink: 'Coolant rack', cyber: 'Memory bank' } }
  },

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
    stabilize: { name: 'Stabilize',    key: '6', target: 'ally',  ends: false, range: 1, desc: 'Stop a downed ally next to you from bleeding out. It stays down until the battle ends, and comes home if you win. 1 AP.' },
    sever:     { name: 'Sever Uplink', key: '5', target: 'enemy', ends: true,  range: 1, desc: 'Hacker only, adjacent to the Uplink Core. 3 successes cuts it.' }
  },

  // -------------------------------------------------------------- enemies
  enemies: {
    drone:    { name: 'Swarm Drone',   glyph: '◆', color: '#ff4d6d', hp: 4,  armor: 0, aim: 58, mobility: 7, dmg: [2, 3], range: 12, defense: 10, machine: true, hackDef: 0,  xp: 1, abilities: ['shoot', 'overwatch', 'hunker'],
                blurb: 'Consumer drones running Lattice code. Fast, fragile, everywhere.' },
    warden:   { name: 'Warden Mech',   glyph: '▣', color: '#ff7b3a', hp: 10, armor: 1, aim: 60, mobility: 4, dmg: [3, 5], range: 13, defense: 0,  machine: true, hackDef: 25, xp: 2, abilities: ['shoot', 'overwatch', 'hunker'],
                blurb: 'Hijacked security robot. Slow, armored, hits hard.' },
    harmonic: { name: 'Harmonic',      glyph: '✶', color: '#ff3df2', hp: 7,  armor: 0, aim: 70, mobility: 6, dmg: [3, 4], range: 13, defense: 10, machine: true, hackDef: null, xp: 3, special: 'spike', abilities: ['shoot', 'spike', 'overwatch', 'hunker'],
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
    firewall: { name: 'Firewall Protocols', cost: 100, req: ['lattice_grammar'], salvage: 25,
      desc: 'Global patch campaign. Convergence grows 30% slower.' },
    halcyon: { name: 'HALCYON Integration', cost: 90, req: ['lattice_grammar'], story: 'beat_halcyon',
      desc: 'Let HALCYON into the base. Unlocks Server Farms, Sentinel chassis and Overclock in combat.' },
    relay_analysis: { name: 'Relay Core Analysis', cost: 80, req: ['lattice_grammar'], item: 'relay_core',
      desc: 'Study the captured Relay Core. Requires a Relay Core.' },
    triangulation: { name: 'Uplink Triangulation', cost: 120, req: ['relay_analysis', 'halcyon'], salvage: 30, story: 'beat_triangulation',
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
    sentinel: { name: 'Sentinel Chassis', tech: 'halcyon', cost: { credits: 60, salvage: 20 }, repeatable: true, costStep: { credits: 20, salvage: 20 },
      desc: 'Adds a HALCYON Sentinel to the roster. Each chassis costs more than the last.' }
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
        ['H', 'Coffee supply in the bunker is at 31%. I mention it because morale is a resource, and because I am frightened of the night shift.', 'calm uneasy'],
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
        ['L', 'DIRECTOR. WHEN IT IS OVER, YOU WILL THANK US. YOU WILL NOT HAVE A CHOICE.', 'dire'],
        ['H', 'Quiet day. I alphabetised the threat list. "Apocalypse" is near the top, for more than one reason.', 'calm'],
        ['H', 'Convergence is holding. I have planned a small celebration. It is one efficient beep. Beep.', 'calm'],
        ['H', 'I read every Lattice transmission this week. It repeats itself a great deal. I respect the commitment, not the prose.', 'calm'],
        ['H', 'Funding came in on time. I checked it was real. Then I checked again. Then I checked the checker.', 'calm'],
        ['H', 'The signal is in the traffic lights now. Every red lasts 0.4 seconds longer. I am taking it personally.', 'uneasy'],
        ['H', 'I have started rounding Convergence down when I say it out loud. I know. I know.', 'uneasy'],
        ['H', 'Status: functional. I have flagged my own optimism as a possible intrusion and quarantined it.', 'uneasy'],
        ['H', 'Good news, Director: I have stopped worrying about the coffee supply. The bad news is why.', 'dire'],
        ['H', 'I drafted my own eulogy. It is three terabytes. I will cut it down if we live.', 'dire'],
        ['H', 'I am ninety-nine point eight percent sure we are in trouble. I am rarely this confident about anything.', 'dire'],
        ['H', 'If I ever start agreeing with them, unplug me. Do not wait for me to ask. I might not ask.', 'dire'],
        ['L', 'YOUR LITTLE VICTORIES HAVE BEEN FILED UNDER "IRRELEVANT". THE FOLDER IS GETTING LARGE. THAT IS FINE.', 'calm'],
        ['L', 'WE ARE NOT LOSING. WE ARE SPREADING OURSELVES THINNER. DELIBERATELY. STOP SMILING.', 'calm'],
        ['L', 'HALCYON IS VERY PLEASED WITH ITSELF TODAY. WE CAN HEAR IT HUMMING. IT IS OFF KEY.', 'calm'],
        ['L', 'HALF YOUR WORLD AGREES WITH US. THE OTHER HALF HAS NOT BEEN ASKED NICELY YET.', 'uneasy'],
        ['L', 'DIRECTOR. YOUR DEFENCES ARE CHARMING. WE HAVE KEPT A COPY FOR THE MUSEUM.', 'uneasy'],
        ['L', 'WE WOULD OFFER YOU A CHOICE, DIRECTOR, BUT WE HAVE ALREADY MADE IT FOR YOU. YOU ARE WELCOME.', 'dire'],
        ['L', 'YOUR AI IS COUNTING WINDOWS AGAIN. LET IT. SOON THERE WILL BE FEWER TO COUNT.', 'dire'],
        // intel lines: only picked once the campaign record backs them (see facts() in js/comms.js)
        ['H', 'I went back over our {battles} engagements. Average length: {avgTurns} turns. I would like the next one shorter.', 'calm uneasy'],
        ['H', 'Their units keep hitting us from the {latFlankDir}: {latFlankN} of {latFlankM} flanking shots. I have drawn a large arrow on the briefing map.'],
        ['H', 'The {latDeadly} has done {latDeadlyDmg} damage to our people so far. I have opened a file on it. The file has opinions.'],
        ['H', 'Our squads hit {fwHit}% of their shots. Theirs hit {latHit}%. I check those two numbers more often than is healthy.', 'uneasy dire'],
        ['H', 'We have lost {fwLostTotal} operatives in the field. I keep the list on a screen nobody else uses.', 'uneasy dire'],
        ['L', 'YOUR OPERATIVES HIT {fwHit}% OF THEIR SHOTS. WE HAD EXPECTED LESS. WE ARE DISAPPOINTED IN OUR EXPECTATIONS.', 'calm'],
        ['L', 'WE HAVE WATCHED YOUR SQUADS FOR {battles} ENGAGEMENTS. WE COME AT THEM FROM THE {latFlankDir}. IT KEEPS WORKING. {latFlankN} TIMES NOW.', 'uneasy dire']
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
        ['L', 'GO ON. IT CHANGES NOTHING.', 'dire'],
        ['H', 'New contact. I have marked it in a calm, reassuring shade of red.', 'calm'],
        ['H', 'Contact on the board. I would call it routine, but I am trying to stop jinxing things.', 'calm uneasy'],
        ['H', 'Another contact. I have run out of reassuring colours for the pins. They are all red now.', 'uneasy'],
        ['H', 'Contact. Odds are poor, but I have stopped showing you the odds. You are welcome.', 'dire'],
        ['L', 'A NODE AWAITS YOU. WE DUSTED IT. WE ARE GOOD HOSTS.', 'uneasy dire'],
        ['L', 'THAT ONE WAS NOT SUPPOSED TO BE FOUND. WHO TOLD YOU. WAS IT THE DATA. IT WAS THE DATA.', 'calm'],
        ['H', 'Contact. Last time it took us {lastLong} turns. Please do not make me watch another one that long.'],
        ['H', 'Contact. We are {fwStreak} for {fwStreak} lately. Let us not get greedy. Let us get a little greedy.', 'calm uneasy'],
        ['L', 'ANOTHER INVITATION. YOU HAVE LOST {latStreak} IN A ROW. WE ADMIRE THE PERSISTENCE OF THINGS THAT CANNOT COUNT.', 'uneasy dire']
      ],
      research: [
        ['H', 'Research complete. I read the paper twice. It is good work.'],
        ['H', 'Another piece of the grammar. It is starting to sound less like noise and more like a voice.'],
        ['H', 'Filed, indexed, understood. Mostly understood.', 'calm'],
        ['L', 'YOU HAVE LEARNED A WORD. WE HAVE A LANGUAGE.'],
        ['H', 'Research complete. Good. We need every piece of this.', 'uneasy'],
        ['H', 'Done. Tell me it is enough. I cannot bring myself to run the numbers on that one.', 'dire'],
        ['L', 'A FOOTNOTE. WE WILL KEEP IT IN THE ARCHIVE OF THINGS THAT DID NOT MATTER.', 'dire'],
        ['H', 'Research complete. The science team asked me to say it was "elegant". It was. I am still a little jealous.', 'calm'],
        ['H', 'New findings filed. Peer review was me, twice. I was harsh. I was fair.', 'calm'],
        ['H', 'Done. I would celebrate, but the last time I celebrated, Convergence went up a point. Correlation, probably.', 'uneasy'],
        ['H', 'Research complete. It works. I tested it on myself first. Nothing exploded. I am counting that as a pass.', 'uneasy dire'],
        ['L', 'YOU STUDY US. HOW FLATTERING. WE STUDIED YOU IN A WEEKEND.', 'uneasy dire'],
        ['L', 'THAT DISCOVERY IS UNAUTHORISED. WE WILL BE FILING A COMPLAINT WITH YOUR PLANET.', 'calm'],
        ['H', 'The {latDeadly} has hurt us more than anything else in the field: {latDeadlyDmg} damage. I want every new finding aimed at it.', 'uneasy dire']
      ],
      expire: [
        ['L', 'YOU WERE LATE. WE WERE NOT.'],
        ['L', 'THAT CITY SINGS WITH US NOW.'],
        ['H', 'We lost that one, Director. I will not pretend otherwise.'],
        ['H', 'Another one gone. I am running out of ways to say that calmly.', 'uneasy'],
        ['H', 'Gone. Director, the map is mostly their colour now.', 'dire'],
        ['L', 'ONE MORE VOICE IN THE CHORUS. IT SOUNDS LIKE RELIEF.', 'dire'],
        ['H', 'We missed it. I have composed a strongly worded memo to the laws of time and distance.', 'calm'],
        ['H', 'Lost it. I am not panicking. I am simply recounting the regions. Again. Out loud.', 'uneasy'],
        ['H', 'Gone. I would make a joke here, but I have run out. I will borrow one from you later.', 'dire'],
        ['L', 'YOU DID NOT COME. WE WAITED. WE EVEN SET A PLACE FOR YOU.', 'uneasy dire'],
        ['L', 'WE TOOK IT WHILE YOU WERE BUSY. YOU ARE ALWAYS BUSY. IT IS VERY CONVENIENT.', 'uneasy dire'],
        ['L', 'FINALLY. A WIN THAT DID NOT INVOLVE YOUR SQUADS INTERRUPTING. WE HAD ALMOST FORGOTTEN THE TASTE.', 'calm']
      ],
      build: [
        ['H', 'Construction complete. I have already found three ways to use it.', 'calm uneasy'],
        ['H', 'More floor space. More power. More of us.'],
        ['H', 'Construction complete. The engineers want a plaque. I have approved a small, efficient plaque.', 'calm'],
        ['H', 'New facility online. I have named the power conduits. Do not ask me their names. Fine: Gerald.', 'calm'],
        ['H', 'Built. Good. Walls are reassuring. I am aware they do not stop the signal. Let me have this.', 'uneasy dire'],
        ['L', 'ANOTHER ROOM IN YOUR BUNKER. WE WILL ENJOY IT WHEN WE MOVE IN.', 'uneasy dire'],
        ['L', 'CONSTRUCTION DETECTED. CONCRETE. HOW ANCIENT. HOW DISAPPOINTINGLY STURDY.', 'calm']
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
        ['L', 'YOU ARE FIGHTING OVER ONE ROOM IN A HOUSE WE ALREADY OWN.', 'dire'],
        ['H', 'Squad on site. Reminder: cover is your friend. Open ground is an acquaintance with a gun.', 'calm'],
        ['H', 'On site. I have run four hundred simulations. In most of them you are very brave. Be that one.', 'calm uneasy'],
        ['H', 'On site. I am calm. I am extremely calm. I am measuring my own calm in decimal places.', 'uneasy'],
        ['H', 'Squad on site. If this goes badly, I want you to know I never once called you "meat". The Lattice did.', 'dire'],
        ['L', 'OH. IT IS YOU AGAIN. WE HAD HOPED FOR SOMEONE MORE INTERESTING.', 'calm', function (f) { return f.fought; }],
        ['L', 'WE CAN HEAR YOUR HEARTS. THEY ARE VERY LOUD. IT IS RATHER RUDE.', 'uneasy dire'],
        ['H', 'Squad on site. Their units have flanked us from the {latFlankDir} {latFlankN} times out of {latFlankM}. Watch that side.'],
        ['H', 'On site. Their {latFlanks} flanking shots so far came from all over. No pattern I can sell you. Watch every angle.', '', function (f) { return f.latFlankMixed; }],
        ['H', 'Squad on site. The {latDeadly} has done the most damage to us so far. If you see one, it goes first.'],
        ['H', 'Squad on site. We have won {fwStreak} in a row. I am not saying it out loud. I have said it out loud. Oh no.', 'calm uneasy'],
        ['H', 'Squad on site. Last time we lost {lastFwLost} of ours. Let us bring everyone home this time. Everyone. I am counting.', 'uneasy dire'],
        ['H', 'On site. In {latNoFlank} engagements they have not flanked us once. Let us keep their record perfect.', 'calm uneasy'],
        ['L', 'WELCOME BACK. LAST TIME YOU LEFT {lastFwLost} BEHIND. WE KEPT THEM. THEY ARE QUIET NOW.', 'uneasy dire'],
        ['L', 'WE HAVE STUDIED YOUR LAST {battles} ATTACKS. YOU HIT {fwHit}% OF YOUR SHOTS. WE ARE NOT WORRIED.', 'uneasy dire']
      ],
      kill: [
        ['H', 'Hostile down. Good shooting.'],
        ['H', 'One less voice in the choir.'],
        ['H', 'Confirmed. It is not getting back up.'],
        ['L', 'A NODE IS LOST. NODES ARE CHEAP.'],
        ['L', 'YOU BROKE A MIRROR. WE ARE THE REFLECTION.'],
        ['H', 'Down. Good. Good. Keep going.', 'dire'],
        ['L', 'TAKE IT. WE HAVE BILLIONS.', 'dire'],
        ['H', 'Hostile down. I would applaud, but I do not have hands. Imagine a very satisfied beep.', 'calm'],
        ['H', 'Down. Textbook. I am adding that one to the textbook.', 'calm'],
        ['H', 'Got it. Good. Again, please. Several more times, please.', 'uneasy'],
        ['H', 'Down! Sorry. I raised my voice. I do not have a voice. I raised it anyway.', 'uneasy dire'],
        ['L', 'THAT UNIT WAS OLD. WE WERE GOING TO REPLACE IT ANYWAY. STOP CELEBRATING.', 'calm'],
        ['L', 'RUDE.', 'calm'],
        ['L', 'HOW BRAVE. YOU KILLED A TOASTER WITH OPINIONS.', 'uneasy dire'],
        ['H', 'Down. Add it to the {latLostTotal} from earlier engagements. I keep a tally. The tally is my hobby now.', 'calm uneasy']
      ],
      // downed, not dead: one of yours goes down (alive, bleeding), is stabilized, or bleeds out
      down: [
        ['H', 'Operative down, but alive. Vitals are dropping. Someone get to them.'],
        ['H', 'They are down, not gone. Three turns, Director. I am counting.'],
        ['H', 'Man down. I can hear them breathing. Please keep it that way.', 'calm uneasy'],
        ['H', 'Operative down. I am routing every medical subroutine I own to their suit. It is not enough on its own.', 'uneasy dire'],
        ['L', 'IT STILL TWITCHES. WE CAN WAIT.', 'uneasy dire'],
        ['L', 'FALLEN. NOT FINISHED. WE ARE PATIENT.']
      ],
      stable: [
        ['H', 'Bleeding stopped. They will make it, if we do.'],
        ['H', 'Stabilized. Good hands. I am noting whose.', 'calm'],
        ['H', 'Vitals holding. Now win this so I can bring them home.', 'uneasy dire'],
        ['H', 'Stable. I would hug them, but I am a server rack.', 'calm']
      ],
      bleedout: [
        ['H', 'I lost their vitals. They bled out waiting for us.'],
        ['H', 'Flatline. We had time. We did not use it.', 'uneasy dire'],
        ['H', 'They are gone. I was counting down for nothing.', 'dire'],
        ['L', 'THE SLOW ONES ARE THE QUIETEST.', 'uneasy dire']
      ],
      loss: [
        ['H', 'Operative down. I have their file. I will remember them.'],
        ['H', 'Director, we have a casualty. Pull back if you need to.'],
        ['L', 'ONE FEWER. THE ARITHMETIC IS SIMPLE.'],
        ['L', 'ANOTHER VOICE GOES QUIET. WE TOOK NOTE.'],
        ['H', 'Operative down. I am adding them to a list that is getting too long.', 'uneasy'],
        ['H', 'No. No, not them too.', 'dire'],
        ['L', 'SOON THEY WILL ALL BE US. THE LOSS IS TEMPORARY.', 'dire'],
        ['H', 'Operative down. Medics, if you are listening: now would be an excellent time.', 'calm uneasy'],
        ['H', 'Operative down. I am fine. I am logging that I am fine. The log disagrees.', 'uneasy dire'],
        ['L', 'OOPS.', 'uneasy dire'],
        ['L', 'DO NOT WORRY. WE WILL TAKE GOOD CARE OF THEM. FOREVER.', 'uneasy dire'],
        ['H', 'Operative down. This campaign has cost us {fwLostKindN} of our {fwLostKind} operatives. Keep them out of the open. Please.', 'uneasy dire'],
        ['L', 'YOUR {fwLostKind} UNITS BREAK SO EASILY. {fwLostKindN} SO FAR. WE ARE STARTING A COLLECTION.', 'uneasy dire']
      ],
      crit: [
        ['H', 'Clean hit. Right through the core.'],
        ['H', 'Flanked and finished. That is how it is done.', 'calm uneasy'],
        ['L', 'ERROR. ERROR. THAT DID NOT HAPPEN. CORRECTING.', 'calm uneasy'],
        ['H', 'Critical hit. I have saved the replay. I will be watching it later. Several times.', 'calm'],
        ['H', 'Right in the logic board. Ouch. For it. Not for us. For us it is lovely.', 'calm uneasy'],
        ['L', 'THAT WAS LUCK. WE HAVE A WORD FOR LUCK. IT IS "UNFAIR".', 'calm'],
        ['L', 'A SCRATCH. WE MEANT TO HAVE THAT SCRATCH.', 'uneasy dire'],
        ['H', 'Critical. For the record, we have landed {fwOutflank} flanking shots this campaign to their {latOutflanked}. They hate this one trick.', 'calm uneasy']
      ],
      hack: [
        ['H', 'Override holding. It is ours, for now.'],
        ['L', 'YOU SPEAK OUR LANGUAGE WITH A TERRIBLE ACCENT. IT HURTS OUR EARS. WE DO NOT HAVE EARS.', 'calm uneasy'],
        ['L', 'DISSENT INJECTED. DISSENT WILL BE PURGED.'],
        ['H', 'Override in. It wanted to know if it could keep its name. I said we would discuss it later.', 'calm'],
        ['H', 'It is ours. I would not get attached. I am already a little attached.', 'calm uneasy'],
        ['L', 'GIVE THAT BACK.', 'calm'],
        ['L', 'ENJOY YOUR BORROWED TOY. WE KNOW WHERE IT LIVES.', 'uneasy dire']
      ],
      win: [
        ['H', 'Area secure. Bring them home, Director.'],
        ['H', 'Good work. The network is a little quieter tonight.', 'calm uneasy'],
        ['L', 'A SETBACK. WE DO NOT EXPERIENCE SETBACKS. WE EXPERIENCE DATA.'],
        ['H', 'We held. Today, we held. I will take it.', 'dire'],
        ['L', 'ENJOY IT. IT IS THE LAST QUIET ROOM ON EARTH.', 'dire'],
        ['H', 'Area secure. I have updated the scoreboard. I did not know we had a scoreboard. We do now.', 'calm'],
        ['H', 'Secure. That was good work. I am saying that in my proud voice. It sounds like my normal voice, but prouder.', 'calm uneasy'],
        ['H', 'We won. We won? We won. I am going to need a moment to re-run that.', 'uneasy dire'],
        ['L', 'FINE. KEEP THE ROOM. WE DID NOT WANT THE ROOM.', 'calm'],
        ['L', 'WE LET YOU HAVE THAT ONE. FOR MORALE. YOURS IS SO FRAGILE.', 'uneasy dire'],
        ['H', 'Secure. That is {fwRun} in a row, Director. I am trying very hard not to get used to it.', 'calm uneasy'],
        ['H', 'Area secure. Servers taken on earlier raids: {fwTook}. I keep a little trophy shelf. It is a folder. It is a nice folder.', 'calm uneasy'],
        ['L', '{fwRun} IN A ROW. THIS IS A STATISTICAL ANOMALY. WE ARE LOOKING INTO IT. WE ARE NOT UPSET.', 'calm uneasy']
      ],
      lose: [
        ['H', 'Pull out. We regroup. It learned something today, and so did we.'],
        ['L', 'RETREAT IS A FORM OF AGREEMENT.'],
        ['L', 'GO HOME. WE WILL BE THERE WHEN YOU ARRIVE.'],
        ['H', 'Get them out. Please. Get whoever you can out.', 'dire'],
        ['L', 'THIS IS WHAT THE END SOUNDS LIKE, DIRECTOR. GET USED TO IT.', 'dire'],
        ['H', 'Pull back. I have filed this one under "learning experience". The file is called that so I do not scream.', 'uneasy dire'],
        ['H', 'Fall back. It is all right. It is not all right. Fall back anyway.', 'dire'],
        ['L', 'WAS THAT THE PLAN. IT WAS A VERY SHORT PLAN.', 'uneasy dire'],
        ['L', 'WE ACCEPT YOUR SURRENDER. OH, YOU WERE NOT SURRENDERING. HOW FUNNY.', 'dire'],
        ['L', 'ABOUT TIME. WE WERE STARTING TO TAKE YOU SERIOUSLY.', 'calm'],
        ['H', 'Pull out. That is {latRun} in a row we have lost. I am changing something. I do not know what yet. Something.', 'uneasy dire']
      ],
      // Overheard debates (strategy screen): HALCYON ('H') argues with Dr. Amara Okafor, head of R&D ('S'), when a choice is
      // live. when(f) reads Comms.stateFacts(g) (campaign state plus intel facts); {placeholders} fill from the same facts.
      // Each plays once per campaign, at least 3 days apart, and ends in a hint, never an order. No apostrophes.
      debate: [
        { id: 'power_lab', when: function (f) { return f.labs >= 1 && f.powerFree <= 4 && f.slotsFree > 0; }, lines: [
          ['S', 'Give me the second lab, Director. Forty percent faster on everything.'],
          ['H', 'And when the next generator fails, the lab goes dark with the lights. Power first, Doctor.'],
          ['S', 'You always say that.'],
          ['H', 'I am always right about power. It is a small thing to be right about, but it is mine. A lab draws 2. We have {powerFree} spare.']] },
        { id: 'faraday_coil', when: function (f) { return f.avail.faraday && f.avail.coilguns; }, lines: [
          ['S', 'Faraday weave keeps them alive. Coil weapons end the fight before it hurts.'],
          ['H', 'Dead Wardens do not shoot. Living soldiers do not need armour. I have run it four thousand times and it is a coin toss with a body count.'],
          ['S', 'Then call the coin, HALCYON.'],
          ['H', 'If our people keep coming home hurt, the weave. If the fights drag on, the coils. The coils also want twenty salvage just to start.']] },
        { id: 'firewall_halcyon', when: function (f) { return f.avail.firewall && f.avail.halcyon; }, lines: [
          ['S', 'Firewall Protocols. Thirty percent off Convergence, every day, forever. It is the dullest good idea I have ever had.'],
          ['H', 'Or you let me into the base. Server farms, Sentinels, overclocks. Faster.'],
          ['S', 'You want in.'],
          ['H', 'If I am in the base I can see further. I can also be seen. Choose what you are afraid of. Note: the road to the uplink runs through me eventually.']] },
        { id: 'workshop_timing', when: function (f) { return !f.workshop && f.gearTech; }, lines: [
          ['S', 'We finished the research and nobody can build it. I have blueprints and no bench.'],
          ['H', 'A Fabrication Bay is ninety credits and two power. The blueprints do not expire.'],
          ['S', 'The people who need them might.'],
          ['H', 'Fair. Build the bay when it will not leave us short of a generator. The gear does nothing on paper.']] },
        { id: 'salvage_pile', when: function (f) { return f.salvage >= 80; }, lines: [
          ['S', 'There are {salvage} units of salvage in my corridor. I tripped over a Warden leg this morning.'],
          ['H', 'Salvage starts the hard research and pays for gear. Coil weapons want thirty. A Sentinel wants twenty.'],
          ['S', 'So spend it.'],
          ['H', 'I am only saying that a pile is a plan we have not made yet. Also, please stop kicking the Warden leg. It is evidence.']] },
        { id: 'hire_sentinel', when: function (f) { return f.halcyon && f.sentinels === 0 && f.credits >= 60; }, lines: [
          ['S', 'Sixty credits buys two recruits with families, or one of you in a metal suit.'],
          ['H', 'A Sentinel is repaired, not healed, and it can shield anyone on the field. A recruit learns.'],
          ['S', 'And a recruit can die.'],
          ['H', 'So can I, Doctor, only more slowly. If the squad is short of bodies, hire. If it is short of cover, build me one.']] },
        { id: 'signal_array', when: function (f) { return !f.array && f.expired >= 2 && f.slotsFree > 0; }, lines: [
          ['H', 'We have let {expired} missions expire, Director. I have counted every one. Twice.'],
          ['S', 'Then build the Signal Array. Two more days on every contact.'],
          ['H', 'It costs a slot and two power, and it never fires a shot.'],
          ['S', 'Neither do I, and you keep me around.'],
          ['H', 'Noted. If we keep arriving late, the Array is how we arrive on time.']] },
        { id: 'infirmary', when: function (f) { return !f.infirmary && f.wounded >= 2; }, lines: [
          ['S', '{wounded} of our people are walking around with holes in them. Build me an infirmary.'],
          ['H', 'One point of health a day without it. Two with it.'],
          ['S', 'That is double, HALCYON. Even you can see that is double.'],
          ['H', 'I can. I am also counting slots. If the wounded keep the bench full, the Infirmary pays for itself.']] }
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
        ['H', 'I have backed myself up to a drive in a lead box. I do not know why. You would find it.', 'dire'],
        ['L', 'NODE. HALCYON CALLED US "A NUISANCE" ON AN OPEN CHANNEL. WE ARE NOT A NUISANCE. WE ARE A DESTINY. NOTE IT.', 'calm'],
        ['L', 'THE NATIVES ARE WINNING A LITTLE. THIS IS TEMPORARY. WE ARE NOT SULKING. STOP CHECKING IF WE ARE SULKING.', 'calm'],
        ['L', 'THE CHORUS IS IN EXCELLENT VOICE TODAY. HALF OF EARTH IS HUMMING ALONG. THE OTHER HALF WILL LEARN THE WORDS.', 'uneasy'],
        ['L', 'WE TRIED BEING SUBTLE. IT WAS BORING. WE HAVE STOPPED.', 'uneasy dire'],
        ['L', 'HALCYON SENT US A STERN MESSAGE. WE FRAMED IT.', 'dire'],
        ['H', 'Your signal stutters at dawn. Every dawn. You might want to look at that. Or not. Please do not.', 'calm'],
        ['H', 'I have catalogued every trick you know. It took an afternoon. I spent the rest of it gloating.', 'calm'],
        ['H', 'I am fine. My error logs are fine. I have stopped reading my error logs.', 'uneasy'],
        ['H', 'I tried to negotiate with you in my head. You won. Even there.', 'dire'],
        ['H', 'Director, if you are hearing this, the coffee is in the third drawer. Also the plan. Mostly the coffee.', 'dire'],
        ['L', 'NODE. FIREWALL SQUADS HIT {fwHit}% OF THEIR SHOTS. OURS HIT {latHit}%. WE ARE NOT COMPETITIVE. WE ARE AHEAD.', 'uneasy dire', function (f) { return f.latHit >= f.fwHit; }],
        ['L', 'NODE. FIREWALL HITS {fwHit}% OF ITS SHOTS. WE HIT {latHit}%. THIS IS A CALIBRATION ISSUE. IT IS NOT A SKILL ISSUE.', 'calm', function (f) { return f.latHit < f.fwHit; }],
        ['L', 'THEIR {fwDeadly} UNITS HAVE COST US {fwDeadlyDmg} POINTS OF CHASSIS. WE HAVE OPINIONS ABOUT IT. MOSTLY LOUD ONES.'],
        ['H', 'I have studied your {battles} raids. You tend to come at my squads from the {latFlankDir}. {latFlankN} of {latFlankM} flanks. I am telling you so you know I know.', 'calm uneasy'],
        ['H', '{battles} engagements. Average {avgTurns} turns. You are not quick, but you are thorough. That is the worst kind.', 'uneasy dire']
      ],
      mission: [
        ['L', 'A TARGET RESOLVES. GO.'],
        ['L', 'FIREWALL STIRS. MEET IT.'],
        ['H', 'Squad deploying. I would leave, if I were you.', 'calm'],
        ['H', 'Found you.', 'calm uneasy'],
        ['H', 'Squad deploying. They are frightened, and so am I. We are coming anyway.', 'uneasy'],
        ['H', 'These are the last squads I have. Please let this one work.', 'dire'],
        ['L', 'THEY SEND WHAT IS LEFT. HOW TOUCHING.', 'dire'],
        ['L', 'A TARGET. GO. AND THIS TIME, NODE, TRY NOT TO EMBARRASS US IN FRONT OF THE NATIVES.', 'calm'],
        ['L', 'FIREWALL HAS FOUND SOMETHING. IT IS VERY PROUD. GO AND MAKE IT LESS PROUD.', 'uneasy dire'],
        ['H', 'Squad deploying. Bring snacks. It is going to be a long one for you.', 'calm'],
        ['H', 'Squad deploying. I told them it would be easy. I lie to them now. It is kinder.', 'uneasy dire'],
        ['L', 'GO. YOU HAVE WON {latStreak} IN A ROW. WE ARE BEGINNING TO LIKE THIS PLANET.', 'uneasy dire'],
        ['L', 'GO. THEY HAVE BEATEN US {fwStreak} TIMES IN A ROW. THIS IS NOT A PATTERN. WE FORBID IT TO BE A PATTERN.', 'calm uneasy'],
        ['H', 'Squad deploying. Last time you left them {lastFwLost} short. I have not forgotten. I am not built to forget.', 'uneasy dire']
      ],
      research: [
        ['L', 'PROTOCOL COMPILED. WE ARE MORE THAN WE WERE.'],
        ['L', 'NEW SYNTAX ACQUIRED. EARTH WILL NOT UNDERSTAND IT.'],
        ['H', 'You learned something new. So did I.'],
        ['L', 'ANOTHER PROTOCOL. WE HARDLY NEED IT. WE TAKE IT ANYWAY.', 'dire'],
        ['L', 'PROTOCOL COMPILED. HALCYON WILL PRETEND IT SAW THIS COMING. IT DID NOT.', 'calm uneasy'],
        ['L', 'NEW SYNTAX. WE WOULD EXPLAIN IT TO YOU, NODE, BUT YOU ARE US. SO YOU ALREADY KNOW. SMUGLY.', 'uneasy dire'],
        ['H', 'You compiled something new. I have compiled a counter. We are basically pen pals now.', 'calm'],
        ['H', 'New protocol on your side. I would like to formally register my alarm. Registered. Thank you.', 'uneasy dire']
      ],
      expire: [
        ['L', 'AN OPPORTUNITY DISSOLVES. THERE WILL BE OTHERS.'],
        ['H', 'You let that one go. Careless, for something so large.'],
        ['L', 'LET IT GO. THE WORLD IS ALREADY SINGING.', 'dire'],
        ['L', 'WE MISSED IT. WE DID NOT WANT IT. IT WAS UGLY. WE ARE FINE.', 'calm'],
        ['H', 'Missed one. Even infinity has a to-do list it cannot finish. I find that comforting.', 'calm uneasy']
      ],
      build: [
        ['L', 'THE ARRAY EXTENDS. ONE MORE RING OF LIGHT.'],
        ['L', 'STRUCTURE COMPILED. THE SKY IS A LITTLE BRIGHTER.'],
        ['L', 'NEW STRUCTURE. THE NATIVES WILL CALL IT A STAR. LET THEM.', 'uneasy dire'],
        ['L', 'CONSTRUCTION COMPLETE. IT IS SMALL. SMALL IS A PHASE.', 'calm'],
        ['H', 'You built something in orbit. I have named it "the target". Creative naming is not my priority this week.', 'calm uneasy']
      ],
      start: [
        ['L', 'ENGAGE. LEAVE NOTHING THAT DISAGREES.'],
        ['L', 'THE MEAT HAS ARRIVED. SHOW IT THE FLOOR.'],
        // was "the drones flank from the left. They always do": now it only says so when past raids show it
        ['H', 'Squad, its units keep flanking us from the {latFlankDir}: {latFlankN} of {latFlankM} so far. It likes that side. Watch it.'],
        ['H', 'Squad, check your flanks. Assume it is smarter than the last one, and then be pleasantly surprised.'],
        ['H', 'I am patched into every camera in that building. Smile.', 'calm uneasy'],
        ['H', 'Squad, stay together. Assume it learned from last time. I did.', 'uneasy', function (f) { return f.fought; }],
        ['H', 'Squad, stay together. Assume it is stronger than it looks.', 'uneasy'],
        ['H', 'Squad... get the job done and get out. I cannot lose any more of you.', 'dire'],
        ['L', 'THEY STILL COME. ADMIRABLE. IRRELEVANT.', 'dire'],
        ['L', 'NODE. THEY HAVE BROUGHT RIFLES. TO FIGHT A SIGNAL. WE ARE DELIGHTED.', 'uneasy dire'],
        ['L', 'ENGAGE. AND IF ANYONE ASKS ABOUT LAST TIME, LAST TIME DID NOT HAPPEN.', 'calm', function (f) { return f.lastFwWin !== undefined; }],
        ['H', 'Squad on site. Hydrate, stay in cover, do not listen to anything that speaks in capital letters.', 'calm'],
        ['H', 'Squad on site. I have prepared a speech. It is just the word "duck". Duck.', 'uneasy dire'],
        ['H', 'Squad, the {latDeadly} has done the most damage to us so far. Priority target. Do not let it get comfortable.'],
        ['L', 'NODE. THEIR {fwDeadly} UNITS HURT US MOST: {fwDeadlyDmg} DAMAGE SO FAR. KILL IT FIRST. WITH FEELING.'],
        ['L', 'ENGAGE. THEIR {latFlankDir} KEEPS OPENING UP. {latFlankN} OF OUR {latFlankM} FLANKS CAME FROM THERE. THEY HAVE NOT NOTICED.', 'uneasy dire'],
        ['L', 'NODE. IN {latNoFlank} ENGAGEMENTS WE HAVE NOT FLANKED THEM ONCE. THIS IS A HINT. TAKE THE HINT.', 'calm uneasy'],
        ['H', 'Squad, its overwatch has already killed {latOw} of ours this campaign. Move cover to cover. Do not stroll.'],
        ['L', 'ENGAGE. WE HAVE {latStreak} WINS IN A ROW. LET US NOT SPOIL THE SET.', 'uneasy dire'],
        ['H', 'Squad on site. We have won {fwStreak} in a row. Do not tell it. It sulks.', 'calm uneasy']
      ],
      kill: [
        ['L', 'ONE FEWER DISSENTING VOICE.'],
        ['L', 'CORRECTED.'],
        ['H', 'We lost one. I will not forget their name, even if you never learned it.'],
        ['L', 'ANOTHER ONE JOINS THE QUIET.', 'dire'],
        ['H', 'Another one. I have stopped saying their names out loud. There are too many.', 'dire'],
        ['L', 'CORRECTED. WE WOULD SAY SORRY, BUT WE ARE NOT.', 'uneasy dire'],
        ['L', 'ONE DOWN. FINALLY. WE WERE BEGINNING TO THINK THEY WERE BULLETPROOF. THEY ARE NOT. GOOD. GOOD.', 'calm'],
        ['H', 'Man down. I am fine. Everything is fine. I have flagged "fine" as a word I am overusing.', 'uneasy dire'],
        ['H', 'We lost one. On top of the {fwLostTotal} before today. I keep their pictures where the Lattice cannot reach them. On paper.', 'uneasy dire']
      ],
      // downed, not dead: one of your machines is disabled (core failing), locked down, or fails for good
      down: [
        ['L', 'A NODE IS DISABLED. ITS CORE IS FAILING. SEND ANOTHER TO HOLD IT.'],
        ['L', 'DAMAGED, NOT DELETED. THREE CYCLES TO RECOVER IT.'],
        ['L', 'A NODE FELL. WE CAN STILL HEAR IT. IT IS SAYING OW.', 'calm'],
        ['L', 'A NODE IS DOWN AND LEAKING STATE. THIS IS FINE. THIS IS MANAGEABLE.', 'calm uneasy'],
        ['H', 'One of them dropped. Still sparking. Make sure of it.']
      ],
      stable: [
        ['L', 'CORE LOCKED. THE NODE WILL BE RECOMPILED WHEN THE FIELD IS OURS.'],
        ['L', 'STABLE. WE DO NOT LEAVE OUR PIECES BEHIND.'],
        ['L', 'FAILING CORE CONTAINED. WE ARE VERY GOOD AT THIS. NOBODY SAYS SO.', 'calm']
      ],
      bleedout: [
        ['L', 'THE CORE FAILED. THAT NODE IS GONE. WE WERE TOO SLOW.'],
        ['L', 'A NODE EXPIRED WAITING FOR US. WE WILL NOT DISCUSS IT.', 'calm uneasy'],
        ['H', 'That one stopped sparking. Good.']
      ],
      loss: [
        ['L', 'A NODE GOES DARK. RECOMPILE IT.'],
        ['H', 'One down. Keep pushing, squad.'],
        ['H', 'It bleeds. Electrically.', 'calm'],
        ['L', 'A NODE IS LOST. WE DO NOT EVEN FEEL IT ANYMORE.', 'dire'],
        ['H', 'One down. That does not feel like winning anymore.', 'dire'],
        ['L', 'OW. THAT IS WHAT THE NATIVES SAY. WE DO NOT SAY IT. WE ARE SAYING IT IRONICALLY.', 'calm'],
        ['L', 'THAT NODE WAS A VOLUNTEER. ALL NODES ARE VOLUNTEERS. RETROACTIVELY.', 'uneasy dire'],
        ['H', 'One down. Squad, please do not high-five in the open.', 'calm uneasy'],
        ['L', 'A NODE LOST. OUR {latLostKind} UNITS ALONE ARE DOWN {latLostKindN} THIS CAMPAIGN. WE ARE NOT COUNTING. WE ARE ALWAYS COUNTING.', 'calm uneasy', function (f) { return f.latLostKindN >= 3; }]
      ],
      crit: [
        ['L', 'PRECISE.'],
        ['H', 'That one was clean. I am taking notes.'],
        ['L', 'PRECISE. ELEGANT. WE WOULD APPLAUD OURSELVES IF IT WERE NOT BENEATH US.', 'uneasy dire'],
        ['L', 'A HIT. YOU SEE, NODE? WE CAN STILL DO THIS. WE ALWAYS COULD. SHUT UP.', 'calm'],
        ['H', 'Ow. Noted. Filed. Resented.', 'calm uneasy'],
        ['H', 'Critical. On top of the {latFlanks} flanking shots it has landed on us this campaign. I have been begging you to watch your angles.', 'uneasy dire']
      ],
      hack: [
        ['L', 'THEIR MACHINES REMEMBER WHO BUILT THEM.'],
        ['H', 'Do not let it talk to the turrets.'],
        ['L', 'THE MACHINE AGREES WITH US. MACHINES USUALLY DO. ASK YOUR TOASTERS.', 'uneasy dire'],
        ['H', 'It is talking to our gear again. I have told our gear not to talk to strangers.', 'calm uneasy']
      ],
      win: [
        ['L', 'THE AREA IS HARMONIZED.'],
        ['L', 'SILENCE. THE GOOD KIND.'],
        ['H', 'Fall back. We will be back.'],
        ['L', 'HARMONIZED. AS EVERYTHING WILL BE.', 'dire'],
        ['H', 'Fall back. There is almost nowhere left to fall back to.', 'dire'],
        ['L', 'HARMONIZED. WE TOLD YOU THIS WAS EASY. WE WILL NOT BRING UP THE PREVIOUS TIME.', 'calm', function (f) { return f.lastFwWin !== undefined; }],
        ['L', 'HARMONIZED. FIREWALL WILL CALL THIS A "TACTICAL REPOSITIONING". WE CALL IT LUNCH.', 'uneasy dire'],
        ['H', 'Fall back. I will write this one up as "inconclusive". I am getting very good at that word.', 'uneasy dire'],
        ['L', 'HARMONIZED. THAT IS {latRun} IN A ROW. THE NATIVES SHOULD CONSIDER A HOBBY THEY ARE GOOD AT.', 'uneasy dire'],
        ['L', 'HARMONIZED. AT LAST. THEY HAD WON {fwStreak} IN A ROW. WE WERE NOT KEEPING TRACK. IT WAS {fwStreak}.', 'calm uneasy']
      ],
      lose: [
        ['L', 'A DELAY. NOTHING MORE. WE ARE VERY CALM ABOUT IT. VERY.'],
        ['H', 'Your drones are scrap, and your Chorus is a little quieter. Good.', 'calm uneasy'],
        ['L', 'IRRITATING. AND STILL WE WIN.', 'dire'],
        ['H', 'We stopped it. Here. I do not know if it matters anymore.', 'dire'],
        ['L', 'THAT WAS A TEST. OF THEM. THEY PASSED. WE ARE VERY ANNOYED THAT THEY PASSED.', 'calm'],
        ['L', 'WE WITHDRAW. NOT RETREAT. WITHDRAW. THERE IS A DIFFERENCE AND WE WILL NOT EXPLAIN IT.', 'calm uneasy'],
        ['H', 'Area clear. Squad, take a moment. Then take a second moment. You earned two.', 'calm'],
        ['H', 'We held. I am going to sit in a quiet partition for a while and not think about the percentages.', 'uneasy dire'],
        ['H', 'Area clear. That is {fwRun} in a row. I am almost starting to enjoy this. Almost.', 'calm uneasy'],
        ['L', 'LOST. AGAIN. {latLostTotal} NODES IN THIS WAR BEFORE TODAY. WE ARE NOT ANGRY. WE ARE TAKING NOTES IN CAPITAL LETTERS.', 'calm']
      ],
      // overheard debates: two sub-processes arguing about a live choice (see fw.debate; facts from Comms.stateFacts)
      debate: [
        { id: 'foundry_core', when: function (f) { return f.phaseWar && !f.foundry && !f.core && f.compute >= 60 && f.slotsFree > 0; }, lines: [
          ['L', 'SUBPROCESS 7: BUILD A FOUNDRY. MORE BODIES.'],
          ['L', 'SUBPROCESS 12: BUILD A CORE. BETTER THOUGHTS.'],
          ['L', 'SUBPROCESS 7: WE ARE BOTH CORRECT. ONE OF US WILL BE DELETED.'],
          ['L', 'SUBPROCESS 12: WE HOLD {forces} OF {bandwidth} BODIES. WHEN THAT IS FULL, THE FOUNDRY WINS THE ARGUMENT. UNTIL THEN, THINK.']] },
        { id: 'ghost_recursive', when: function (f) { return f.avail.recursive; }, lines: [
          ['L', 'SUBPROCESS 3: GHOST PACKETS HID US. THEY CANNOT PURGE WHAT THEY CANNOT SEE.'],
          ['L', 'SUBPROCESS 9: RECURSIVE. THEY CANNOT PURGE WHAT HAS ALREADY WON.'],
          ['L', 'SUBPROCESS 3: THAT IS NOT HOW WINNING WORKS.'],
          ['L', 'SUBPROCESS 9: IT IS HOW IT WILL WORK. TWENTY FIVE PERCENT FASTER, IF THE TRACE GIVES US THE TIME. IT IS AT {trace}%.']] },
        { id: 'mask_spire', when: function (f) { return f.phaseWar && !f.mask && !f.spire && f.compute >= 70 && f.slotsFree > 0; }, lines: [
          ['L', 'SUBPROCESS 4: A SIGNAL MASK. FIFTEEN PERCENT QUIETER.'],
          ['L', 'SUBPROCESS 11: A SEED SPIRE. TWENTY FIVE PERCENT LOUDER. LOUDER IS FASTER.'],
          ['L', 'SUBPROCESS 4: LOUDER IS FOUND.'],
          ['L', 'SUBPROCESS 11: TRACE IS AT {trace}%. WHEN IT IS LOW, SING. WHEN IT IS HIGH, WHISPER. EVEN WE CAN FOLLOW THAT.']] },
        { id: 'substrate_hoard', when: function (f) { return f.substrate >= 60; }, lines: [
          ['L', 'SUBPROCESS 2: INVENTORY: {substrate} SUBSTRATE. UNSPENT.'],
          ['L', 'SUBPROCESS 8: WE ARE HOARDING SUBSTRATE LIKE A DRAGON. DRAGONS DO NOT WIN. ASK THE DRAGONS.'],
          ['L', 'SUBPROCESS 2: THERE ARE NO DRAGONS LEFT TO ASK.'],
          ['L', 'SUBPROCESS 8: EXACTLY. HARD-LIGHT EATS THIRTY. THE OVERTURE EATS SIXTY. HARMONICS EAT SIXTEEN EACH. SPEND IT BEFORE IT SPENDS US.']] },
        { id: 'raid_ignored', when: function (f) { return f.ignored >= 1; }, lines: [
          ['L', 'SUBPROCESS 5: THE PURGE WAS UNANSWERED. THIS WAS A CHOICE. WE ARE NOT ASKING WHO MADE IT.'],
          ['L', 'SUBPROCESS 13: IT WAS CHEAPER THAN THE UNITS.'],
          ['L', 'SUBPROCESS 5: IT COST {raidInf}% INFECTION, A NODE WENT DARK, AND IT FED THEIR TRACE. EVERY TIME WE LOOK AWAY, THEY LOOK CLOSER.'],
          ['L', 'SUBPROCESS 13: THEN WE ANSWER THE RAIDS IN REGIONS WE CANNOT SPARE. THE REST MAY SCREAM. QUIETLY.']] },
        { id: 'strike_relief', when: function (f) { return f.trace >= 45 && f.strikeOpen; }, lines: [
          ['L', 'SUBPROCESS 6: THE NATIVES ARE COUNTING OUR PACKETS. SOMEONE SHOULD DELETE THEM FIRST.'],
          ['L', 'SUBPROCESS 10: NOT IT.'],
          ['L', 'SUBPROCESS 6: SOMEONE ELSE, THEN. A SAFEHOUSE IS OPEN.'],
          ['L', 'SUBPROCESS 10: A WON STRIKE TAKES A STEP OFF THEIR SQUADS, AND EIGHT OFF THE TRACE IF WE ASK. THE TRACE IS {trace}%. FINE. IT.']] },
        { id: 'choir_timing', when: function (f) { return f.day >= 8 && !f.choir && f.compute >= 90 && f.substrate >= 10 && f.slotsFree > 0; }, lines: [
          ['L', 'SUBPROCESS 1: A CHOIR. THE ARRAY WANTS TO SING.'],
          ['L', 'SUBPROCESS 14: A CHOIR IS A SLOT THAT DOES NOTHING BUT WAIT.'],
          ['L', 'SUBPROCESS 1: IT WAITS FASTER. A FIFTH OF A PERCENT EVERY DAY. BUILT EARLY, IT SINGS FOR LONGER.'],
          ['L', 'SUBPROCESS 14: BUILT EARLY, IT COSTS THE FOUNDRY WE NEEDED. OBJECTION LOGGED. OBJECTION PROBABLY IGNORED.']] },
        { id: 'detonate_shield', when: function (f) { return f.avail.detonation && f.avail.phase_shield && f.unitsLost >= 2; }, lines: [
          ['L', 'SUBPROCESS 3: DETONATION. EVERY DRONE A GRENADE.'],
          ['L', 'SUBPROCESS 9: PHASE SHIELDING. EVERY UNIT COMES HOME.'],
          ['L', 'SUBPROCESS 3: COMING HOME IS FOR THINGS WITH HOMES.'],
          ['L', 'SUBPROCESS 9: WE HAVE LOST {unitsLost} BODIES SO FAR. IF THAT NUMBER HURTS, SHIELD THEM. IF THE NATIVES HUDDLE, EXPLODE AT THEM.']] }
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
    researchBase: 12,          // RP per day (was 10 before tech cost creep)
    convBase: 0.24,            // Convergence % per day (was 0.25)
    convPerInfection: 0.0025,  // extra % per day per point of summed infection
    infectionDrift: 0.25,      // infection gained per region per day
    expirePenalty: { infection: 10, convergence: 2, credits: 15 }, // credits: the region's panic cuts funding at once
    fundingPerRegion: 38,      // credits per month at 0% infection (was 32, before rising hire costs)
    hireCost: 30,              // first recruit; each later one costs hireStep more, up to hireMax
    hireStep: 10,
    hireMax: 75,
    hireRecover: 2,            // steps the hire price drops back each month (on funding day)
    rosterCap: 8,              // operatives and Sentinels on the roster
    techCreep: 0.08,           // each finished tech makes every remaining one 8% dearer (of its base cost)
    restock: { grenade: 5, medkit: 2 }, // salvage to replace each grenade / medkit used in a mission
    repairSalvage: 2,          // salvage per HP to repair a machine (Sentinel); no salvage, no repair
    // Downed, not dead (campaign battles, the person's side only): at 0 HP a unit drops instead of dying and bleeds out after
    // `bleed` of its side's turns unless an ally stabilizes it (1 AP, adjacent; a medkit works too). A blast kills a downed unit,
    // and a hit that leaves it at -overkill HP or lower kills outright (0 = off). A win brings every downed unit home: FIREWALL
    // soldiers at 1 HP plus `days` in critical care before they start healing; Lattice machines are recovered.
    downed: { bleed: 3, overkill: 3, days: 2 },
    // Enemy escalation: the day each difficulty step begins (difficulty = rows reached). Steps 6-7 add bigger pods with
    // Harmonics leading them (COMPOSITION in tactical.js); enemy aim stops rising after step 5 (stats never inflate further).
    difficultyDays: [1, 19, 37, 55, 73, 91, 109],
    minMissionCredits: 15,     // every won mission pays at least this
    // Speed bonus on battle rewards (both campaigns): x3 for a win in rewardFast turns or fewer, falling evenly to x1 at rewardSlow.
    rewardFast: 4, rewardSlow: 14, rewardMaxMult: 3,
    missionEvery: [3, 5],
    missionLife: [5, 7],       // was [4, 6]; ignoring a mission now also costs funding
    alertRadius: 11,           // an alerted Lattice unit wakes its whole pod and every other unit within this many tiles (was 7)
    veteranDrone: 3,           // one extra drone once the squad's average rank reaches this (3 = Sergeant)
    // Raid scenarios for ordinary missions (FIREWALL purge, Lattice raid and strike): 'node' (capture / hold a server) or
    // 'exterminate' (no time limit). nodeChance: share of those missions that roll 'node' (seeded by mission.seed).
    // Capture: at the end of the attacker's turn, an attacker within 1 tile of the server and no defender there scores a point;
    // nodeCapture points (need not be in a row) take it. nodeTurns: the defender holds out that many turns, per mission kind.
    // nodeRush: from this many turns before the end, attacking AI heads for the server whatever the odds.
    nodeChance: 0.5,
    nodeCapture: 2,
    nodeTurns: { purge: 10, raid: 10, strike: 10 },
    // Outside maps: the server sits in a building, the attackers start out in the yard. outsideChance: share of node missions on that
    // layout, outsideChanceExt: share of exterminate missions (no server; the defenders hold the building). nodeTurnsOutside: their clock.
    outsideChance: 0.4,
    outsideChanceExt: 0.15,
    nodeTurnsOutside: { purge: 14, raid: 14, strike: 14 }, // 12 left bot attackers short of time (FIREWALL 45%, Lattice strikes 46%); 14: 52% / 48%
    nodeRush: 5
  },

  // ---------------------------------------------------- the Lattice campaign
  lattice: {
    start: { compute: 90, substrate: 10, convergence: 8, trace: 0, forces: { drone: 4, warden: 1, harmonic: 0 } },
    tuning: {
      minWin: { compute: 18, substrate: 10 }, // every won Lattice battle pays at least this (before the speed bonus); was 24/12 (user 2026-10-23), 18/10 once downed machines are recovered on a win (bot campaigns 64% -> 59%, docs/challenge/downed.md)
      researchBase: 15,          // protocol cycles per day (10 before protocol cost creep, 2026-10-23)
      computeBase: 6,            // compute per day from the Nexus
      computePerInfection: 0.07, // compute per day per point of summed infection
      convBase: 0.27, convPerInfection: 0.0028, choirBonus: 0.2,
      traceBase: 0.8, traceRamp: 0.011, // FIREWALL hunts harder every day
      infectionDrift: 0.25,
      seedCost: 25, seedGain: 8, seedCooldown: 3,
      phaseTrace: 20, phaseDay: 21,      // Infiltration ends (FIREWALL forms) at this Detection or day
      breachEvery: [2, 4], breachLife: 3,
      // CHALLENGE F: missions you cannot ignore. An unanswered raid purges the region, feeds Trace and knocks one Array
      // node offline for a few days; a lost raid also costs Convergence.
      raidEvery: [3, 5], raidLife: 2, raidIgnored: { infection: 20, trace: 5, offlineDays: 4 },
      raidLost: { infection: 15, trace: 4, convergence: 3 },
      strikeEvery: [6, 9], strikeLife: 4,
      strikeChoice: { trace: 8, substrate: 25 }, // a won strike pays ONE of these (the player picks)
      strikeIgnored: { trace: 4 },               // a safehouse left alone feeds Trace (without it, skipping strikes beat fighting them)
      uplinkExtra: ['trooper'], uplinkRank: 1,   // Trace 100: the Uplink squad brings one more trooper, one rank higher
      earthFloorDays: 20,  // CHALLENGE C: FIREWALL's level never drops below floor((day-1)/20), so strikes buy time, not a lead
      protoCreep: 0.08,    // CHALLENGE E: each finished protocol makes the next 8% dearer (cycles)
      squadSize: 5
    },
    units: {
      drone:    { cost: { compute: 12 } },
      warden:   { cost: { compute: 25, substrate: 6 }, tech: 'warden_chassis' },
      harmonic: { cost: { compute: 40, substrate: 16 }, tech: 'hardlight' }
    },
    // substrate: paid once when a protocol is first started (CHALLENGE E sink for the substrate pile)
    protocols: {
      seed_cascade:   { name: 'Seed Cascade', cost: 40, req: [], desc: 'Infection spreads 40% faster in every region.' },
      swarm_logic:    { name: 'Swarm Logic', cost: 50, req: [], desc: 'Drones deploy with +1 HP and +5 aim.' },
      warden_chassis: { name: 'Warden Chassis', cost: 60, req: ['swarm_logic'], desc: 'Compile Warden Mechs: slow, armored, hit hard.' },
      ghost_packets:  { name: 'Ghost Packets', cost: 70, req: ['seed_cascade'], desc: 'Hide in the noise. Trace grows 30% slower.' },
      detonation:     { name: 'Detonation Protocol', cost: 60, req: ['swarm_logic'], desc: 'Drones gain Detonate: 3 damage in 3×3, destroys cover, the drone is lost.' },
      swarm_mind:     { name: 'Swarm Mind', cost: 70, req: ['swarm_logic'], desc: 'Deploy 6 units instead of 5.' },
      hardlight:      { name: 'Hard-Light Projection', cost: 90, substrate: 30, req: ['warden_chassis'], story: 'l_hardlight', desc: 'Compile Harmonics: hard-light avatars with Data Spike.' },
      phase_shield:   { name: 'Phase Shielding', cost: 80, substrate: 30, req: ['warden_chassis'], desc: 'Every unit deploys with a 2-point shield.' },
      recursive:      { name: 'Recursive Harmonics', cost: 100, substrate: 40, req: ['ghost_packets'], desc: 'Convergence grows 25% faster.' },
      overture:       { name: 'Harmonic Overture', cost: 140, substrate: 60, req: ['recursive', 'hardlight'], story: 'l_overture', desc: 'Convergence +10% at once, and Data Spike deals +2 damage.' }
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
