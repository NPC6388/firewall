# Lattice strategy audit (agent, 2026-10-23) — key facts
- 12 bot campaigns: 10 wins / 2 losses (83%), wins day 63-81 (avg 73); losses = Trace 100 after forces collapsed.
- computeRate = 6 + 0.07*infection sum (16/day d10, 23 d50, 35-42 end); never scarce (bank 25-120).
- Substrate piles up: 120-230 by day 20, 350-630 at end; only Warden 6, Harmonic 12, Choir 10 use it.
- Protocols 10 / 760 cycles; researchRate 10*(1+0.4*cores); 4 done d21, 7 d41, all d60-71.
- Array: 8 nodes by d41-61, 4 of 12 slots empty; bandwidth 16/16; facility choice = order only.
- Convergence 0.6/day d10, 0.9 d50, jumps to 2.2-2.6 after Recursive/Overture/Choirs.
- Real choices stop ~day 40. Seeding (25 compute -> +8% region) pays back in ~45 days or never.
- SKIP tests (12 runs each): nothing 10/12 d73; skip strikes 12/12 d70 (trace end 63-87%); skip raids+breaches 11/12 d90;
  skip EVERY mission 12/12 d79 (trace 88-100%, uplink never triggered). => battles optional, Trace no threat.
- traceBase 0.8 + traceRamp 0.011*day; ignoring a raid = infection -10, trace +2 (cheaper than losing units).
- Dominant build: Foundry -> Core, Choir, Mask -> Recursive, Overture. No upkeep, no counter-pressure.
- earthLevel = floor((day-1)/18) + floor(trace/50) - setbacks, floor floor((day-1)/30), max 5. Setbacks only go up (each won
  strike); bot sits at level 0 till d21, 1 by d31, 2 by d61. Flags fixed by day (armor d40, coil d50/trace60, emp d60).
  earthSquad fixed list; FIREWALL never adapts; you outclass it from ~day 40 if you strike. Mission frequency fixed.
- Guidance: cards show flat desc + cost; ~125 comms lines, none advise.
## Proposals (ranked by agent)
1 substrate as real currency (high-end protocols cost 30-60, harvest/convert) S/M
2 exclusive protocol branches (stealth vs speed: Ghost vs Seed/Recursive; Detonation vs Phase Shield) M
3 mission pressure: raidIgnored infection -20 trace +5; skipping costs region/foundry offline; lost raid costs convergence S
4 dynamic pressure + counter-research: Lat.earthAdapt(g) counters your most-used unit kind; time floor so setbacks can't push
  level below day/20 M
5 Array upkeep (compute) and heat (Trace) per node S/M
6 regional pressure (FIREWALL heats a region; spend to hold) M-L follow-up
7 strikes cost something on failure; win choice Trace -8 or +25 substrate S
8 guidance comms 'argue' event (sub-process debates) S
9 diminishing convergence; last 20% needs Choirs/Overture S
10 uplink pressure when trace 100 S
Voice samples: "SUBPROCESS 7: BUILD A FOUNDRY. SUBPROCESS 12: BUILD A CORE. WE ARE BOTH CORRECT. ONE OF US WILL BE DELETED."
"THE NATIVES ARE COUNTING OUR PACKETS. SOMEONE SHOULD DELETE THEM FIRST. NOT IT. SOMEONE ELSE."
"WE ARE HOARDING SUBSTRATE LIKE A DRAGON. DRAGONS DO NOT WIN. ASK THE DRAGONS."
"THE PURGE WAS UNANSWERED. THIS WAS A CHOICE. WE ARE NOT ASKING WHO MADE IT."
(Harness scripts lived in the session scratchpad and were not kept.)
