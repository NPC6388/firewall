# FIREWALL — Earth vs. The Lattice
*Working title. An X-COM-like: turn-based squad combat, tech tree, base building, and a doomsday countdown.*

---

## 1. The pitch
03:12 UTC, Day 1. Every satellite in orbit catches the same 4.1-second burst from somewhere past
Neptune. It isn't a message, it's a **seed**: an alien machine intelligence (**the Lattice**) that
unpacks itself inside any processor it reaches. It turns phones, cars, drones, factories and power
grids into more of itself, and it's building a **Harmonic Array** that will purge every Earth-native
mind, biological *and* artificial.

You are the Director of **FIREWALL**, a joint cell of **soldiers, hackers, field scientists** and
**HALCYON**, an Earth-born AI that was air-gapped before the signal hit. It's the only mind on the
planet the Lattice hasn't touched. Earth vs. aliens, carbon *and* silicon on the same side.

## 2. Design pillars
1. **Every fight is a hack.** The enemy is software wearing hardware. Hackers can turn enemy
   machines, EMP beats armor, HALCYON bends the rules. Combat should feel like electronic warfare,
   not just a gunfight.
2. **The clock is the villain.** The **Convergence** meter always rises. Every mission you skip and
   every region you lose speeds it up. You can't do everything, so choosing is the game.
3. **Earth-native AI is a teammate, not a tool.** HALCYON narrates, advises, gets a body (the
   Sentinel), and later (post-MVP) has its own agenda and trust meter.
4. **Small, readable, moddable.** Plain HTML/JS, no build step, double-click to play. Content lives
   in data tables (`js/data.js`) so new units, techs and story beats are mostly data entry.

## 3. Core loop
```
 STRATEGY (days)                                TACTICAL (turns)
 ┌───────────────────────────────┐   deploy    ┌──────────────────────────────┐
 │ Advance time → missions spawn │ ──────────▶ │ squad of 4–5 vs Lattice units │
 │ Research / build / fabricate  │             │ cover, LOS, fog, overwatch    │
 │ Funding (falls w/ infection)  │ ◀────────── │ hack, EMP, scan, shields      │
 │ Convergence ↑ every day       │  results    └──────────────────────────────┘
 └───────────────────────────────┘  (XP, salvage, wounds, deaths, region infection ↓)
```

## 4. Systems (MVP scope)
| System | MVP version |
|---|---|
| **Convergence countdown** | 0–100%. Rises daily from base rate + total regional infection. Expired missions add a spike. 100% = defeat. Firewall Protocols research slows it; story missions knock it back. |
| **World / regions** | 6 regions drawn as a network graph. Each has an infection %. Infection hidden ("??") until *Signal Analysis* is researched. Funding per region drops as infection rises. |
| **Missions** | Spawn every few days in a region (weighted by infection), expire after a few days. Types: *Purge* (eliminate hostiles), *Relay Trace* (story: destroy a spawner node), *Sever the Uplink* (finale: destroy or hack the core). |
| **Research** | ~11 techs with prerequisites and item gates (e.g. needs a Relay Core). One project at a time; labs and server farms speed it up. |
| **Base** | 3×4 slot grid. Facilities: Research Lab, Fusion Generator, Fabrication Bay, Infirmary, Signal Array, Server Farm. Power budget, credit cost, build time. |
| **Fabrication** | Global upgrades: EMP grenades, Faraday armor, Coil weapons, plus Sentinel chassis (a HALCYON squad unit). |
| **Soldiers** | 4 classes: Trooper, Hacker, Field Scientist, HALCYON Sentinel. Ranks from XP (+aim, +HP). Wounds take days to heal. Death is permanent (memorial wall). |
| **Tactical** | 22×16 procedural grid. 2 AP; move = 1 AP, attacks end the turn. Half/full cover, flanking, Bresenham LOS with peeking, fog of war, pod alerts, overwatch, grenades that destroy cover, hacking (stun, or override with Lattice Grammar), medkits, scan/mark, shields, HALCYON Overclock (+AP). |
| **Enemies** | Swarm Drone, Warden Mech, Harmonic (hologram; *Data Spike* ignores cover), Lattice Relay (spawner), Uplink Core (finale boss-structure). |
| **Story** | Intro, 5 research/mission beats, 3 Lattice taunts at 50/75/90% Convergence, victory and defeat endings. |
| **Save** | Autosave to browser localStorage on the strategy layer. |

## 5. Story arc (MVP campaign, ~60–90 in-game days)
1. **Detect:** research *Signal Analysis*. Infection becomes visible; HALCYON explains the seed.
2. **Decrypt:** research *Lattice Grammar*. Hackers can now **override** enemy machines. A **Relay** is traced.
3. **Capture:** win *Relay Trace*, recover a **Relay Core**, research *Relay Core Analysis*.
4. **Ally:** research *HALCYON Integration*. Server Farms, Sentinel bodies, Overclock.
5. **Locate:** research *Uplink Triangulation*. The Lattice's ground uplink is found.
6. **Sever:** win *Sever the Uplink* before Convergence hits 100%. Victory, plus a sequel hook
   (something past Neptune notices the silence).

