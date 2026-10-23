# FIREWALL — cover, scenarios, outside maps, LOS rework, challenge design — session log
**Date:** 2026-10-22 → 2026-10-23 (overnight; the user went to bed partway through)  ·  **Continues:** `SESSION-LOG-2026-10-22-sprint6-maps.md`

## Presenting problem
The user asked for a long list, which grew mid-session:
- random spawns for both teams, rerolled on every restart;
- two raid scenarios, capture/defend the server and extermination;
- 5 new cover types;
- an "outside" map where the node is inside a building;
- a backlog idea: bots use special abilities.

Later additions:
- corner standoff (50% base for both sides);
- mixed-side cover;
- shootable objects, then only explosives aimable;
- Tab centres the camera;
- a 2-column hover panel;
- humour and learning in the comms;
- the YouTube pause;
- rewards scaled by battle speed;
- Lattice mark scaling;
- sealed rooms, then wide geometric sight lines through windows and doorways;
- a dark-ambient soundtrack.

Then, going to bed: "use up this session limit and up to 25% of the next session limit with suggestions for how to make the game more challenging when playing either side", including the strategic layer, "the enemy will always feel like they are just a bit more powerful", the same dread on both sides, and guidance such as "overhearing halcyon discussing the tradeoffs between two facilities with one of the scientists".

## Verdict / Outcome
**14 commits on `main`, all pushed (8472f5a then f209405); smoke passed at each push. The design doc is in `CHALLENGE.md`. A Phase 1 prototype (bot abilities and overheard debates) is on the LOCAL branch `challenge-phase1` (3 commits, not pushed, not merged), waiting for the user to play it.**

## Evidence
- **Lattice:** the user said midgame raids taking 5-15 turns, rarely without losses, feel balanced (2026-10-22). After the 5th FIREWALL soldier the Lattice's aim fell behind. The user chose marks +2 aim / +1 HP (data.js `markBonus`). Bot Lattice campaigns 35/40 after it.
- **YouTube pause:** fixed. The cause was the world-map SVG animations re-rasterising the whole map every frame (GPU process ~110% of a core, down to ~20% after the overlay, `Backdrop.mapFx`). The user confirmed the pause stopped. WebAudio was ruled out: no audio focus.
- **Outside maps / rooms:** a Node repro of the user's room found 3 leaks: doorway leans, diagonal jamb slips, and tall cover see-through at the line ends. Then the user drew the wanted sight lines (`screencaps for testing\los in a box.png`), and LOS became a straight-line test with `LOS_MARGIN` 0.25 (corner grazes pass, diagonal wall pairs seal). All 16 arrows pass both ways, except 4 steepest window arrows that geometry can't meet (nearest tile used). In-range visible pairs went from 48% to 59%; `los` is ~20% slower; smoke takes ~1m45s on this machine.
- **Challenge audits:** `docs/challenge/audit-*.md`.
  - The FIREWALL tree is done by about day 55.
  - Enemy escalation stops at day 73.
  - Salvage piles to 400-570 and substrate to 350-630.
  - A Lattice bot that skips every mission still wins 12/12.
  - The bot can't use abilities (`canAct` only accepts the human's side).
  - Naive focus fire and retreat make the bot WEAKER.
- **Phase 1 prototype (branch `challenge-phase1`, `docs/challenge/phase1-results.md` there):** with bot abilities, the Lattice bot wins 42.3% of Lattice battles, down from 62.9% (-20.6 pp, twice the audit's estimate). Lattice campaigns went from 92.5% to 47.5%. The FIREWALL campaign is untouched by A1.

## Traps — read before re-investigating
- **Line endings:** the Edit tool can turn a file into CRLF, and then patch scripts matching `\n` silently miss. `grep -c $'\r'` in Git Bash wrongly says 0, so check with `JSON.stringify` in node. Normalise with `sed -i 's/\r$//'` first.
- **Mojibake:** an agent's cp1252 read/write shipped `â€”` into the battle log (fixed in 960d282). Grep js/ for `â€|Â°|âˆ|â†` after scripted edits.
- **Parallel browser tests:** set `CDP_PORT=93xx` (drive.mjs, 3fee82b). Each port gets its own Edge profile.
- **Smoke harness asymmetry:** it scripts grenade/hack/medkit for the FIREWALL bot in FIREWALL battles only. Battle-balance comparisons need 600/300 battles.
- **Agent worktrees** live in `.claude/worktrees/` (gitignored since f209405). One vanished after a network drop, but the branch survived.
- **Earlier conclusions that were wrong:**
  - "Windows stay impassable when shattered": wrong. The user wants them walkable (824565b).
  - "Narrow ±18° lean cones through gaps": replaced by the geometric rule (e2c5c32).
  - "Doorway units don't lean": the doorway step-peek was added back (824565b), and the geometric rework kept it.

## What changed
Commits 368c5da → f209405 on `main` (see `git log 5a6cd84..f209405`). Highlights:
- **Cover and objects:** props system (barrel, barrier, pillar, glass, fence, windows, desks, racks), mixed-side faces, corner standoff, shootable explosives only, stray misses chip cover (`STRAY` 33).
- **Deployment:** random spawns via `deploy` / `redeploy`. A restart changes only spawns and patrols.
- **Scenarios:** node and extermination, the outside map, the duel hover table.
- **Comms and audio:** comms humour plus `g.intel`-backed lines; dark-ambient and darksynth music moods; the map animation overlay.
- **Rewards and scaling:** `Strat.speedMult` and the Lattice `minWin`; Lattice marks +2 aim.
- **Docs:** `CHALLENGE.md` and `docs/challenge/`.
- **Skill:** `~/.claude/skills/firewall/SKILL.md` updated throughout.
- **Memory:** music taste, the "Fanfuckingtastic" rating option, the npc6388 author name.

## Current state
- `main` = `origin/main` = f209405, tree clean. GitHub Pages serves it.
- Branch `challenge-phase1` (local only): 09a3b7b A1 bot abilities, 0602846 G1 debates (8 per side, Dr. Amara Okafor as voice 'S'), 848d9cf results. Worktree at `.claude/worktrees/challenge-phase1`.
- **Untested:** bot grenade/medkit/hack/shield animations were never screenshotted on screen. The FIREWALL campaign hasn't been replayed by the user since these changes.

## Next step / Pick up here
1. **USER:** play `challenge-phase1` (`git checkout challenge-phase1`, open index.html) and judge:
   - Do Lattice raids now feel too hard? Its dials are the `aiAbility()` thresholds.
   - Do the debates land?
   Then merge, tune or drop it.
2. **USER:** replay the FIREWALL side (pending since 2026-10-22). Check node captures against sealed rooms, and that windows are now walkable.
3. Continue `CHALLENGE.md` Phase 1: A3 pod wake radius, F Lattice mission penalties and the strike choice, E sinks and cost creep, C escalation past day 73, the smoke SKIP mode. Then Phase 2 (doctrine forks, upkeep, threat clock).
4. **Still open from memory:** the About tab after Patch notes, with copyright npc6388 (`firewall-about-section.md`).
5. Backlog notes: bot team specials (largely covered by A1 now; Lattice specials are A2).
