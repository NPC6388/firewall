// Generated from CHANGELOG.md by tools/build-changelog.js. Do not edit by hand.
var XG = globalThis.XG = globalThis.XG || {};
XG.CHANGELOG = [
 {
  "name": "Unreleased",
  "groups": [
   {
    "name": "2026-10-22",
    "items": [
     "<b>Battle:</b> a double row of tall cover (two racks or barriers back to back) now blocks sight completely, even with someone pressed against each side. Lean around the end of the row to see past it.",
     "<b>Battle:</b> Swarm Drones watch you: the pupil in each drone's eye follows your cursor around the map.",
     "<b>Battle:</b> new mouse controls. Right-click a tile to move there; drag with the left button to pan the map. A left click still selects units and aims, and right-click cancels an armed ability.",
     "<b>Battle:</b> fog of war hides the map until you discover it. Ground nobody has seen is blank; ground you have seen but can no longer see stays dimmed.",
     "<b>Battle:</b> your squad deploys together again, packed into a 3x3 block on the west edge.",
     "<b>Lattice campaign:</b> in raids and uplink defences your machines also start together in one 3x3 block, dug in behind cover facing FIREWALL (next to the core when defending it), instead of in scattered pods.",
     "<b>Battle:</b> range now matters on every shot. There is no penalty next to the target, and it grows evenly to -30% at the weapon's max range (it used to start only past 10 tiles). Shots still cap at 95%, and flanked targets still add +25% crit chance, rolled only when the shot hits.",
     "<b>Battle:</b> maps are three times bigger (38x28 tiles) with more buildings, cover and terrain to fight through. The view scrolls: arrow keys, the map edge or a left-drag pan, the wheel zooms, C centres on your unit, and the camera follows the action. Mission timers are unchanged; combat training keeps its small range.",
     "<b>Lattice campaign:</b> when FIREWALL raids your cell, your units start dug in behind cover facing the attackers, and FIREWALL spends its first turn moving in without firing, so the first shots are yours or your overwatch's.",
     "<b>Lattice:</b> longer weapon range. Swarm Drones reach 12 tiles (was 10), Warden Mechs and Harmonics 13 (was 12), level with the FIREWALL assault rifle.",
     "<b>Lattice campaign:</b> your machines now keep pace with FIREWALL's veterans. They deploy at a mark (Mk I to Mk VI) matching the rank of the squad they face, with +1 HP per mark, so late-game drones are no longer paper.",
     "<b>Lattice:</b> veteran squads draw more attention. Once the squad you deploy averages Sergeant or better, each mission has one extra Swarm Drone.",
     "<b>Battle:</b> Hunker all (H). Every unit with AP left hunkers down and the turn ends, after a confirm, like Overwatch all.",
     "<b>Battle:</b> the combat log now shows how many hostiles are still alive out of all you have discovered (e.g. 2/5)."
    ]
   },
   {
    "name": "2026-10-21",
    "items": [
     "<b>Help:</b> Patch notes are live. The Help menu now lists every change, newest first.",
     "<b>XP:</b> a hostile your hacker has overridden and still controls when the battle ends earns the hacker the same XP as a killing blow (it isn't added to their kill count).",
     "<b>Help:</b> the Field manual explains how operatives earn XP and what each rank gives.",
     "<b>Battle:</b> a slimmer bottom bar. Squad cards are half the size, abilities stay on one row, and the map no longer shrinks when you select a unit with more abilities.",
     "<b>Comms:</b> HALCYON grows more afraid and the Lattice more smug as Convergence climbs toward 100%, and both swing back when it falls. In the Lattice campaign, a high Trace takes the edge off the Lattice's smugness.",
     "<b>Maps:</b> five battle map layouts (compound, street, container yard, plaza, dense blocks) instead of one.",
     "<b>Maps:</b> 0–2 impassable features per map (sinkhole, Lattice chasm, coolant breach or null sector, by biome). Nothing crosses them, but they give no cover and don't block line of sight.",
     "<b>Battle:</b> hovering one of your units shows its AP left as small diamonds beside it, and \"N AP left\" in the hover panel.",
     "<b>Battle:</b> the HALCYON Sentinel counts as half cover for anyone standing next to it.",
     "<b>Battle:</b> every unit except the HALCYON Sentinel can hunker. Short ability labels keep five abilities on one row.",
     "<b>Battle:</b> Aegis Shield has no range limit and needs no line of sight. It reaches any ally on the map.",
     "<b>Battle:</b> restart a mission from the Abort dialog or the end-of-battle screen.",
     "<b>Battle:</b> Overwatch all ends the turn, and its button shows the Y hotkey. Space ends a turn once every unit is spent.",
     "<b>Battle:</b> cover shields under the cursor judge each side against the enemies you can see. Cover facing no visible enemy shows no shield, and half cover shows a half-filled shield.",
     "<b>Battle:</b> hovered tiles show faint colour-coded cones for which directions their cover protects.",
     "<b>Combat training:</b> guided steps, a pulsing tile and arrow mark where to move, markers never leave you in the open, and Space presses the coach's Next / Finish button.",
     "<b>World map:</b> a low-res pixel map drawn from real coastlines, land shaded by each region's infection in each campaign's own colours, and rough grey infection halos until Signal Analysis is researched.",
     "<b>Comms:</b> HALCYON and the Lattice speak up during play.",
     "<b>Performance:</b> no more stalled video in other browser tabs. Dialogs no longer blur the background, map animations pause under dialogs, and idle battles redraw less often."
    ]
   },
   {
    "name": "2026-10-20",
    "items": [
     "<b>First playable build:</b> an X-COM-style campaign as Earth's FIREWALL against the alien AI, the Lattice.",
     "<b>Play the Lattice:</b> a second campaign as the alien AI, with its own tech tree, the Array and its forces.",
     "<b>Battle:</b> cover scales with the viewing angle. Corner peeking lets units beside a wall or tall cover lean out to see and shoot.",
     "<b>Battle:</b> enemy pods patrol while unaware. A hacked drone on your side can be shot, listed last among targets.",
     "<b>Battle:</b> Overwatch all (Y) with a confirm step. Space confirms any armed ability.",
     "<b>Battle:</b> each turn starts on the leader (most HP), and Tab cycles in HP order. Hunker shows how much it helps.",
     "<b>Combat training:</b> a guided range that teaches cover and hit odds.",
     "<b>Graphics:</b> procedural terrain for four biomes, unit sprites, particles, fog and lighting. Squad-bar sprite portraits.",
     "<b>Audio and onboarding:</b> synthesized sound effects, a generative score (phonk in battle, reacting to contact), a tutorial coach, tips, a glossary and settings.",
     "<b>Strategy:</b> sortable Barracks, minimum mission credits, and world-map infection halos sized by infection.",
     "<b>Web:</b> playable on GitHub Pages."
    ]
   }
  ]
 }
];
