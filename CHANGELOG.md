# Changelog

All notable changes to FIREWALL, newest first. Add a line under **Unreleased** with every change you push; when a
version is cut, rename that heading to the version and date. Write for players: what changed in the game, not how.

The in-game **Help → Patch notes** tab shows everything from the first `##` heading down. After editing this file, run
`node tools/build-changelog.js` to regenerate `js/changelog.js` (the smoke test fails if you forget).

## Unreleased

### 2026-10-23
- **Windows:** you can climb straight through a window now, with no need to shoot it first. Whoever goes through smashes it,
  so it leaves an open gap that is no longer half cover for anyone.
- **Lattice pods wake together:** once one Lattice unit spots your squad, its whole pod comes alive at once, along with
  anything else within 11 tiles (was 7). Sneaking up on a group is tenser; picking off one sentry no longer splits a pod.
- **The Lattice keeps escalating:** after day 90 and again after day 108 its cells grow bigger, with Harmonics leading
  the pods (threat now runs past five bars). Their aim stops rising at day 73; they win by numbers, not by stats.
- **Research gets dearer:** every tech you finish makes each remaining one 8% more expensive. Research cards show the
  real cost (and the base cost beside it), so the order you choose matters.
- **Recruits cost more each time:** the first hire is §30, then §40, §50... up to §75; the price eases back two steps
  each month. The roster holds 8 people and Sentinels in all. Losing veterans now hurts.
- **Salvage has uses:** grenades (5 salvage) and medkits (2) used in a mission are restocked afterwards, Sentinel repairs
  cost 2 salvage per HP (no salvage, no repair), each new Sentinel chassis costs more than the last, and Firewall
  Protocols (25) and Uplink Triangulation (30) now need salvage to start.
- **Ignored missions hurt the budget:** a mission that expires now also costs §15 of funding as that region panics.
  Every mission card says what ignoring it costs.
- **To make room for all that:** missions stay open a day longer (5-7 days), research runs at 12 RP a day base (was 10),
  regional funding is §38 a month per clean region (was §32), and Convergence creeps a touch slower.
- **Ignored raids hurt:** a FIREWALL raid you leave unanswered now purges 20% infection in that region (was 10%), adds
  +5% Trace (was +2%) and knocks one of your Array nodes offline for 4 days. Raid and strike briefs end with a line saying
  what ignoring them costs. Losing a raid also costs 3% Convergence.
- **Strike rewards are a choice:** a won strike still knocks FIREWALL back a step, and then you pick Trace -8% or +25
  substrate on the result screen. If you advance time without choosing, you get the Trace cut. A safehouse you leave
  alone until it goes dark now adds +4% Trace.
- **The Uplink assault is FIREWALL's best:** when Trace reaches 100%, the squad that comes for the Uplink brings one
  more trooper and fights one rank above your machines' mark.
- **FIREWALL keeps climbing:** won strikes still set FIREWALL back, but its rank never drops below one level per 20 days
  (was 30), so strikes buy you time rather than a permanent lead.
- **Substrate has a use:** Hard-Light Projection (30), Phase Shielding (30), Recursive Harmonics (40) and Harmonic
  Overture (60) now cost substrate to start (paid once), and Harmonics cost 16 substrate (was 12). Every won battle pays at
  least 12 compute and 10 substrate (was 10 and 6).
- **Protocols get dearer:** each finished protocol makes the next one 8% more expensive in cycles; the cards show the real
  cost. To match, the Nexus compiles protocols faster (15 cycles a day, was 10) and Convergence grows a little faster
  (+0.27% a day base, was 0.22%).
- **Lattice campaign battles:** the FIREWALL squad now uses its abilities against you. Troopers throw grenades into
  clusters of two or more of your units (or at a wounded one in cover), Scientists patch up a neighbour who is down 3+ HP,
  Hackers stun your biggest machine in range, and Sentinels shield whichever soldier is most exposed. They only act on what
  their own squad can see. Combat training is unchanged.
- **Overheard debates:** on the strategy screen you now sometimes overhear the people behind your choices arguing. In
  FIREWALL, HALCYON spars with Dr. Amara Okafor, head of R&D (amber comms card), about power vs labs, armour vs guns,
  letting HALCYON in, salvage piles, Sentinels, the Signal Array and the Infirmary. In the Lattice campaign two
  sub-processes argue about Foundries, Cores, Masks, Spires, Choirs, hoarded substrate, ignored raids and strikes. Each
  debate plays once, when its choice is live, and ends in a hint rather than an order.

