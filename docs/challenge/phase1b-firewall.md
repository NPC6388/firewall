# Challenge Phase 1b: FIREWALL campaign (2026-10-23)

Scope: the FIREWALL side of CHALLENGE.md Phase 1 (A3, E sinks and creep, C escalation rows, F expiry cost). The Lattice
campaign (lattice.js, lattice-ui.js, DATA.lattice) was not touched; a parallel branch covers it.

## What changed
- **A3 pods wake together** (`alert()` in tactical.js, exported as `Tac.wake`): an alerted unit wakes every member of its
  pod (`u.pod`) wherever they stand, plus any other Lattice unit within `tuning.alertRadius` (11, was a hard-coded 7).
- **C escalation rows:** `Strat.difficulty` counts the rows of `tuning.difficultyDays` [1, 19, 37, 55, 73, 91, 109]
  reached (same steps as before up to 5, then 6 on day 91 and 7 on day 109). `COMPOSITION` rows 6 (7 units, 2 Harmonics
  leading pods) and 7 (8 units, 3 Harmonic-led pods). Enemy aim uses `min(5, diff)`: steps past 5 add bodies, never stats.
  The mission card's threat bar no longer throws past 5 (shows 6/7 filled bars).
- **E salvage sinks:**
  - Restock: `Tac.result` units carry `spent: {grenade, medkit}`; `resolveMission` charges `tuning.restock` (grenade 5,
    medkit 2) after rewards, capped at the salvage you have (`out.restock`, `out.used`, a log line, a results-screen line).
  - Sentinel repair: machines repair at `tuning.repairSalvage` (2) salvage per HP; no salvage, no repair (Barracks shows
    "Repair stalled: no salvage").
  - Sentinel chassis `costStep` {credits 20, salvage 20} per chassis already made (`fabCost`).
  - Firewall Protocols (25 salvage) and Uplink Triangulation (30 salvage) need salvage to start (existing `t.salvage`).
- **E soldiers:** `Strat.hireCost(g)` = hireCost 30 + hireStep 10 x `g.hired`, max hireMax 75; `g.hired` drops by
  hireRecover (2) on each funding day. `tuning.rosterCap` 8 (people + Sentinels) blocks hiring and new chassis
  (`Strat.canHire`, `Strat.rosterFull`). Barracks shows the live price and "Roster n/8".
- **E tech creep:** `Strat.techCost(g, id)` = base x (1 + 0.08 x techs done, not counting itself). Used by `daysLeft`,
  completion in `advanceDay`, the research cards ("87 RP (base 70)") and the progress bar. Done cards show the base cost.
- **F expiry:** `tuning.expirePenalty.credits` (15) is taken at once when a mission expires (never below 0), via
  `Strat.expireCost(m)`; each mission card shows "Ignoring this costs: <region> infection +10%, Convergence +2%, §15 funding."
- Give-backs to land in the band: researchBase 10 -> 12, fundingPerRegion 32 -> 38, missionLife [4,6] -> [5,7],
  convBase 0.25 -> 0.24.
- Tests: smoke unit block "Challenge phase 1b" (pod wake, difficulty rows, composition/aim, creep, hire cost/cap/hireMax,
  Sentinel cap and cost step, repair cost / stall, restock, expiry credits and the zero floor). `tests/smoke.js` campaign
  lines now print end salvage/credits/roster; `CAMP_SEED=n` shifts campaign seeds for parallel runs.
  Browser: `tests/browser/economy.mjs` (shots eco-mission, eco-research, eco-barracks, eco-results; page errors none).

## Balance (bot FIREWALL campaigns, `smoke.js 1 10 1 1` x16 with CAMP_SEED 0..150, same seeds)
| Config | Campaigns | Bot wins | Avg end day | Win day | End salvage | End credits | KIA |
|---|---|---|---|---|---|---|---|
| Before (main 2e0f557) | 160 | 48.8% | 80 | 58 | 308 | 35 | 9.3 |
| All new rules, old economy (v1) | 80 | 12.5% | 101 | 85 | 188 | 15 | 8.4 |
| **Final (shipped)** | 160 | **46.3%** | 89 | 75 | **187** | 19 | 9.8 |

Ablations (40 campaigns each, everything new off except one; "off" = 47.5%): pod wake 47.5%, tech creep 30%, hire
cost + cap 27.5%, expiry credits 42.5%, escalation rows 47.5% (the bot rarely lives past day 91), salvage sinks 47.5%
(end salvage 314 -> 224). The rising hire cost and the tech creep are the big levers; they compound into a spiral
(fewer bodies -> missions expire -> funding hit -> fewer hires). `hireRecover` 2 and +funding broke the spiral; research
rate past 12 stopped helping (c2: 13 RP gave 43.8%).
FIREWALL battles (600, non-uplink, A3 only): 46.3% -> 45.0% bot wins (noise level; the audit estimated ~3 pp).

## Levers (all in DATA.tuning)
hireStep / hireMax / hireRecover, techCreep, fundingPerRegion, researchBase, missionLife, convBase,
expirePenalty.credits, restock, repairSalvage, alertRadius, difficultyDays (and COMPOSITION rows 6-7 in tactical.js).

## Not done / open
- End salvage is 187, not under ~150: the bot rarely uses grenades and builds one Sentinel. A human who fabricates
  more and throws more will spend more. Raise `restock.grenade` or tech salvage costs if piles persist in play.
- Escalation rows 6-7 are barely exercised by bot campaigns (most end before day 91); no direct d6/d7 battle rates.
- No visible threat clock / voice lines per step (Phase 2 C). No "two missions at once" (F).
- Comms/debates do not mention the new costs yet (e.g. the salvage_pile debate still assumes no sinks).
