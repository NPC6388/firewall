# FIREWALL — Challenge Phase 1, downed-not-dead, window LOS — session log
**Date:** 2026-10-23 → 2026-10-24  ·  **Continues:** `SESSION-LOG-2026-10-23-cover-scenarios-challenge.md`

## Presenting problem
"read the challenge doc, love it. begin in phases, leave the next game stuff for later." Then play feedback:
- windows: "passable, but they cease being half cover because you destroy them on your way through";
- Lattice extermination: "the combination of aim deficit and being stunned is terrifying";
- "if i have to build fresh units everytime, i would need more resources";
- "we can't have a game where a 'good' result is being able to afford losing 4/5 of your troops per mission";
- a stats tab in the Archive (raids won/lost, enemies killed, troops lost...);
- window LOS screenshots (`screencaps for testing\more los info*.png`): a corner drone must not see the unit below the building corner.

## Verdict / Outcome
**CHALLENGE Phase 1 is complete on `main`, plus downed-not-dead and a window-lean LOS fix. All pushed (last c157a9f); smoke "All checks passed." Phase 2 and the Archive stats tab are not started.**

## Evidence
- Phase 1 FIREWALL side (docs/challenge/phase1b-firewall.md): bot campaigns 46.3%. Hire price and tech creep alone made a death spiral (12.5%); fixed with research 12/day, funding 38, mission life 5-7.
- Phase 1 Lattice side (docs/challenge/phase1b-lattice.md): bot 55.7%; skip-every-mission bot 82.5% → 0%.
- Stun lock: bot Hacker had no cooldown and rotated 2-turn stuns; now `BOT_HACK_GAP` 3 turns. User then won the extermination in 17 turns "with one damaged unit left".
- Payout: user chose "Bigger win payouts"; minWin 12/10 → 24/12 (bot 55% → 66%), later 18/10 with downed.
- Downed (docs/challenge/downed.md): permanent losses per won battle FIREWALL 0.78 → 0.18, Lattice 1.46 → 0.51; wins FIREWALL 54%, Lattice 59%.
- Window LOS: rebuilt room scored by `scratchpad` evaluator; the lean rule fixed the user's unit, row 1 and most of the south-window yard; first drawing (16 arrows) still passes.

## Traps — read before re-investigating
- The user's two LOS drawings CONFLICT on one point: drawing 1 wants a steeper-than-diagonal line out of a window from a unit diagonal to it (D1 → (-2,-1)); drawing 2 rejects the same geometry (drone → (-4,-5) etc.). Stand-margin 0.1 fixes drawing 2's upper wedge but breaks 6 drawing-1 arrows. Ask the user which wins before changing `LOS_MARGIN`.
- Plain half-plane on every lean broke "solid: a unit at the end leans round it" (peeking round a wall end must see across). The rule is limited to leans whose past-the-cover tile is a window.
- Worktree agents: CRLF checkouts, can't run node outside their worktree, CHANGELOG conflicts on merge (resolve by hand, rebuild changelog.js).
- Don't start a smoke run and then edit CHANGELOG: the changelog check fails that run.
- An Opus executor hit API 529 mid-task; SendMessage resumed it fine.

## What changed
- Merges: challenge-phase1 (A1 + G1), Phase 1b FIREWALL, Phase 1b Lattice.
- 0c73aab windows climb-through; a3abf49 bot hack gap; 7aca74d minWin; 3da0529 downed-not-dead; c157a9f window-lean LOS + `tests/browser/los-room.mjs`.
- CHALLENGE.md marks Phase 1 built. Skill `firewall` updated throughout.

## Current state
- `main` = `origin/main` = c157a9f. Agent worktrees removed; branches deleted.
- Untested by the user: Phase 1b economy, downed units, the new LOS rule, the strike reward choice in a real battle, step 6-7 FIREWALL enemies.

## Next step / Pick up here
1. **USER:** play; judge downed units, hire/tech costs, Lattice payouts and the window LOS.
2. **Ask the user** about the LOS remainder: (a) drawing 1 vs drawing 2 conflict on steep lines out of a window; (b) the X at (5,-2) behind the desk (low desks don't block sight now: should they?); (c) the yard through the south-wall window. Show `tests/browser/shots/los-room.png`; the user prefers pictures to ASCII grids.
3. Archive **Stats tab** for both campaigns (requested 2026-10-23): existing `g.stats` fields plus new counters (KIA, downed saved, per-mission-type, best unit, longest/shortest battle).
4. Battle hotkey that downloads the map + units JSON for LOS bug reports (offered to the user).
5. CHALLENGE Phase 2: doctrine forks B + G2, upkeep and Array heat, the threat clock.
6. Still open from memory: About tab with copyright npc6388.
