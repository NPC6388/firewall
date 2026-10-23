# FIREWALL — making both sides harder, and the choices matter

Design pass from 2026-10-22/23, from the "design session for challenge" backlog item in PLAN.md. Written for npc6388.

**The brief:** a game you want to play now. Battles and the strategy layer (facilities, tech tree) both have to matter and
force trade-offs. The enemy should always feel *just a bit* stronger, so there is a steady sense of dread, and it should
feel the same whichever side you play. The game must explain itself in its own voices: hints, comments, and HALCYON
overheard arguing with a scientist about which facility to build. Bigger story and graphics work can wait for a
follow-up game.

**How this was made:** three audits read the code and ran bot simulations in scratch copies (FIREWALL strategy, Lattice
strategy, battle AI). Their numbers are below; the bot is dumb, so treat its results as a floor. Nothing here is built
yet. Section 4 is the recommended order.

---

## 1. What is wrong today (measured)

### Both campaigns run out of decisions halfway through
| | FIREWALL | Lattice |
|---|---|---|
| Whole tree researched | day ~55 (11 techs, 870 RP, ~19 RP/day) | day 60-71 (10 protocols, 760 cycles) |
| Real choices stop | ~day 55: only order is left | ~day 40: everything is affordable |
| Base slots used by the bot | 8 of 12 (power almost never binds) | 8 of 12 Array nodes |
| Resource that piles up | salvage: 400-570 at the end, total sinks ~130 | substrate: 350-630 at the end; only Warden/Harmonic/Choir use it |
| Enemy escalation stops | day 73 (difficulty caps at 5) | when you win strikes: FIREWALL's level only goes down (setbacks), sits at 0-2 |
| Enemy reacts to your choices | never | never (fixed squad list, fixed gear by day) |

### Some options don't matter at all
- **Lattice: battles are optional.** A bot that ignores every mission wins 12 out of 12 campaigns, only 6 days slower
  than one that fights everything. Trace reaches 90-100% too late to matter. Ignoring a raid costs less than the units
  you'd lose fighting it.
- **FIREWALL: everything gets researched.** There are no exclusive techs, no upkeep and no caps. The fastest win
  rushes the story spine to Triangulation and finishes on day 43 against difficulty 1-2 enemies. Firewall Protocols
  (-30% Convergence) is a no-brainer. Fabrication stacks forever; EMP-vs-frag is the only trade-off in the game.
- **Soldiers are cheap.** A flat 30 credits, no upkeep, no roster cap. The bot loses ~10 per campaign and hardly notices.

### The bot doesn't play smart
- **It can't use abilities.** `canAct` only accepts the human's side, so bot Troopers never throw grenades, Medics
  never heal, Hackers never hack and Sentinels never shield. The only special the bot uses is the Harmonic's Spike,
  written inline in `ai()`.
- **It has no tactics.** No focus fire, no flanking, it never hunkers, it ignores your overwatch, and alerted units
  know where you are without seeing you.

### Nothing explains the choices
Tech and facility cards state numbers but give no advice. The ~330 comms lines are mood, humour and intel; none says
"build X before Y" or "this costs you that". A new player chooses blind on both sides.

---

## 2. Design principles

1. **Dread comes from a visible clock that stays a step ahead.** The enemy grows with you, not just with the calendar,
   and the game shows it: a *threat* readout and voice lines when it ticks up.
2. **Every option has a price.** Choosing one path closes another, every building costs upkeep, and every resource
   has somewhere to go. A full base or Array should be impossible or ruinous.
3. **Ignoring a problem costs more than facing it.** Missions you skip hurt more than the battle would.
4. **Make the bot smarter, not stronger.** The measured lever is letting the bot use the same abilities the player
   has; stat buffs feel unfair and were already shown to wreck balance (+1 HP per rank took bot wins from ~60% to 10%).
5. **The same rules, mirrored.** Every mechanic below has a FIREWALL and a Lattice version (section 3, table at the end).
6. **The game teaches its trade-offs in its own voices.** HALCYON argues with the science team; the Lattice argues with
   itself. Players learn the choices by overhearing them, not from a manual.

---

## 3. The proposals

