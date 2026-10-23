# Challenge Phase 1: results (challenge-phase1 branch, 2026-10-23)

Scope was cut to two items for budget: **A1** (the bot side uses abilities) and **G1** (overheard debates).
Everything else from CHALLENGE.md Phase 1 is **not done** (see the end).

## A1: the bot uses abilities
- `canAct` now lets the AI side act while `ai()` runs for it (`aiActing` flag in tactical.js), never in combat training.
- `sideSees(b, side, x, y)`: the person's side reads the fog map (`b.visible`); the AI side uses its own units' sight lines.
  `tileOk('grenade')` uses it, so a bot grenade needs a tile its own squad can see.
- `aiAbility()` in `ai()` (after the Harmonic's Spike): medkit on an adjacent ally down 3+ HP, Aegis shield on the most
  exposed ally (summed hit odds of seen hostiles >= 40, shield < 2), grenade at 2+ seen hostiles or a wounded one in cover
  (never with its own unit in the blast; EMP counts machines only), hack (stun) the biggest machine in range and in sight
  (chance >= 30%, target hp >= 4, not already stunned).
- Only the AI side uses it (`u.side !== b.human`), so the smoke harness's scripted FIREWALL abilities in FIREWALL battles are
  unchanged, and in the FIREWALL campaign nothing changes yet (Lattice units have no such abilities; that is A2).
- tactical-ui: heal particles and the +N floater only play when the person can see the tile (bot medkits in the fog).
- Smoke unit checks: bot grenade fires at two side-by-side hostiles; no grenade when its own side cannot see them (even
  with the fog map fully visible); no grenade that catches its own unit; medkit heals a neighbour down 4, kept for a 2-HP
  scratch; hacker stuns the Warden; Sentinel shields the most exposed ally; training: the bot side never acts.
- The barrel AI check (smoke "the AI shoots a barrel...") still passes: the shooter there is the person's side, which never
  takes the ability path.

## G1: overheard debates
- `DATA.comms.fw.debate` / `DATA.comms.lat.debate`: 8 each, `{ id, when(f), lines }`. `Comms.stateFacts(g)` builds the
  facts (campaign state plus the intel facts) and fills `{placeholders}`; `Comms.nextDebate(g)` picks one whose condition
  holds, marks `g.debates = { seen, last }`, once per campaign, `DEBATE_GAP` = 3 days apart. `Comms.strategy` plays the
  whole exchange instead of the usual line. Voice 'S' = Dr. Amara Okafor (amber card, label "DR. OKAFOR · R&D").
- FIREWALL: power_lab, faraday_coil, firewall_halcyon, workshop_timing, salvage_pile, hire_sentinel, signal_array, infirmary.
- Lattice: foundry_core, ghost_recursive, mask_spire, substrate_hoard, raid_ignored, strike_relief, choir_timing, detonate_shield.
- Smoke checks: 8 per side, voices, caps/SUBPROCESS prefix, no apostrophes; nothing plays when no condition holds; the
  salvage debate plays with the amount filled; no second debate inside 3 days; never twice; the Lattice hoard debate.
  Browser: tests/browser/comms.mjs shows the Okafor card (shot comms-debate.png).

## Balance (one measurement round, no tuning pass)
Same seeds before (commit 8472f5a) and after (A1). Bot win rate = the side's own bot wins.

| Measure | Before | After A1 | Change |
|---|---|---|---|
| FIREWALL bot, FIREWALL battles (600, excl. uplink) | 46.3% (208/449) | 46.3% (208/449) | 0 (A1 does not touch this campaign) |
| FIREWALL bot, uplink (150) | 17.3% | 17.3% | 0 |
| Lattice bot, Lattice battles (300, excl. uplink) | 62.9% (129/205) | 42.3% (88/208) | **-20.6 pp** |
| Lattice bot, holding the uplink (100) | 73% | 53% | -20 pp |
| FIREWALL campaigns (`30 4 30 40`, 4 runs) | 3 won / 1 lost | 3 / 1 | 0 (4 runs, noise) |
| Lattice campaigns (40 runs) | 37 won / 3 lost (92.5%) | 19 / 21 (47.5%) | **-45 pp** |

No tuning pass: the Lattice campaign landed inside the 45-60% target band on its own. The battle drop is about twice
the audit's estimate (-11 pp, measured before the straight-line sight change). Caution for the user's feel test: the
user called midgame Lattice raids well balanced on 2026-10-22, and raids now face grenades, medkits and Aegis shields.
If raids feel too hard, the cheapest levers are the AI thresholds in `aiAbility()` (shield exposure 40, hack chance 30)
or `markBonus`, not Trace. The skill's warning stands: these are bot numbers; judge by play.

## Not done (cut for budget)
- A3 pod wake radius 7 -> 11.
- F: Lattice ignore/loss penalties, strike reward choice, stronger Trace-100 Uplink squad, "Ignoring this costs" briefs.
- E: salvage and substrate sinks, Sentinel repair cost, grenade restock, tech/protocol cost creep.
- C: FIREWALL difficulty 6-7 rows (days 90/108, Harmonic-led pods), Lattice earthLevel floor floor((day-1)/20).
- Smoke SKIP mode for the "skip every mission" Lattice bot.
- A dedicated browser test of bot-ability animations: tests/browser/lattice.mjs plays Lattice battles with page errors
  none, but no test forces a bot grenade/medkit/hack/shield on screen and screenshots it.
