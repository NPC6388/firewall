# FIREWALL strategy audit (agent, 2026-10-23) — key facts
- 20 bot campaigns: 8 victories, 12 defeats, ~10 KIA/run (bot is bad at tactics; strategy numbers are a floor).
- Tech tree 11 techs / 870 RP; ~19 RP/day (2 labs + farm). Survivors finish whole tree day 44-63 (typ. 55). Fastest win:
  rush signal_analysis->lattice_grammar->halcyon->relay_analysis->triangulation (400 RP), win day 43 in 6/20.
  After ~day 55 no research decisions remain.
- 12 base slots, bot fills 8; power barely constrains (command 8, generator 5, base uses ~10). Facilities cheap, pay back fast.
- Credits: start 220, funding 32/region/month at 0% infection (max 192), min mission 15 x speed mult. Bank peaks 140-270.
- Salvage piles up: 400-570 at end in surviving runs; total sinks in game ~130 (techs 30, fab 70, farm 10, sentinel 20).
- Hire flat 30 credits, no upkeep, no roster cap; Sentinels 60cr+20 salvage.
- Convergence: 0.25 + 0.0025*sum infection /day, x0.7 with Firewall Protocols; infection +0.25/region/day. Idle -> 100% ~day 130.
- Difficulty = min(5, 1+floor((day-1)/18)) -> capped day 73; nothing escalates after. COMPOSITION 3 drones (d1) -> 6 units (d5),
  +2 aim/diff; veteranDrone at avg rank 3. Enemy never reacts to player choices.
- Dominant/no-brainers: everything gets researched (no exclusion); firewall tech (-30% conv) best in game; squad_size always;
  fabrication unlimited & stacking (EMP replaces frag = only trade-off); extra fab bays / farms weak; infirmary/signal array free.
- Guidance: descriptions state numbers, no advice. Tutorial stratTip: "keep a project running", "generator first". 117 comms lines
  but none explain trade-offs. Story beats point at the spine only.
## Proposals (ranked by agent)
1 exclusive tech branches (techs.excl, techState 'locked-out') S-M
2 Lattice counter-research vs your strongest tech (g.counter, makeEnemy variants) M
3 pressure meter: difficulty from player power (techs, fab, avg rank, sentinels) + visible "Lattice Threat" M
4 facility upkeep (credits/day) + adjacency on 3x4 grid M
5 salvage sinks (repairs, overclock charge, hire cost, cap) S
6 roster cap 8, rising hire cost, idle upkeep S
7 escalation past day 73 (difficulty 7-8, new COMPOSITION rows, harmonic leads after day 60) S
8 regional relays + dark events (Sprint 7) L
9 tech cost +8% per tech done S
10 per-soldier gear (fabrication per head) M/follow-up
Guidance: A HALCYON+scientist 'debate' comms event (scientist voice 'S'), conditional on state; B trade-off briefing card when
exclusive techs unlock; C Lattice reacts to your research ("YOU HARDENED YOUR HOUNDS..."); D "HALCYON suggests" line on research
tab keyed to state; E threat readout strip on Command with HALCYON line per step.
(Harness scripts lived in the session scratchpad and were not kept.)
