# Downed, not dead, 2026-10-23

User, after playing: "we can't have a game where a 'good' result is being able to afford losing 4/5 of your troops per
mission ... replacing 4 captains with 4 recruits is not viable". They chose "Downed, not dead": fights stay dangerous,
but a good win should cost about 0-1 units for good.

## The rule (campaign battles, the person's side only)
- At 0 HP a unit of `b.human` (a squad soldier `u.sid` or a deployed Lattice machine `u.deployed`; not statics, not
  overridden machines, never in training) goes **down** instead of dying: `alive = false, downed = true, bleed = 3`.
  It stays on its tile (`Tac.downedAt`, `free()` refuses the tile), cannot act, is no target, and does not count as
  standing (`checkOutcome` is unchanged: nobody standing = loss). The AI side still dies at 0 HP.
- **Bleed-out**: `bleedTick` at the end of each of its side's turns (`endPlayerTurn` for 'player', `startPlayerTurn` for
  'enemy'); at 0 it dies (`kill`, event `death` with `downed: true`).
- **Stabilize** (`act.stabilize`, `DATA.abilities.stabilize`): 1 AP, adjacent incl. diagonal. Every person-side unit has
  it (`Tac.hasAbility`), but the bar only lists it while it has a target (`Tac.abilityList`, also used for hotkeys). A
  medkit on a downed (non-machine) ally stabilizes it too (spends the charge, no HP). A stabilized unit stays down.
- **Blasts** (grenade, detonate, barrel) kill a downed unit outright. **Overkill**: a hit that leaves it at
  `-tuning.downed.overkill` (3) HP or lower kills outright.
- **Battle end** (`Tac.result`, `Tac.humanWon`): on a win every downed unit is `alive: true, downed: true` in the result.
  FIREWALL: `resolveMission` sets HP 1 and `s.critical = tuning.downed.days` (2): no healing while critical,
  `State.available` false, Barracks shows "Critical Nd" (machines "Wrecked"), debrief lists them (`out.saved`).
  Lattice: the machine stays in `g.forces` (`out.recovered`, debrief line "Disabled but recovered"). No repair delay:
  forces are plain counts per kind, a delay would need per-unit state in the picker and the bot. On a loss/abort/timeout
  loss the downed are lost as before.
- Tuning: `DATA.tuning.downed = { bleed: 3, overkill: 3, days: 2 }`.

## Smoke bot
`botStabilize(b, u)` in tests/smoke.js runs before each person-side unit acts in both campaign harnesses: stabilize an
adjacent bleeding ally, or walk to a tile next to one with a 1-AP move and stabilize it. With only the adjacent rule,
bleed-outs were almost every permanent loss in won battles (FIREWALL 15 of 16, Lattice 91 of 91 in 150 battles), which a
player would not allow, so the measurement needed the walk-over.

## Balance (bot campaigns; FIREWALL `smoke.js 1 20 1 1` x4-5 with CAMP_SEED 0..4000, Lattice `smoke.js 1 1 1 20` x5 with LAT_SEED 20000..24000)
New smoke lines: "FIREWALL campaign permanent losses ..." and "Lattice campaign permanent losses ..." (per fought mission,
per won battle, downed-and-saved per win).

| Variant | FW campaign wins | FW perm loss / fought | FW perm loss / won battle | Lat campaign wins | Lat perm loss / fought | Lat perm loss / won battle |
|---|---|---|---|---|---|---|
| Before (HEAD 7aca74d), n=100 | 36% | 1.08 | 0.78 | 60% | 2.22 | 1.46 |
| Downed, overkill off, minWin 24/12, n=80 | 54% | 0.52 | 0.08 | 74% | 1.75 | 0.28 |
| Downed, overkill 3, minWin 24/12, n=80 | 54% | 0.63 | 0.18 | 66% | 1.77 | 0.56 |
| Overkill 3, minWin 24/12, n=100 (Lattice only) | | | | 64% | 1.79 | 0.57 |
| Overkill 3, minWin 18/10, n=100 (**chosen**) | 54% (as above) | 0.63 | 0.18 | **59%** | 1.87 | 0.51 |
| Overkill 3, minWin 12/10, n=100 | | | | 46% | 2.01 | 0.55 |

FIREWALL bot battles won rose a little (wins hand back soldiers), and campaigns moved from 36% to 54%, inside the
45-60% target, so no FIREWALL economy lever changed. Per fought mission stays high-ish because lost battles still lose
the whole squad (the dread stays). Bot battle win rate per fought mission: FIREWALL 87% (both variants), Lattice 64-67%.

## Decisions
- **Overkill 3 on.** It keeps a sliver of permanent death in won fights (a crit or heavy hit on someone at 1-2 HP), so
  leaving the wounded exposed still matters; won-battle losses stay well under 1 (FW 0.18, Lattice 0.5).
- **Critical care 2 days.** A carried-out soldier is out about 2 + (maxHp - 1) days (8 for a fresh Trooper without an
  infirmary): a real cost, but the veteran and their XP survive.
- **No Lattice repair delay** (see above).
- **minWin 18 compute / 10 substrate** (was 24/12, raised the same day because rebuilding was unaffordable). With
  machines recovered on a win, 24/12 put bot Lattice campaigns at 64-66%; 18/10 gives 59%, back to the pre-change 60%.
  12/10 overshoots to 46%.
