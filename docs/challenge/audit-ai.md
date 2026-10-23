# Tactical AI audit (agent, 2026-10-23) — key facts (measured on pre-geometric-LOS code)
- ai(): patrol if unaware; alert() wakes sleepers within 7; loop: Spike (harmonic), node zone, bestBarrelShot, bestShot
  (shoot if score>=50 w/2AP, >=20 w/1AP), else bestTile/march; fallback shoots at long odds.
- No focus fire, no flanking (only -15 for being flanked), never hunkers/retreats, ignores enemy overwatch, alerted units
  omniscient (foesOf ignores visibility), pods uncoordinated.
- AI CANNOT use act.* abilities: canAct requires u.side===b.human; tileOk('grenade') reads human visibility. So bot FW
  troopers/medics/hackers never use grenade/medkit/hack; Lattice only has inline Spike. Smoke harness scripts grenade/hack/
  medkit for the FIREWALL bot in FIREWALL battles only (asymmetric test).
- Baseline (600 FW / 300 Lat battles): FW bot 39.1% in FW battles; Lattice bot 67.3% in Lattice battles. SE ~2pp / 2.7pp.
- Measured (enemy-side upgrades): focus fire strong FW +3.0 / Lat +8.4 (enemy WEAKER); mild +3.1/+5.0 (weaker);
  flank bonus ~0 (noise); retreat <40% HP much weaker (+7.7/+12.8) -> don't ship; wake radius 7->12: FW -2.8 (enemy stronger);
  bot trooper grenade Lat -8.3; bot medic Lat -6.0; bot hacker -1.0; all three specials Lat -10.8; overwatch use: unmeasurable
  by smoke bot. No runtime cost.
- Other levers: reinforcement waves (exterminate only, turns 4 & 8, S-M); mission modifiers night (SIGHT 11->8), rain
  (rangePenalty x1.5), EMP storm (S each); hazards L; ammo M (skip); wounded carry-over exists (regen 1/day, 2 infirmary).
## Ranked
1 AI uses abilities (canAct/tileOk AI flag + ai() hooks) S, ~-11pp for Lattice player; then retune
2 wake radius 10-12 / whole pod wakes S ~3pp
3 Lattice specials (Warden frag launcher, Harmonic mass spike, drone detonate at 2+ adjacent) M
4 mission modifiers S each
5 timed reinforcement wave (exterminate) S-M
6 bot overwatch + overwatch-aware scoring S (test by hand)
7 mild finish-kill priority (feel only) S; 8 flank bonus (feel only) S; 9 specials at higher marks M; 10 hazards/ammo L
Don't ship retreat. 200/60 smoke too noisy (<8pp); use 600/300. (Scratch copies were not kept.)