### 2026-10-22
- **Battle panel:** hovering a hostile now shows one side-by-side table: every factor of your shot at it and its shot at you
  (aim, cover, defense, hunker, range, floor/cap), then both hit chances, crits and damage after armor, plus each side's cover.
  You can see at a glance why its odds differ from yours.
- **Battle:** a unit standing in a doorway can step-peek one tile out of either side of the door, so it sees and shoots
  along the outside of the wall (and is seen) instead of only along straight lines. It still never sees along the wall.
- **Line of sight:** sight is now a true straight line between tile centres. It is blocked only where it passes through a
  wall or solid cover; a line that just clips a corner gets past. Units in a room see across it diagonally, past racks and
  desks, and out of its doorways and windows at wide angles, and are seen back along the same lines. Leaning past a door
  jamb or a window is no longer limited to a narrow cone. Walls still seal a room everywhere else, and two blocks that touch
  at a corner leave no gap.
- **Maps:** windows break open. A stray miss or a blast shatters a window, leaving an open gap anyone can walk through.
- **Lattice:** your machines now gain +2 aim per mark as well as +1 HP (half of a FIREWALL soldier's +4 aim per rank), so
  they keep up with veteran five-soldier squads.
- **Maps:** new *outside* map. One large building stands in a yard; the server sits in an inner room. The defenders start
  inside, dug in near the server; the attackers start out in the yard, well away from every entrance, and must cross it and
  break in through one of 2-4 doorways. Inside: rooms, corridors, desks and server racks. About 40% of NODE missions (and
  15% of EXTERMINATE missions, where the defenders hold the building) use it, in both campaigns, with a 14-turn clock.
- **Windows:** the building's outer walls have windows. You cannot climb through, but you can see and shoot through them.
  Right in front of one is half cover; beside it, behind the wall, is full cover and you can lean out through it. A stray
  miss or a blast shatters it into an empty frame that still blocks movement. The building's floor is tiled, so you can
  tell inside from outside at a glance.
- **Line of sight:** cover is now either solid or fire-through. Solid cover (walls, tall cover, racks, bunkers, the tall
  sides of mixed cover) blocks sight and fire: nobody sees or shoots straight past it, only by leaning round its end.
  Fire-through cover (crates, low walls, windows, glass panels, fences) never blocks a shot. The hover panel says which,
  and solid cover casts a long shadow with a dark top edge.
- **Rooms are strong points:** units inside a walled room can only be seen and shot along real lines through its doorways
  and windows. A unit in a doorway no longer leans into the room, leaning past a door jamb or a window only looks straight
  through the gap, and lines no longer slip diagonally past a wall corner. The room stays dark until someone can see in.
- **Rewards:** fast wins pay more. Every won battle pays at least its base reward, rising to triple for a win in 4 turns or
  fewer (double at 9 turns, base at 14 or more): salvage and credits for FIREWALL, compute and substrate for the Lattice.
  The Lattice now earns at least 10 compute and 6 substrate from every battle it wins, as FIREWALL always earns credits.
- **Battle:** a restart now changes only where the squads land and how enemies patrol. The map, the objectives and the
  enemy forces stay exactly the same; squads land next to cover the map already has.
- **Performance:** the world map is much lighter on your graphics card. Its moving parts (the scan sweep, data packets,
  the satellite and the pulsing mission rings) now animate on their own layer, so the browser no longer redraws the whole
  map many times a second. This should stop video in another window stuttering or pausing while you play.
- **Comms:** HALCYON and the Lattice have a sense of humour now. HALCYON is dry when things go well and gets nervous,
  over-precise and a bit too honest as Convergence climbs; the Lattice is smug when it is winning and touchy and sarcastic
  when it is not. About 170 new lines across every event, in both campaigns.
- **Comms:** the voices remember your campaign. They now mention what really happened in earlier battles (which side the
  enemy keeps flanking from, hit rates, the deadliest enemy, units lost, overwatch kills, win streaks, servers taken)
  and never claim a pattern your battles have not shown.
- **Battle panel:** the selected-unit box now shrinks to fit its stats, and hovering a hostile shows two columns: the target's odds, and "You vs target" (your cover, armor, shield, hunker, distance, whether it sees you and its chance to hit you; stacks on narrow screens).
- **Missions:** two raid scenarios. Ordinary missions in both campaigns (FIREWALL purges, Lattice raids and strikes) are now
  either **Node defense** or **Extermination**, shown as a NODE or EXTERMINATE tag on the mission card and in the briefing.
  Node defense puts a server near the defenders: the attacker scores a capture point at the end of each turn it has a unit
  beside the server and the defender has none there, and two points take it. The defender wins by holding out to the turn
  limit (10 turns). The server cannot be shot or destroyed, gives no cover,
  and a ring on it shows the capture and who holds the zone. Extermination has no time limit: it ends when one side is gone.
- **Battle:** Restart mission now changes only where both sides spawn and where patrols walk. The map, the enemies, the Relay,
  the Uplink Core and the server stay exactly where they were.
- **Battle:** pressing Tab to switch operatives now centres the camera on the one you switched to.
- **Battle:** fixed garbled dashes, arrows and degree signs in the battle log and hit-chance breakdown.
- **Battle:** random spawn points. Both sides now start somewhere new on every mission: your squad lands on a random map edge (north, south, east or west) and the enemy starts well away from it. Restart mission keeps the same map, squads and HP but reshuffles where everyone spawns.
- **Audio:** new soundtrack moods. Dark ambient and darksynth tracks join the score, and the music shifts with the state of
  the war and of each battle: quiet while you sneak, driving once you make contact, frantic when you are losing.
- **Battle:** cover wears down. A third of the shots that miss someone in breakable cover tear into the cover instead: crates fall
  after about two such misses, tall cover after three or four, glass shatters on any miss. Grenades and other blasts still
  flatten it. Breakable cover carries a faint hairline crack so you can tell it from blast-proof barriers and pillars.
- **Battle:** fuel barrels can be shot. With Shoot armed, Tab cycles to any barrel in reach after the enemy units (or click
  one: aim, then click again). One hit sets it off. The AI will shoot a barrel that catches two of your units.
- **Battle:** fixed a line-of-sight bug: a unit standing mid-wall (not at the end of it) could lean round the corner and see or be
  shot from far past the wall. Leaning only works from the last tile of a wall or tall cover.
- **Battle:** corner standoffs. When two units hug the same wall or tall cover and can only see each other by leaning round the
  corner, both shoot from a flat 50% base instead of their aim (cover, range and the rest still apply). The odds panel shows it.
- **Battle:** mixed-side cover. Sandbag bunkers, shielded emplacements and partial firewalls have tall faces and low faces: only the
  side toward the attacker counts. Hover one to see which sides are full and which are half.
- **Battle:** five new obstacles on the map. Fuel barrels (coolant tanks, unstable packets) explode when destroyed, hurting
  everyone next to them and setting off neighbouring barrels. Concrete barriers and pillars are blast-proof. Glass panels
  are full cover but shatter when a shot at someone behind them misses (or in a blast). Fences block movement but not sight.
- **Battle:** a double row of tall cover (two racks or barriers back to back) now blocks sight completely, even
  with someone pressed against each side. Lean around the end of the row to see past it.
- **Battle:** Swarm Drones watch you: the pupil in each drone's eye follows your cursor around the map.
- **Battle:** new mouse controls. Right-click a tile to move there; drag with the left button to pan the map. A left
  click still selects units and aims, and right-click cancels an armed ability.
- **Battle:** fog of war hides the map until you discover it. Ground nobody has seen is blank; ground you have seen
  but can no longer see stays dimmed.
- **Battle:** your squad deploys together again, packed into a 3x3 block on the west edge.
- **Lattice campaign:** in raids and uplink defences your machines also start together in one 3x3 block, dug in behind
  cover facing FIREWALL (next to the core when defending it), instead of in scattered pods.
- **Battle:** range now matters on every shot. There is no penalty next to the target, and it grows evenly to -30% at
  the weapon's max range (it used to start only past 10 tiles). Shots still cap at 95%, and flanked targets still add
  +25% crit chance, rolled only when the shot hits.
- **Battle:** maps are three times bigger (38x28 tiles) with more buildings, cover and terrain to fight through.
  The view scrolls: arrow keys, the map edge or a left-drag pan, the wheel zooms, C centres on your unit, and the
  camera follows the action. Mission timers are unchanged; combat training keeps its small range.
- **Lattice campaign:** when FIREWALL raids your cell, your units start dug in behind cover facing the attackers, and
  FIREWALL spends its first turn moving in without firing, so the first shots are yours or your overwatch's.
- **Lattice:** longer weapon range. Swarm Drones reach 12 tiles (was 10), Warden Mechs and Harmonics 13 (was 12),
  level with the FIREWALL assault rifle.
- **Lattice campaign:** your machines now keep pace with FIREWALL's veterans. They deploy at a mark (Mk I to Mk VI)
  matching the rank of the squad they face, with +1 HP per mark, so late-game drones are no longer paper.
- **Lattice:** veteran squads draw more attention. Once the squad you deploy averages Sergeant or better, each mission
  has one extra Swarm Drone.
- **Battle:** Hunker all (H). Every unit with AP left hunkers down and the turn ends, after a confirm, like Overwatch all.
- **Battle:** the combat log now shows how many hostiles are still alive out of all you have discovered (e.g. 2/5).

### 2026-10-21
- **Help:** Patch notes are live. The Help menu now lists every change, newest first.
- **XP:** a hostile your hacker has overridden and still controls when the battle ends earns the hacker the same XP as a
  killing blow (it isn't added to their kill count).
- **Help:** the Field manual explains how operatives earn XP and what each rank gives.
- **Battle:** a slimmer bottom bar. Squad cards are half the size, abilities stay on one row, and the map no longer
  shrinks when you select a unit with more abilities.
- **Comms:** HALCYON grows more afraid and the Lattice more smug as Convergence climbs toward 100%, and both swing
  back when it falls. In the Lattice campaign, a high Trace takes the edge off the Lattice's smugness.
- **Maps:** five battle map layouts (compound, street, container yard, plaza, dense blocks) instead of one.
- **Maps:** 0–2 impassable features per map (sinkhole, Lattice chasm, coolant breach or null sector, by biome). Nothing
  crosses them, but they give no cover and don't block line of sight.
- **Battle:** hovering one of your units shows its AP left as small diamonds beside it, and "N AP left" in the hover panel.
- **Battle:** the HALCYON Sentinel counts as half cover for anyone standing next to it.
- **Battle:** every unit except the HALCYON Sentinel can hunker. Short ability labels keep five abilities on one row.
- **Battle:** Aegis Shield has no range limit and needs no line of sight. It reaches any ally on the map.
- **Battle:** restart a mission from the Abort dialog or the end-of-battle screen.
- **Battle:** Overwatch all ends the turn, and its button shows the Y hotkey. Space ends a turn once every unit is spent.
- **Battle:** cover shields under the cursor judge each side against the enemies you can see. Cover facing no visible
  enemy shows no shield, and half cover shows a half-filled shield.
- **Battle:** hovered tiles show faint colour-coded cones for which directions their cover protects.
- **Combat training:** guided steps, a pulsing tile and arrow mark where to move, markers never leave you in the open,
  and Space presses the coach's Next / Finish button.
- **World map:** a low-res pixel map drawn from real coastlines, land shaded by each region's infection in each
  campaign's own colours, and rough grey infection halos until Signal Analysis is researched.
- **Comms:** HALCYON and the Lattice speak up during play.
- **Performance:** no more stalled video in other browser tabs. Dialogs no longer blur the background, map animations
  pause under dialogs, and idle battles redraw less often.

### 2026-10-20
- **First playable build:** an X-COM-style campaign as Earth's FIREWALL against the alien AI, the Lattice.
- **Play the Lattice:** a second campaign as the alien AI, with its own tech tree, the Array and its forces.
- **Battle:** cover scales with the viewing angle. Corner peeking lets units beside a wall or tall cover lean out to see
  and shoot.
- **Battle:** enemy pods patrol while unaware. A hacked drone on your side can be shot, listed last among targets.
- **Battle:** Overwatch all (Y) with a confirm step. Space confirms any armed ability.
- **Battle:** each turn starts on the leader (most HP), and Tab cycles in HP order. Hunker shows how much it helps.
- **Combat training:** a guided range that teaches cover and hit odds.
- **Graphics:** procedural terrain for four biomes, unit sprites, particles, fog and lighting. Squad-bar sprite portraits.
- **Audio and onboarding:** synthesized sound effects, a generative score (phonk in battle, reacting to contact), a
  tutorial coach, tips, a glossary and settings.
- **Strategy:** sortable Barracks, minimum mission credits, and world-map infection halos sized by infection.
- **Web:** playable on GitHub Pages.