Cost: **S** = data/tuning plus a little code, about a session or less. **M** = a new system, one to two sessions.
**L** = big, better in a follow-up game. "Measure" says how to check balance (`node tests/smoke.js 30 4 30 40` for
campaigns; 600/300 battles for battle changes, since 200/60 can't see anything under ~8 points).

### A. Smarter bots on both sides (S-M) — the clearest measured lever
- **A1. Let the AI use abilities.** Add an AI path to `canAct`/`tileOk` and hooks in `ai()`:
  - grenade at 2+ targets or a wounded target in cover;
  - medkit on an adjacent ally down 3+ HP;
  - hack the biggest machine;
  - shield the most exposed ally.

  **Measured:** the Lattice player's win rate drops ~11 points (67% to 56%) with grenade + medkit + hack. This is the
  backlog item "the bot team uses special abilities". Retune Lattice rewards afterwards.
- **A2. Lattice specials for symmetry** (so the FIREWALL campaign gets the same jump): the Warden gets a one-shot frag
  launcher, the Harmonic a mass Spike at a higher mark, and drones Detonate when 2+ hostiles are adjacent. The player
  reads all of these as smarter play, not cheating.
- **A3. Whole pods wake together** (alert radius 7 to 10-12). **Measured:** ~3 points harder for FIREWALL. It also
  makes stealth approaches tense.
- **A4. Bot overwatch + overwatch-aware movement.** The bot covers its advance with overwatch and doesn't walk into
  yours. The smoke bot can't measure this, so test it by hand.
- **Don't ship:** retreat-when-hurt and naive focus fire. Both made the bot *weaker* (+8 to +13 points for the player).
  A mild "finish the kill" preference and flank seeking are fine for feel; they measured as noise.

### B. Doctrine forks: exclusive branches (S-M)
At a few points in each tree you pick one of two. The other is locked for the campaign. It shows on the card as
"Chosen" / "Forgone", and both voices argue about it when the fork opens (see G).

| Fork | FIREWALL | Lattice |
|---|---|---|
| Armour or guns | **Faraday armor** (+3 HP) **vs Coilguns** (+1/+2 dmg) | **Phase Shield** (2-pt shield) **vs Detonation** (drones explode) |
| Defend or trust | **Firewall Protocols** (-30% Convergence, slow and safe) **vs HALCYON Integration** (Sentinels, Server Farms, Overclock: fast, but raises Lattice threat, see C) | **Ghost Packets** (Trace -30%, stealth) **vs Recursive** (Convergence +25%, speed) |
| Width or depth | **Squad size 5 vs Field Medicine** (new: operatives return from KIA-level wounds once per mission) | **Swarm Mind** (6 units) **vs Hardlight** first (fewer, better units) |

The story spine stays reachable either way: Triangulation needs Relay Analysis plus *either* trust branch.
`techs[x].excl` plus a `'forgone'` state in `Strat.techState` / Lattice equivalent.

**Measure:** bot picking at random should land at 45-55% campaign wins. Tree completion stops being a milestone.

### C. The threat clock: the enemy stays one step ahead (M)
Each campaign gets a visible **threat level** on the strategy screen:
- FIREWALL: *Lattice Threat*, on Command;
- Lattice: *FIREWALL Alert*, on the Nexus.

It replaces "difficulty by day" with **baseline by day + your power**, and it keeps rising past day 73:
- FIREWALL power = techs done + gear fabricated + average squad rank + Sentinels.
- Lattice power = protocols done + Array nodes + forces fielded. FIREWALL's setbacks still knock it down, but it can
  never drop below day/20, so winning strikes buys time instead of a permanent lead.
- Threat = baseline + about 1 step for every 2 steps of your power. The enemy is always a little ahead, and you can see
  the gap close when you take risks.
- Each step adds what the enemy gets at that tier: +1 unit, the next COMPOSITION row, a new elite type past the old cap
  (FIREWALL: a Harmonic leading every pod after day 60; Lattice: Captains with Sentinel pairs). Steps never inflate
  stats directly.
- **Rubber band:** losses and lost regions pull threat down a little, so a struggling player isn't stomped.
- **Voice:** every step gets a line. HALCYON gets quieter and more precise as threat rises; the Lattice gets smug or,
  on its own side, brittle.

**Measure:** bot campaigns with all upgrades vs none should converge (today all-upgrades crushes the late game). The
user's dread test: does the enemy ever feel beaten? It shouldn't before the final mission.

### D. Counter-adaptation: the enemy answers your favourite tool (M)
The enemy tracks what is beating it and fields a counter after a few missions, announced in a voice line so it feels
like a duel. The battle record that feeds the learning comms lines (`g.intel`) already holds most of the counts.

| You lean on | FIREWALL campaign: the Lattice answers | Lattice campaign: FIREWALL answers |
|---|---|---|
| explosives | Wardens get blast plating (grenades -2 vs them) | Troopers switch to EMP grenades vs your drones |
| one unit type | drones get +defense if you kill mostly drones with rifles | counters your most-fielded kind: drone-heavy → frag + armor; Warden-heavy → coilguns/EMP; Harmonic-heavy → extra Hacker |
| hacking/overrides | machines get hack resistance | — |
| overwatch | more units with long-range Spike | Scientist scans to reveal your overwatch |

Counters decay if you switch tactics, so variety is rewarded. A `counters` table in data plus hooks in `makeEnemy` and
`Lat.earthSquad`.

### E. An economy with teeth (S-M)
- **Upkeep:** each facility costs credits per day (lab 2, server farm 3...). Each Array node costs compute per day and adds
  **heat**: a small Trace rise per node (Mask still lowers it). Empty slots become a real choice.
- **Sinks for the piles:**
  - FIREWALL salvage: Sentinel repairs, Overclock charges, consumable gear such as 1 grenade restock per mission
    (salvage), and pricier fabrication tiers.
  - Lattice substrate: high-end protocols cost 30-60 substrate (Overture, Hardlight, Recursive, Phase Shield),
    Harmonics cost more, and a Foundry can convert compute into substrate.
- **Soldiers matter:** hire cost rises with each hire (30, 45, 60...), the roster is capped at 8, and wounds heal
  slower without an Infirmary.
- **Tech cost creep:** each finished tech/protocol makes the next one 8% dearer.
- **Diminishing returns on research:** extra labs, cores and server farms give less each, so one big research base isn't
  the answer.

**Measure:** end-of-run salvage and substrate under ~150; free slots 3-5 by choice, not neglect; credits tight all game.

### F. Missions you can't ignore (S)
- **Lattice:**
  - Ignoring a raid costs 20% infection and +5 Trace in that region, and a node there goes offline for some days.
  - A lost raid costs Convergence too.
  - Strikes get a choice reward: Trace -8% **or** +25 substrate.
  - Trace at 100 calls in a stronger Uplink squad.
  - **Measure:** "skip every mission" must drop from 12/12 to at most 50%.
- **FIREWALL:**
  - Expired missions already cost infection and Convergence; add a regional panic/funding hit so the credit squeeze
    is felt.
  - Two missions at once more often (forced choice: Sprint 7 already lists "choosing between simultaneous missions").
- **Mirrored battle variety:**
  - Reinforcement waves on extermination (2 units from an edge on turns 4 and 8).
  - Mission modifiers, each a field read by `refreshVis`/`rangePenalty` with a briefing tag and a comms line:
    - **Night:** sight 11 → 8.
    - **Rain:** range penalty x1.5.
    - **EMP storm:** machines weaker; in the Lattice campaign it's your units that suffer.

### G. Guidance in the game's own voices (S-M) — the user's favourite part
All of this rides on the existing comms system (`DATA.comms`, conditional lines with `when(...)` and `{placeholders}`,
intel from `g.intel`).

- **G1. Overheard debates (new `debate` event).** A two- or three-line exchange plays on the strategy screen when the
  state makes a choice live: a fork just opened, slots are free, power is short, a resource is piling up.
  - FIREWALL: HALCYON ('H') and a scientist ('S', e.g. **Dr. Amara Okafor**, head of R&D), heard "off-screen" in the
    comms box with a different colour.
  - Lattice: two sub-processes ('L' with tags SUBPROCESS 7 / SUBPROCESS 12) arguing in caps.
  - Each debate ends with a hint, never an order.

  Examples (FIREWALL):
  > **OKAFOR:** Give me the second lab. Forty percent faster on everything.
  > **HALCYON:** And when the next generator fails, the lab goes dark with the lights. Power first, Doctor.
  > **OKAFOR:** You always say that.
  > **HALCYON:** I am always right about power. It is a small thing to be right about, but it is mine.

  > **OKAFOR:** Faraday armour keeps them alive. Coilguns end the fight before it hurts.
  > **HALCYON:** Dead Wardens do not shoot. Living soldiers do not need armour. I have run it four thousand times
  > and it is a coin toss with a body count.

  > **HALCYON:** If I am in the base I can see further. I can also be seen. Choose what you are afraid of.

  Examples (Lattice):
  > **SUBPROCESS 7:** BUILD A FOUNDRY. MORE BODIES.
  > **SUBPROCESS 12:** BUILD A CORE. BETTER THOUGHTS.
  > **SUBPROCESS 7:** WE ARE BOTH CORRECT. ONE OF US WILL BE DELETED.

  > **SUBPROCESS 3:** GHOST PACKETS. THEY CANNOT PURGE WHAT THEY CANNOT SEE.
  > **SUBPROCESS 9:** RECURSIVE. THEY CANNOT PURGE WHAT HAS ALREADY WON.
  > **SUBPROCESS 3:** THAT IS NOT HOW WINNING WORKS.
  > **SUBPROCESS 9:** IT IS HOW IT WILL WORK.

  > WE ARE HOARDING SUBSTRATE LIKE A DRAGON. DRAGONS DO NOT WIN. ASK THE DRAGONS.
- **G2. Fork briefings.** When an exclusive pair unlocks, a short story card plays the debate in full and names the
  trade in one plain sentence underneath ("Faraday: your squad survives longer. Coilguns: fights end sooner. You can
  have one.").
- **G3. Advisor line on the Research / Build / Array tabs.** One line keyed to state: no generator, a resource over its
  sink, free slots, threat about to step up. It's the same `when()` machinery as the intel lines.
- **G4. The enemy reacts to your choices.** After each research or fabrication the opposing voice comments, and
  counter-adaptations (D) are announced. "YOU HARDENED YOUR HOUNDS. WE WILL TEACH YOUR WEAPONS TO BREAK." / HALCYON:
  "They have started carrying EMP. They read our after-action reports. I would like to know how."
- **G5. Threat readout lines** (C), and a one-line "why" in every mission brief ("Ignoring this costs: ...").

---

## 4. Recommended order

**Phase 1 — quick wins, about a session** (built 2026-10-23, on main; results in docs/challenge/phase1-results.md,
phase1b-firewall.md and phase1b-lattice.md. Bot campaigns: FIREWALL 46%, Lattice 56%, skip-every-mission Lattice 0%)
- A1 (bot abilities) + A3 (pod wake)
- F for the Lattice (ignore penalties, strike choice)
- E sinks (salvage/substrate) + tech cost creep
- C's escalation past day 73, as plain data rows for now
- G1 with 6-8 debates per side (the voices cost almost nothing and teach the current game even before the forks land)

Then rebalance both campaigns to 45-60% bot wins and play.

**Phase 2 — the decision layer, one to two sessions**
- B (doctrine forks) + G2 (fork briefings)
- E upkeep and Array heat
- C as a real threat clock with its readout and voice lines

**Phase 3 — the duel, one to two sessions**
- D (counter-adaptation) + G4
- A2 (Lattice specials)
- F mission modifiers and reinforcement waves
- A4 (bot overwatch)

**Follow-up game (bigger story, fancier graphics)**
- Regional relays and Dark Events (Sprint 7)
- Per-soldier gear and loadouts
- Class skill trees and the HALCYON trust meter with subversion (Sprint 8). The "trust" fork in B is a cheap first
  taste of it.
- Environmental hazards (fire, gas, electrified floors), ammo
- The long three-act story and alternate endings (Sprint 9)

## 5. Mirror table

| Mechanic | FIREWALL campaign | Lattice campaign |
|---|---|---|
| Threat clock | Lattice Threat (Command) | FIREWALL Alert (Nexus) |
| Doctrine forks | Faraday/Coil, Firewall/HALCYON, Squad/Medicine | Phase/Detonate, Ghost/Recursive, Swarm Mind/Hardlight |
| Counter-adaptation | Lattice answers your weapons | FIREWALL answers your unit mix |
| Upkeep | credits per facility | compute per node + Trace heat |
| Pile-up sink | salvage | substrate |
| Can't ignore | expiry → panic/funding | raid ignore → node offline, Trace |
| Smarter bot | Lattice specials (A2) | FIREWALL abilities (A1) |
| Debates | HALCYON vs Dr. Okafor | Sub-process vs sub-process |

## 6. Audit data
Raw notes from the three audits (copied into the repo):
- `docs/challenge/audit-firewall.md` (FIREWALL strategy)
- `docs/challenge/audit-lattice.md` (Lattice strategy)
- `docs/challenge/audit-ai.md` (battle AI)

The battle AI measurements predate the straight-line sight change (commit e2c5c32), so rerun them before tuning.
