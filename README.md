# FIREWALL: Earth vs. The Lattice
An X-COM-style game: turn-based squad combat, a tech tree, base building, and a doomsday countdown.
An alien AI signal has hit Earth's satellites and is converting every networked device into more of
itself. Soldiers, hackers, field scientists and **HALCYON**, an Earth-born AI, fight back.

**Status: MVP, both sides.** Play **FIREWALL** (defend Earth) or the **LATTICE** (be the alien AI). Each is a full campaign with its own tech tree, base and story, and they save separately. See [PLAN.md](PLAN.md) for the design and the roadmap toward head-to-head versus.

## Play
**▶ Play in your browser: https://npc6388.github.io/firewall/**

Or run it locally: double-click `index.html` (any modern browser). No install, no server, no build step.
Progress autosaves in the browser (localStorage) whenever you're on the strategy screen.

## How to win as FIREWALL
Research **Signal Analysis → Lattice Grammar** (unlocks the *Relay Trace* story mission) → win it to get a
**Relay Core** → **Relay Core Analysis** + **HALCYON Integration** → **Uplink Triangulation** → win
**Sever the Uplink**. Do it before **Convergence** hits 100%. It rises every day, faster with regional
infection, and jumps when you let missions expire.

## How to win as the LATTICE
Reach **Convergence 100%** before FIREWALL finds you. You start in **Infiltration**: breach Earth's security software
(firewalls, antivirus, intrusion detection) to spread infection and earn compute. Every breach raises **Detection**; at 20%
(or day 21) the natives form FIREWALL and the war begins: hold your cells against **raids** (your units start on overwatch,
survive 10 turns or wipe them) and **strike** their safehouses to cut their Trace. Compile drones, Wardens and Harmonics;
build the Array (Foundry, Compute Core, Harmonic Choir, Signal Mask, Seed Spire); research 10 protocols. If Trace hits 100%
they assault the Uplink: hold it or lose.

## Tactical controls
| Input | Action |
|---|---|
| Click operative / squad card / `Tab` | Select. Each turn starts on the leader (most HP); `Tab` goes down the squad by HP. While an ability is armed, `Tab` / `Shift+Tab` cycles its targets instead |
| Click blue tile / amber tile | Move (1 AP) / dash (2 AP) |
| Click enemy, click again | Aim, then fire |
| `1`–`5` | Pick an ability (numbers shown on the buttons); press the same key again to fire it at the aimed enemy or hovered tile/ally |
| `O` | HALCYON Overclock: +1 AP (after HALCYON Integration) |
| `Space` | Confirm the armed ability (same as its key again) |
| `Y` | Overwatch all (asks first) |
| `Enter` | End turn |
| `Esc` / right-click | Cancel |
| `M` | Mute or unmute |
| `?` / `F1` | Help: glossary, controls, field manual |

Your first battle on each side runs a short tutorial (skip it any time), and each strategy tab shows a tip the first time you open it. The ⚙ button (title screen, strategy tabs, battle bar) holds volume, animation speed, screen shake, a high-contrast blue/orange palette, and a switch to replay the tutorials. All sound is synthesized in the browser and starts after your first click.

The game honours your system's *reduce motion* setting: no screen shake, fewer particles, a still title globe.

Hover a tile to see its cover (shield icons: filled = full, half-filled = half). Hover an enemy to see hit %, crit % and its cover from your angle: cover counts in full within 30° of head-on, fades to half by about 63°, and past that the target is flanked.

## Project layout
| Path | What |
|---|---|
| `js/data.js` | All content: classes, weapons, enemies, techs, facilities, fabrication, regions, story, tuning |
| `js/state.js` | Seeded RNG, new-game state, soldier stats, save/load |
| `js/strategy.js` | FIREWALL campaign rules: day clock, research, base, missions, Convergence, mission results |
| `js/lattice.js` | LATTICE campaign rules: compute, protocols, the Array, forces, Detection/Trace, breaches, raids, strikes, the AI FIREWALL |
| `js/tactical.js` | Pure battle engine (no DOM): map gen, LOS, cover, abilities, AI, turns. `b.human` is the side the person plays |
| `js/tactical-ui.js` | Tactical screen: input, HUD, event animation queue, draw order |
| `js/gfx.js` | Procedural graphics, no image files: baked terrain for four biomes (city, relay, uplink, cyberspace), unit sprites, particles, fog, lights, banners |
| `js/settings.js` | Player settings and tutorial progress (`firewall-settings-v1`, separate from saves) |
| `js/audio.js` | WebAudio synth: every sound effect plus a generative score per scene; no sound files |
| `js/tutorial.js` | First-battle coach for each side and one-time strategy tips |
| `js/help.js` | Help modal (searchable glossary, controls, field manual) and the settings modal |
| `js/backdrop.js` | World-map continents, data packets and satellite; the animated title globe |
| `js/ui.js` | FIREWALL strategy screens, modals, story player |
| `js/lattice-ui.js` | LATTICE strategy screens (magenta theme), squad picker, results |
| `js/main.js` | Boot and click-action router |
| `tests/smoke.js` | Headless test: rule checks, AI-vs-AI battles, auto-played campaigns |
| `tests/browser/` | Headless-Edge driver (`drive.mjs`) plus scripted UI runs; screenshots go to `tests/browser/shots/` |

## Test
```
node tests/smoke.js            # 60 battles + 10 campaigns
node tests/smoke.js 200 30 60 40   # FIREWALL battles, FIREWALL campaigns, Lattice battles, Lattice campaigns
```
Browser check (drives the real page in headless Edge, reports page errors):
```
node tests/browser/drive.mjs tests/browser/playthrough.mjs
node tests/browser/drive.mjs tests/browser/finale.mjs
node tests/browser/drive.mjs tests/browser/lattice.mjs
node tests/browser/drive.mjs tests/browser/gfx-gallery.mjs   # zoomed shots of every sprite in every biome, plus effects and fps
node tests/browser/drive.mjs tests/browser/gfx-profile.mjs   # milliseconds per frame for each drawing stage
node tests/browser/drive.mjs tests/browser/onboarding.mjs    # settings, help, tips, portraits, tutorial, hit breakdown, audio
node tests/browser/drive.mjs tests/browser/audio-levels.mjs  # peak level of every sound and the music
```
Add `PAGE_URL=https://npc6388.github.io/firewall/` in front of either command to test the live site.
The smoke test prints win/loss per mission type and difficulty, and how each simulated campaign ended. Exit code 1 means a check failed.
The bot plays worse than a person would (no deliberate flanking or overwatch), so read its win rates as a floor.
Last run: the FIREWALL bot wins about 60% of campaigns and the Lattice bot about 57%, so the two sides are roughly even.