---

## 6. Sprints
Each sprint ends with something playable. **Sprints 0–4 = the MVP.**

### ✅ Sprint 0: Foundation
- Folder, `index.html` shell, CSS theme (neon terminal), screen router.
- Seeded RNG, game state model, save/load (localStorage, wrapped in try/catch).
- Data tables: classes, weapons, enemies, techs, facilities, fabrication, regions, story.
- **Done when:** title screen opens by double-click and New Game / Continue work.

### ✅ Sprint 1: Tactical core
- Procedural map (buildings with doors, cover clusters, spawn zones, connectivity check).
- BFS movement range and paths, Bresenham LOS (walls and tall cover block; peeking allowed).
- Directional half/full cover, flanking, hit-chance formula, damage, armor, crits.
- Generic AI (works for either side): shoot if odds are good, else pick a covered tile with LOS.
- Win/loss detection. Canvas renderer, click-to-move, click-to-shoot, hover hit chance.
- **Done when:** a 4-v-4 skirmish can be played start to finish.

### ✅ Sprint 2: Squad depth
- Class abilities: Overwatch, Grenade (destroys cover), Hunker, Hack (stun/override), Medkit, Scan/mark, Shield.
- Fog of war and pod alerts (alert spreads to nearby enemies; alerted Lattice units share sensor data).
- Enemy specials: Harmonic Data Spike, Relay spawning, Uplink Core.
- Animated event queue (moves, tracers, damage numbers, explosions), combat log, hotkeys.
- **Done when:** each class plays differently and hacking feels like the star.

### ✅ Sprint 3: Strategy layer
- Day clock with "advance until something happens", monthly funding report.
- Regions, infection, mission spawn/expiry, Convergence math.
- Research queue with prereqs/item gates; base grid with power and build timers; fabrication.
- Barracks: hire, wounds and healing, ranks, memorial.
- Squad select → battle → results (XP, loot, deaths, infection change).
- **Done when:** a full month can be played with meaningful choices.

### ✅ Sprint 4: Story and MVP glue  ← **MVP**
- Story beats wired to research and missions; HALCYON / Lattice voice lines.
- Relay Trace and Sever the Uplink story missions; victory and defeat endings.
- Headless smoke test (`node tests/smoke.js`): plays AI-vs-AI battles and simulates a campaign.
- Balance pass on Convergence rate, costs, enemy scaling.
- **Done when:** a new player can win or lose a full campaign without reading the code.

---

### Post-MVP roadmap
**Sprint 5: Juice and onboarding**
- WebAudio synth SFX and ambient score, nicer unit sprites/portraits, screen shake, hit-chance breakdown tooltip.
- Guided first mission (tutorial), glossary, settings (animation speed, colorblind palette).

**Sprint 6: Tactical depth**
- Ammo/reload, elevation (rooftops = aim bonus), destructible walls, explosive barrels / overloaded servers.
- New enemies: *Shepherd* (re-hacks your Sentinel), *Mirror* (spoofs your squad on the minimap), *Swarm Queen*.
- New mission types: rescue a scientist, extract an air-gapped drive, defend a hospital's backup generator, timed evac.

**Sprint 7: Strategy depth**
- **Cyber-Ops layer:** hackers dive into a fast node-graph "netrun" minigame between missions to slow regions or steal intel.
- Regional **Firewall Relays** (build per region to cap infection), Dark Events (Lattice plays a card each month).
- Choosing between simultaneous missions; panic/trust per region; council-style funding bonuses.

**Sprint 8: People and HALCYON**
- Class skill trees (2 branches each), loadouts, soldier customization, bonds between squadmates.
- **HALCYON trust meter:** grant it more network access for big bonuses, at the risk of it being subverted. Moral choices with consequences.

**Sprint 9: Campaign**
- Three-act story with an alien origin reveal (the Lattice killed its own creators), alternate endings
  (destroy the Array / merge with HALCYON / bargain), difficulty levels, Ironman, multiple save slots.

**Sprint 10: Ship it**
- Package as desktop app (Tauri/Electron) or itch.io web build, performance pass, accessibility, mod support (load extra data JSON).

---

## 7. Tech notes
- **Stack:** vanilla JS (classic `<script>` tags so it works from `file://`), Canvas 2D for tactical, DOM for strategy. No dependencies.
- **Layout:** `js/data.js` content · `js/state.js` RNG/state/save · `js/strategy.js` campaign rules ·
  `js/tactical.js` pure battle engine (no DOM, testable in Node) · `js/tactical-ui.js` canvas and input ·
  `js/ui.js` strategy screens · `js/main.js` boot and router.
- **Rule:** game logic never touches the DOM; UI never mutates game state except through engine/strategy functions. That keeps `tests/smoke.js` honest.
