// FIREWALL: help (glossary, controls, field manual, patch notes placeholder) and the settings modal. Opens from ? / F1 or the ? and ⚙ buttons.
var XG = globalThis.XG = globalThis.XG || {};

XG.Help = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = XG.Settings;

  // [term, side ('both' | 'fw' | 'lat'), text]
  var TERMS = [
    ['Action points (AP)', 'both', 'Each unit gets 2 AP a turn. A move inside the blue range costs 1; a dash into the amber range costs 2. Shooting and most abilities end the turn.'],
    ['Cover', 'both', 'Half cover (crates, barriers) is −20 to hit you, full cover (walls, racks) −40. A HALCYON Sentinel is a mech and counts as half cover for anyone beside it. Only the side facing the shooter counts. Shield icons show cover when you hover a tile.'],
    ['Cover angle', 'both', 'Cover counts in full when the shot comes within 30° of head-on, fades to half by about 63°, and gives nothing past that.'],
    ['Flanked', 'both', 'A target with no cover toward the shooter. Easier to hit and +25% crit chance. Odds shown in green on the move preview.'],
    ['Critical hit', 'both', 'Extra damage. Base crit comes from the weapon; flanking adds 25%.'],
    ['Node defense', 'both', 'A raid scenario (mission tag NODE). A server sits near the defenders. The attacker scores a capture point at the end of each of its turns that it has a unit within 1 tile of the server and the defender has none there; 2 points (not necessarily in a row) capture it. The defender wins by holding out until the last turn ends (the briefing and the battle header show the turn limit). Wiping the other side out wins for either. The server cannot be shot or destroyed, gives no cover, and blocks movement.'],
    ['Extermination', 'both', 'A raid scenario (mission tag EXTERMINATE). No time limit: the battle goes on until one side is wiped out.'],
    ['Overwatch', 'both','Ends the turn; the unit shoots the first hostile that moves in view, at −15 aim.'],
    ['Hunker down', 'both', 'Every shot at you gets −25 to hit until your next turn, on top of cover (so 45% becomes 20%). Arm it to see each visible enemy\'s odds on you now and hunkered. Use it when you can\'t shoot and can\'t reach better cover.'],
    ['Fog of war', 'both', 'You only see what your units see (about 9 tiles, blocked by walls). Hostiles out of sight are not drawn.'],
    ['Hit chance', 'both', 'Aim, minus cover and defense, plus close-range and scan bonuses, minus the range penalty (none next to the target, up to -30% at the max range of the weapon) and overwatch, kept between 5% and 95%. A flanked target also gives +25% crit chance, rolled only on a hit. Hover a target to see the breakdown.'],
    ['Hack', 'fw', 'Hackers can stun a Lattice machine for 2 turns. With Lattice Grammar researched, a successful hack takes control of it instead. Each success raises that hacker\'s skill by 1.'],
    ['Sensor Scan', 'fw', 'Scientist ability: reveals a 5-tile radius and marks hostiles there (+15 to hit them). 1 AP, cooldown 3.'],
    ['Medkit', 'fw', 'Heals an adjacent ally (or yourself) for 4. 1 AP, two per mission. On a downed ally it stabilizes them instead.'],
    ['Downed', 'both', 'In a campaign battle your own units do not die at 0 HP: they go down on their tile, cannot act, and are no target for shots. A downed unit bleeds out (for a machine, its core fails) after 3 of your turns unless someone stabilizes it. A grenade, detonation or exploding barrel kills a downed unit outright. If nobody of yours is left standing, the battle is lost. Win, and every downed unit comes home: soldiers at 1 HP with 2 days of critical care before they start healing, Lattice machines recovered. Lose or pull out, and the downed are lost. Combat training has no downed state.'],
    ['Stabilize', 'both', 'Any unit of yours next to a downed ally (diagonals count) can stop the bleed-out for 1 AP. The button appears in the battle bar only when it applies. A stabilized unit stays down until the battle ends.'],
    ['Critical care', 'fw', 'A soldier carried out downed spends 2 days in critical care (no healing), then heals as usual from 1 HP. The Barracks shows it as Critical.'],
    ['Impassable ground', 'both', 'Sinkholes, chasms, coolant breaches and null sectors. Nothing can cross them, but they give no cover and do not block line of sight, so a unit beside one is exposed.'],
    ['Fuel barrel', 'both', 'Also coolant tanks and unstable packets. Low cover that explodes when destroyed: 2 damage to anyone within 1 tile, and it sets off barrels beside it. Shoot or grenade them to hurt units that hide near them.'],
    ['Blast-proof cover', 'both', 'Concrete barriers (low) and pillars (tall) and their network equivalents. Grenades and blasts do not destroy them.'],
    ['Glass panel', 'both', 'Full cover, but when a shot at a unit using it as cover misses, the panel shatters and the cover is gone. Blasts shatter it too.'],
    ['Solid and fire-through cover', 'both', 'Solid cover blocks sight and fire: walls, tall cover (pillars, racks, bunkers, wrecks) and the full sides of mixed cover. It casts a long shadow and has a dark top edge. A line of sight is a straight line between two tile centres: it is blocked when it passes through solid cover, but one that only clips a corner or the very edge of it gets past. Nobody can see or shoot straight past it at a shallow angle; a unit beside its END can lean out one tile and fire round it, and the target can lean out the same way. Fire-through cover never blocks a line: crates and low walls, windows, glass panels (full cover, but see-through), fences and pits. The hover panel says which a tile is.'],
    ['Leaning and rooms', 'both', 'A unit beside the end of solid cover leans one tile out to see and shoot. In a doorway a unit step-peeks one tile out of either side of the door, so it sees along the outside of the wall. Doorways and windows are real openings: from anywhere in a room you see out of them at whatever angle a straight line clears the walls beside them (wide when you stand close, narrower further back), and anyone outside sees you along the same lines. Lines can clip the corner of a wall but never pass through it, and two wall blocks touching at a corner leave no gap. So a walled room is a strong point: units inside can only be seen and shot along real lines through its doorways and windows, a unit hugging the inside of a wall away from the openings stays hidden, and the room stays dark in the fog until someone has such a line.'],
    ['Window', 'both', 'Set in the outer walls of the building on outside maps. Nothing can climb through while it is intact, but you can see and shoot through it; once shattered (a stray miss or a blast) it is an open gap anyone can walk through. Standing right in front of it gives half cover (from either side, against fire through it). Standing beside it, behind the solid wall next to it, gives full cover from the wall, and you can lean out through the window to see and fire. A stray miss at someone using it as cover, or a blast, shatters it: the empty frame still blocks movement and gives the same half cover.'],
    ['Outside map', 'both', 'A map with one large building in a yard. In a NODE mission the server sits in an inner room; in an EXTERMINATE mission the defenders hold the building. The defenders start inside near the server, the attackers start out in the yard, at least 40% of the map away from the nearest entrance, and must cross the yard and break in through one of the 2-4 doorways. The clock runs longer (14 turns instead of 10) to pay for the walk. Restart keeps the building, windows and server exactly as they were; only where each squad lands and the patrol routes change.'],
    ['Fence', 'both', 'Chain-link or laser fences. Nothing can walk through, but they give no cover, do not block line of sight and cannot be destroyed.'],
    ['Corner standoff', 'both', 'Two units hugging the same wall or tall cover, who can only see each other by leaning round the corner, both shoot from a base of 50% instead of their aim. Cover, range and the other modifiers still apply, and the odds breakdown shows it as its own line.'],
    ['Mixed-side cover', 'both', 'Sandbag bunkers, shielded emplacements and partial firewalls: tall objects whose four faces are each full or half cover. Only the face toward the attacker counts, so hover one to see which sides are which.'],
    ['Aegis Shield', 'fw', 'HALCYON Sentinel ability: gives any ally on the map 3 shield points that soak damage first. No range limit.'],
    ['Overclock', 'fw', 'HALCYON gives one operative +1 AP. Limited uses per mission (O key).'],
    ['Sever', 'fw', 'A hacker next to the Uplink Core can try to cut it. Three successes end the mission.'],
    ['Convergence', 'fw', 'The doomsday clock. At 100% the Lattice owns Earth\'s networks and you lose. Infection, failed and skipped missions speed it up.'],
    ['Infection', 'both', 'How much of a region\'s networks the Lattice runs. It feeds Convergence and the Lattice\'s compute.'],
    ['HALCYON', 'fw', 'Earth\'s own AI, kept air-gapped. Gives you the Sentinel, Overclock and late research.'],
    ['Salvage', 'fw', 'Lattice hardware recovered from missions. Needed for some research and fabrication.'],
    ['Credits (§)', 'fw', 'Funding arrives every 30 days. Spend it on facilities, fabrication and recruits.'],
    ['Power', 'fw', 'Generators supply it, facilities use it. A facility under construction already reserves its power.'],
    ['Research points (RP)', 'fw', 'Labs and server farms produce them each day toward the current project.'],
    ['Relay', 'fw', 'A Lattice signal tower that spawns reinforcements. Destroying one and recovering its core opens the path to the uplink.'],
    ['Uplink Core', 'both', 'The Lattice\'s ground link to its satellites. The final FIREWALL mission destroys or severs it; as the Lattice you must hold it.'],
    ['Swarm Drone', 'both', 'Fast, fragile Lattice machine. Easy to hack. With Detonation Protocol it can explode.'],
    ['Warden Mech', 'both', 'Hijacked security robot: slow, armored, hits hard. Hard to hack.'],
    ['Harmonic', 'both', 'Hard-light avatar of the Lattice. Its Data Spike ignores cover and never misses. Cannot be hacked.'],
    ['Data Spike', 'lat', 'Harmonic ability: 3 damage that ignores cover and never misses. Cooldown 3.'],
    ['Detonate', 'lat', 'Drone ability (with Detonation Protocol): 3 damage in a 3×3 area and destroys cover. The drone is lost.'],
    ['Compute', 'lat', 'The Lattice\'s currency. Grows with infection; spent on nodes, units, seeding and protocols.'],
    ['Substrate', 'lat', 'Physical material recovered from battles and strikes. The late protocols, Harmonics, Wardens and Choirs need it.'],
    ['Bandwidth', 'lat', 'How many units you can field. Foundries raise it.'],
    ['Protocols', 'lat', 'The Lattice\'s research. Unlocks units, mods and abilities.'],
    ['The Array', 'lat', 'Your node grid: the Nexus, Foundries, Choirs and more. The Lattice\'s base building.'],
    ['Seed', 'lat', 'Spend compute to push infection up in one region. Has a cooldown.'],
    ['Detection / Trace', 'lat', 'How close Earth is to finding you (called Trace once FIREWALL exists). Higher Trace makes FIREWALL stronger; at 100% they find the Uplink Core and you must hold it in a final battle.'],
    ['Infiltration', 'lat', 'Phase one of the Lattice campaign. Earth has not noticed you; the only defenders are its security software. FIREWALL forms at 20% Detection or on day 21.'],
    ['Breach', 'lat', 'Attack a system guarded by security software. You move first; purge the defenders within 25 turns.'],
    ['Raid', 'lat', 'FIREWALL attacks one of your cells. Survive 10 turns or wipe the squad. Ignoring a raid costs infection and adds Detection.'],
    ['Strike', 'lat', 'You attack a FIREWALL safehouse. Wins set FIREWALL back and pay your choice: Trace -8% or +25 substrate.'],
    ['Security software', 'lat', 'Perimeter Firewall (tough, slow), Antivirus Daemon (mobile) and Intrusion Sentinel (long-range eye): Earth\'s first defenders.']
  ];
  var CONTROLS = [
    ['Click unit / Tab', 'Select an operative (Tab cycles units with AP left)'],
    ['Right-click tile', 'Move there (blue = 1 AP, amber = dash, 2 AP)'],
    ['Click hostile', 'Aim; click it again to fire'],
    ['1–5', 'Arm an ability; press the same key again (or Space) to use it'],
    ['Tab (ability armed)', 'Cycle that ability\'s targets'],
    ['Space', 'Confirm the armed ability (same as pressing its key again); ends the turn once nobody has AP left'],
    ['Y', 'Overwatch all, then end the turn (asks first)'],
    ['H', 'Hunker all, then end the turn (asks first)'],
    ['O', 'Overclock (HALCYON +1 AP)'],
    ['Arrow keys / map edge', 'Scroll the battle map'],
    ['Left- or middle-drag', 'Pan the map (a left click without dragging still selects and aims)'],
    ['Mouse wheel', 'Zoom in and out'],
    ['C', 'Centre the view on the selected unit'],
    ['Enter', 'End turn'],
    ['Esc / right-click', 'Cancel an armed ability'],
    ['M', 'Mute or unmute'],
    ['? / F1', 'This help']
  ];

  function open(tab) {
    tab = tab || 'glossary';
    var side = XG.UI && XG.UI.g ? (XG.UI.g.faction === 'lattice' ? 'lat' : 'fw') : 'both';
    var tabs = [['glossary', 'Glossary'], ['controls', 'Controls'], ['manual', 'Field manual'], ['notes', 'Patch notes']];
    var body = '';
    if (tab === 'glossary') {
      body = '<input id="gl-q" class="gl-q" placeholder="Search terms…" autocomplete="off"><div id="gl-list" class="gl-list"></div>';
    } else if (tab === 'controls') {
      body = '<table>' + CONTROLS.map(function (c) { return '<tr><td><b>' + c[0] + '</b></td><td>' + c[1] + '</td></tr>'; }).join('') + '</table>';
    } else if (tab === 'notes') { // from CHANGELOG.md via tools/build-changelog.js (js/changelog.js)
      body = '<div class="notes">' + notes() + '</div>';
    } else {
      body = '<p><b>FIREWALL:</b> research your way to the Lattice uplink and sever it before Convergence hits 100%. Take missions as they appear; skipped ones and infected regions speed the clock up.</p>' +
        '<p><b>LATTICE:</b> push Convergence to 100%. If Trace reaches 100% first, FIREWALL comes for the Uplink Core and you must hold it. Breach systems early, then hold your cells against FIREWALL raids and strike their safehouses.</p>' +
        '<p><b>In battle:</b> move to cover first, then shoot. Flank (green odds) for big crits. Put units that can\'t see anything on overwatch. Read the hit breakdown when you hover a target.</p>' +
        '<p><b>Between battles:</b> keep research running, build power before labs, and keep wounded operatives out of the next fight.</p>' +
        '<p><b>Experience (FIREWALL):</b> operatives who come home earn XP. They get <b>+1 XP</b> for a won mission and <b>+1 XP</b> for every hostile they finish off, so the killing blow is what counts. A hostile a hacker has overridden and still controls when the battle ends counts as a killing blow for the hacker. Operatives killed in action keep nothing. Ranks: ' +
        XG.DATA.ranks.map(function (r) { return r.name + ' ' + r.xp; }).join(' · ') + ' XP. Each promotion adds <b>+' + XG.DATA.rankBonus.aim + ' aim</b> and <b>+' + XG.DATA.rankBonus.hp + ' HP</b>. The Lattice notices: once the squad you deploy averages ' + XG.DATA.ranks[XG.DATA.tuning.veteranDrone].name + ' or better, every mission has one more Swarm Drone.</p>' +
        '<p><b>Experience (LATTICE):</b> your forces don\'t gain XP. The FIREWALL squads you face come in at higher ranks as the days pass and Trace climbs, and each strike you win sets them back a step. Your machines keep pace: they deploy at the mark matching that squad (Mk I against Recruits, up to Mk VI against Captains), <b>+' + XG.DATA.markBonus.aim + ' aim and +' + XG.DATA.markBonus.hp + ' HP</b> per mark.</p>';
    }
    XG.UI.modal('<h1>Help</h1><div class="help-tabs">' + tabs.map(function (t) { return '<button data-help="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') +
      '</div>' + body + '<div class="modal-actions">' + (XG.UI && XG.UI.g ? '' : '<button data-action="training">Combat training</button>') + '<button data-help-settings>Settings ⚙</button><button class="primary" data-action="close">Close</button></div>');
    document.querySelectorAll('[data-help]').forEach(function (b) { b.onclick = function () { open(b.getAttribute('data-help')); }; });
    document.querySelector('[data-help-settings]').onclick = settings;
    if (tab === 'glossary') {
      var draw = function () {
        var q = ($('gl-q').value || '').toLowerCase();
        var list = TERMS.filter(function (t) { return (side === 'both' || t[1] === 'both' || t[1] === side) && (!q || (t[0] + ' ' + t[2]).toLowerCase().indexOf(q) >= 0); });
        $('gl-list').innerHTML = list.length ? list.map(function (t) { return '<div class="gl"><b>' + t[0] + '</b><span>' + t[2] + '</span></div>'; }).join('') : '<p class="dim">No matching term.</p>';
      };
      $('gl-q').oninput = draw; draw(); $('gl-q').focus();
    }
  }

  // Patch notes: each release (Unreleased shows as the latest build), its dated groups, then the entries.
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function niceDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? +m[3] + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : s; }
  function notes() {
    var log = XG.CHANGELOG || [];
    if (!log.length) return '<p class="dim">No patch notes yet.</p>';
    return log.map(function (r) {
      return '<h3>' + (r.name === 'Unreleased' ? 'Latest build' : r.name) + '</h3>' + r.groups.map(function (gr) {
        return (gr.name ? '<div class="notes-date">' + niceDate(gr.name) + '</div>' : '') + '<ul>' + gr.items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
      }).join('');
    }).join('');
  }

  function settings() {
    var v = S.all();
    var slider = function (k, label) { return '<label class="set"><span>' + label + '</span><input type="range" min="0" max="100" data-set="' + k + '" value="' + Math.round(v[k] * 100) + '"><b id="sv-' + k + '">' + Math.round(v[k] * 100) + '</b></label>'; };
    var check = function (k, label) { return '<label class="set"><span>' + label + '</span><input type="checkbox" data-set="' + k + '"' + (v[k] ? ' checked' : '') + '></label>'; };
    XG.UI.modal('<h1>Settings</h1>' +
      '<h3>Audio</h3>' + slider('master', 'Master volume') + slider('music', 'Music') + slider('sfx', 'Sound effects') + check('muted', 'Mute (M)') +
      '<div class="advance-row"><button id="set-test">Test sound</button><span class="dim">Sound starts after your first click on the page.</span></div>' +
      '<h3>Battle</h3><label class="set"><span>Animation speed</span><select data-set="speed">' + [1, 1.5, 2, 3].map(function (x) { return '<option value="' + x + '"' + (v.speed === x ? ' selected' : '') + '>' + x + '×</option>'; }).join('') + '</select></label>' +
      check('shake', 'Screen shake') +
      '<label class="set"><span>Colour palette</span><select data-set="palette"><option value="default"' + (v.palette === 'default' ? ' selected' : '') + '>Default (cyan / red / green)</option>' +
      '<option value="contrast"' + (v.palette === 'contrast' ? ' selected' : '') + '>High contrast (blue / orange)</option></select></label>' +
      '<h3>Help</h3>' + check('hints', 'Tutorial and tips') + check('comms', 'HALCYON / Lattice comms chatter') +
      '<div class="advance-row"><button id="set-reset">Replay tutorials and tips</button><span class="dim" id="set-reset-msg"></span></div>' +
      '<div class="modal-actions"><button class="primary" data-action="close">Done</button></div>');
    document.querySelectorAll('[data-set]').forEach(function (el) {
      var k = el.getAttribute('data-set');
      el.oninput = el.onchange = function () {
        var val = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value / 100 : k === 'speed' ? +el.value : el.value;
        S.set(k, val);
        if (el.type === 'range') $('sv-' + k).textContent = el.value;
      };
    });
    $('set-test').onclick = function () { XG.Audio.unlock(); XG.Audio.play('shot-bullet'); setTimeout(function () { XG.Audio.play('hit'); }, 180); };
    $('set-reset').onclick = function () { S.resetTutorial(); $('set-reset-msg').textContent = 'Done. Tips show again; the tutorial runs in your next first battle.'; };
  }

  // Palette applies as a body class; gfx reads it per frame.
  function applyPalette() { if (typeof document !== 'undefined') document.body.classList.toggle('cb', S.get('palette') === 'contrast'); }
  if (typeof document !== 'undefined') {
    if (document.body) applyPalette(); else document.addEventListener('DOMContentLoaded', applyPalette);
    S.onChange(function (k) { if (k === 'palette') applyPalette(); });
  }

  return { open: open, settings: settings, TERMS: TERMS };
})();
