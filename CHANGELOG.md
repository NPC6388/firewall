# Changelog

All notable changes to FIREWALL, newest first. Add a line under **Unreleased** with every change you push; when a
version is cut, rename that heading to the version and date. Write for players: what changed in the game, not how.

The in-game **Help → Patch notes** tab shows everything from the first `##` heading down. After editing this file, run
`node tools/build-changelog.js` to regenerate `js/changelog.js` (the smoke test fails if you forget).

## Unreleased

### 2026-10-22
- **Audio:** new soundtrack moods. Dark ambient and darksynth tracks join the score, and the music shifts with the state of
  the war and of each battle: quiet while you sneak, driving once you make contact, frantic when you are losing.
- **Battle:** cover can be shot down. With Shoot armed, click a crate, tall cover, glass panel or fuel barrel you can see (aim, then
  click again). Crates take two or three rifle hits, tall cover more, barrels and glass one; a destroyed barrel explodes. Barriers,
  pillars, walls and fences cannot be shot. The hover panel shows the object's durability and your odds, and the AI will shoot a
  barrel that catches two of your units.
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
