# Challenge Phase 1b: the Lattice campaign (F, E, C), 2026-10-23

Branch `worktree-agent-acc85f4dfa1eeaf68` (from main 2e0f557, after A1 + G1). Scope: `lattice.js`, `lattice-ui.js`,
`DATA.lattice` in `data.js`, three Lattice debate lines, two Lattice glossary terms in `help.js`, smoke harness and checks.
The FIREWALL-campaign side of Phase 1 was done in parallel elsewhere; nothing in strategy.js, ui.js or tactical.js changed.

## What changed
**Smoke harness**
- `LAT_SKIP=all|raids|strikes` (env): the Lattice campaign bot skips every mission (except the Uplink), only raids and
  breaches, or only strikes. `LAT_SEED=<n>` (env) shifts the campaign seeds so parallel runs are independent.
- The bot picks the strike reward: Trace cut when Trace >= 50 or substrate >= 60, else the substrate.
- Campaign lines now also print end substrate, the day Overture finished and the Uplink record (H held / L lost).

**F: missions you cannot ignore** (`DATA.lattice.tuning`)
- `raidIgnored { infection: 20, trace: 5, offlineDays: 4 }`: an unanswered raid purges the region, feeds Trace and knocks one
  finished Array node (never the Nexus) offline for 4 days (`b.offline`, `Lat.knockOffline`; `built()` skips offline nodes,
  so a Core/Foundry/Choir/Mask/Spire loses its bonus). The Array shows "Offline (FIREWALL purge): Nd".
- `raidLost { infection: 15, trace: 4, convergence: 3 }`: a lost raid also costs 3% Convergence.
- `strikeChoice { trace: 8, substrate: 25 }`: a won strike still gives a setback, then `g.pendingReward` waits for
  `Lat.claimStrike(g, 'trace' | 'substrate')`. The result screen shows two buttons (`#lres-trace`, `#lres-sub`) instead of
  `#lres-ok`; an unclaimed reward shows a panel on the Network (`l-claim` action) and `advanceDay` defaults it to the Trace
  cut. Strikes no longer pay a base 15 substrate (only `minWin`).
- `strikeIgnored { trace: 4 }`: added after measuring that skipping only strikes beat fighting them (62% vs 55%).
- Trace 100 Uplink: `uplinkExtra: ['trooper']`, `uplinkRank: 1`. The squad is 7 strong and fights one rank above
  `earthLevel`; `earthSquad` returns `rank` (squad XP) separately from `level` (your machines' mark), so the gap is real.
- `Lat.ignoreText(m)`: raid and strike cards and the squad picker show "Ignoring this costs: ...". Raid briefs also state
  what losing costs.

**E: substrate sinks and cost creep**
- Protocol substrate (paid once on first start, `g.research.paid`): Hard-Light 30, Phase Shielding 30, Recursive 40,
  Overture 60. Harmonic 16 substrate (was 12). No Foundry conversion (substrate is no longer the pile it was; see table).
- `protoCreep: 0.08`: `Lat.protoCost(g, id)` = base x (1 + 0.08 x protocols done). Cards show the real cycles, the substrate,
  days left, and a disabled button with "Need N substrate".

**C: FIREWALL level floor**
- `earthFloorDays: 20`: `earthLevel` never drops below floor((day-1)/20) (was /30), still capped at 5.

**Rebalance levers used** (reward side, battles untouched): `researchBase` 10 -> 15, `convBase` 0.22 -> 0.27,
`minWin` { compute 10 -> 12, substrate 6 -> 10 }.

## Balance (bot Lattice campaigns, `smoke.js 1 1 1 N` in parallel plain copies)
| Measure | Before (main 2e0f557) | After |
|---|---|---|
| Fight everything | 47.5% (19/40, seeds 9000+) | **55.7%** (39/70: 51.4% seeds 9000+, 60.0% seeds 50000+); 52.5% (21/40) on the before-seeds |
| Skip every mission (LAT_SKIP=all) | 82.5% (33/40) | **0%** (0/30; dies at the Trace-100 Uplink, avg day 56) |
| Skip raids + breaches | not measured | 0% (0/20) |
| Skip strikes only | not measured | 46.7% (14/30) |
| End substrate, fight everything | avg 164, max 558 | avg 67-81, max 290-376 (winners still bank ~300) |
| End Trace, fight everything | avg 79 | avg 66-67 |
| Avg end day | 75 | 69-70 |

The audit's "skip every mission wins 12/12" was measured before A1; on main it was already 82.5%.

### What moved what (all-on minus one, 20 campaigns each, before the rebalance)
- All new rules at the old tuning: 0/40 normal, 0/40 skip.
- Protocol cost creep alone took bot campaigns from ~45% to 0%: it lands on Recursive and Overture, the win condition.
  `researchBase` 15 was the main counterweight (13 -> 10%, 15 -> 35%, 18 -> 50%, all with creep).
- Substrate costs starved the bot (end substrate ~3, few Harmonics); `minWin.substrate` 10 + Harmonic 16 + Phase Shield 30
  put it back (40% -> 55%).
- `minWin.compute` is a strong fine dial: 10 -> 47%, 12 -> 56%, 15 -> 65%.
- Earth floor /20, raid-loss Convergence and the bigger Uplink each cost a few points; none alone explained the 0%.

## Not done / open
- Foundry compute -> substrate conversion: skipped (substrate is now scarce for losing campaigns).
- Winning campaigns still finish with ~300 substrate: the snowball case. A later sink (Choir upkeep, Array heat) fits Phase 2.
- Bot campaigns are bimodal (snowball or collapse); losses are mostly the Uplink, often undefended after the forces collapse.
- The person's feel: raids are unchanged in battle, but ignoring one now hurts and a lost one costs Convergence. The Uplink
  at Trace 100 is noticeably harder (7 units, a rank up). Judge by play.
- `tests/browser/lattice-strike.mjs` covers the new screens (shots ls-1..ls-6); the strike choice was not driven through a
  real battle in the browser, only by calling `resolveMission` + `LUI.results`.
