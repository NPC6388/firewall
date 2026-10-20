# FIREWALL: Earth vs. The Lattice
An X-COM-style game: turn-based squad combat, a tech tree, base building, and a doomsday countdown.
An alien AI signal has hit Earth's satellites and is converting every networked device into more of
itself. Soldiers, hackers, field scientists and **HALCYON**, an Earth-born AI, fight back.

**Status: MVP (Sprints 0–4 complete).** Full campaign is playable start to finish. See [PLAN.md](PLAN.md) for the design and sprint roadmap.

## Play
**▶ Play in your browser: https://npc6388.github.io/firewall/**

Or run it locally: double-click `index.html` (any modern browser). No install, no server, no build step.
Progress autosaves in the browser (localStorage) whenever you're on the strategy screen.

## How to win
Research **Signal Analysis → Lattice Grammar** (unlocks the *Relay Trace* story mission) → win it to get a
**Relay Core** → **Relay Core Analysis** + **HALCYON Integration** → **Uplink Triangulation** → win
**Sever the Uplink**. Do it before **Convergence** hits 100%. It rises every day, faster with regional
infection, and jumps when you let missions expire.

## Tactical controls
| Input | Action |
|---|---|
| Click operative / squad card / `Tab` | Select (while an ability is armed, `Tab` / `Shift+Tab` cycles its targets instead) |
| Click blue tile / amber tile | Move (1 AP) / dash (2 AP) |
| Click enemy, click again | Aim, then fire |
| `1`–`5` | Pick an ability (numbers shown on the buttons); press the same key again to fire it at the aimed enemy or hovered tile/ally |
| `O` | HALCYON Overclock: +1 AP (after HALCYON Integration) |
| `Enter` | End turn |
| `Esc` / right-click | Cancel |

Hover a tile to see its cover (shield icons: filled = full, hollow = half). Hover an enemy to see hit %, crit % and whether it's flanked.

## Project layout
| Path | What |
|---|---|
| `js/data.js` | All content: classes, weapons, enemies, techs, facilities, fabrication, regions, story, tuning |
| `js/state.js` | Seeded RNG, new-game state, soldier stats, save/load |
| `js/strategy.js` | Campaign rules: day clock, research, base, missions, Convergence, mission results |
| `js/tactical.js` | Pure battle engine (no DOM): map gen, LOS, cover, abilities, AI, turns |
| `js/tactical-ui.js` | Canvas renderer, input, event animation queue |
| `js/ui.js` | Strategy screens and modals |
| `js/main.js` | Boot and click-action router |
| `tests/smoke.js` | Headless test: rule checks, AI-vs-AI battles, auto-played campaigns |
| `tests/browser/` | Headless-Edge driver (`drive.mjs`) plus scripted UI runs; screenshots go to `tests/browser/shots/` |

## Test
```
node tests/smoke.js            # 60 battles + 10 campaigns
node tests/smoke.js 200 30     # bigger balance sample
```
Browser check (drives the real page in headless Edge, reports page errors):
```
node tests/browser/drive.mjs tests/browser/playthrough.mjs
node tests/browser/drive.mjs tests/browser/finale.mjs
```
Add `PAGE_URL=https://npc6388.github.io/firewall/` in front of either command to test the live site.
The smoke test prints win/loss per mission type and difficulty, and how each simulated campaign ended. Exit code 1 means a check failed.
The bot plays worse than a person would (no deliberate flanking or overwatch), so read its win rates as a floor.
Last run: dumb-bot campaigns won about 5 of 8, with losses coming from the squad-wipe death spiral.
