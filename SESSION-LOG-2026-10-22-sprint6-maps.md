# FIREWALL — Sprint 6 bigger maps, fog, LOS, deploy blocks — session log
**Date:** 2026-10-21 → 2026-10-22 (ended ~03:30)  ·  **Claude Code 2.1.308**  ·  **Continues:** none (first session log in this repo; earlier history is in git and `CHANGELOG.md`)

> Reconstructed after a `/clear` from the commit history, the last test outputs and `PLAN.md`. The commit messages are the authoritative record of the design decisions.

## Presenting problem
A long run of playtest polish, then the first Sprint 6 item: "triple battle map area, mission timers unchanged until playtested."

## Verdict / Outcome
**41 commits, all pushed (`main` = `origin/main`, tree clean). Mission maps are now 38x28 with a scrolling, zooming camera, plus fog, LOS double-row blocking, 3x3 deploy blocks and an even range penalty. The last smoke and balance runs passed.**

## Evidence
Last full checks (`smoke`, then the balance sim), ~02:48 on 2026-10-22, before the last three commits (fog/LOS/deploy block). Both said "All checks passed."

| Sim | Result |
|---|---|
| FIREWALL purge d1→d5 (AI vs AI, 20 each) | win 20 / 15 / 10 / 6 / 4 |
| FIREWALL relay d1→d5 (10 each) | win 10 / 6 / 3 / 3 / 0 |
| FIREWALL uplink d4 (50) | **win 3, loss 47** |
| FIREWALL campaign | victory day 61, conv 34.7% |
| Lattice campaigns (10) | 9 victories, 1 defeat, avg end day 77 |

Unverified: there is no record of whether smoke or balance ran again after `e4e2d5c`, `66c0a29` and `1122102`.

## Traps — read before re-investigating
- Auto-update showing "claude.exe in use": four Claude Code processes were open. 2.1.308 was already the latest npm release, so nothing was broken. To update, close the other sessions (VS Code included) and run `claude update`.
- A worktree checkout (autocrlf) fails smoke's changelog check. Ignore that one failure in old-vs-new balance runs (also in the firewall skill).

## What changed (2026-10-21/22 commits, newest first)
- `1122102` Lattice raids/uplink: your machines deploy in one dug-in 3x3 block (`blockSpots`)
- `66c0a29` LOS: two tall-cover tiles back to back always block; corner peeks still work
- `e4e2d5c` Fog of undiscovered ground; right-click move, left-drag pan; squad 3x3 deploy; drone eyes follow the cursor
- `6274f87` Range penalty: 0 adjacent → -30 at max range (was -3/tile past 10)
- `7b2b2d3` Mission maps 38x28 with camera; training stays 22x16; timers unchanged
- `c86c666` Raids: Lattice defenders dug in; Lattice weapon ranges 12/13
- `84d0c18` Lattice machines deploy at the FIREWALL squad's mark (Mk I-VI)
- `2bc78c2` Veteran squads face an extra Swarm Drone (`DATA.tuning.veteranDrone`)
- `68a72ec` Hunker all (H)
- `9707b25` Live patch notes: `CHANGELOG.md` → `js/changelog.js` via `tools/build-changelog.js`
- Earlier on 10-21: comms chatter and mood, world pixel map, cover cones and shields, five map layouts with pits, combat-training coaching, restart mission, AP pips. See `git log --since=2026-10-21`.

## Current state
- Live at https://npc6388.github.io/firewall/ (pushed).
- `PLAN.md` Sprint 6: **Bigger maps ✅**. Still open: ammo/reload, elevation, destructible walls/barrels, the Shepherd/Mirror/Swarm Queen enemies, and four new mission types.

## Next step / Pick up here
1. Re-run smoke and the balance sim on the current HEAD, because the last three commits have never been sim-checked (commands are in `README.md`).
2. Check uplink d4. FIREWALL won 3 of 50, which may be too hard. Look again after the 3x3 deploy-block change.
3. **USER-ONLY:** playtest the 38x28 maps and judge whether mission timers need lengthening (the PLAN says to leave them until playtested).
4. Next Sprint 6 item from `PLAN.md`.
