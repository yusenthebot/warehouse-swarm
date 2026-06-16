# progress — warehouse-swarm

GOAL (acceptance): launch the sim, watch 20 robots fulfill 500 orders with **zero collisions**;
live dashboard shows throughput / utilization / collisions; add robots online and see it adapt; robots recharge.

## State: round 2 done — GOAL acceptance passes on data; battery + charging + scenario harness + sparkline

### Works (verified)
- Grid warehouse + BFS pathfinding; order generation; nearest-idle-robot dispatch; pickup → dropoff fulfillment.
- **Collision-free movement** (fixed-point claim resolver) + **deadlock breaker**: generic stuck→yield AND decisive head-on-swap resolution (lower id wins, other yields at once — kills the livelock that stalled round 1's corner cases).
- **Battery + charging**: drains per move; below 0.45 a robot reserves a free charger, routes, docks, recharges (0.04/tick), never strands; staggered initial charge desyncs waves. Dispatch skips low/charging robots.
- **Scenario harness** `tools/scenario.mjs` — injects exactly N orders, runs to completion, reports makespan + asserts delivered==N, collisions==0, minBattery>0.
- Live dashboard: orders/queued/robots/collisions/**charging**/utilization/throughput/tick + **throughput sparkline**; robot **battery bars** + green **charging rings**; `+1/+5 robot`, speed, and `?robots=&rate=&speed=&seed=&warm=` URL params.
- 16 unit tests green.

### Verified acceptance (data + eyes)
- **GOAL scenario `node tools/scenario.mjs 500 20 7` → delivered 500, collisions 0, makespan 1228, minBattery 0.49, PASS.**
- 60 orders / 8 robots → delivered 60, 0 collisions, makespan 296.
- Screenshot read back: busy 20-robot swarm, battery bars, sparkline, 0 collisions (`.shot/round2.png`).

### Does NOT work yet / known gaps
- **No in-browser scenario completion**: the live sim streams orders (queue grows under high rate); the 500-order "complete then show DONE in N ticks" is only headless. GOAL says "watch 20 robots complete 500 orders" → wants an in-browser `?orders=500` mode with a completion banner + progress bar.
- Deadlock handling is robust on tested seeds but still heuristic (no formal lifelong-MAPF guarantee); a Review round should adversarially try to break it across many seeds.
- Charging is intermittent; screenshot didn't catch a docked robot (green ring) — verify visually in a Review round.
- README hero screenshot still shows round-1 look (no battery/sparkline).

### Next-round seed (round 3 — build + Review)
1. **In-browser scenario mode** `?orders=N`: inject exactly N, show progress N/total + a "DONE in T ticks, 0 collisions" banner. Screenshot it completing 500.
2. **Review round**: adversarial verification across many seeds (`scenario.mjs` over seeds 1..50, assert all pass) to try to force a collision/deadlock/strand; de-sloppify; refresh README hero screenshot + docs; then offer GitHub push (CEO gate).

## How to verify (REAL-VERIFY, the only acceptance that counts)
- `npm test` — unit (necessary, not sufficient).
- `node tools/scenario.mjs 500 20 7` — GOAL data acceptance (exit 0 = pass).
- `bash tools/shot.sh .shot/x.png 8000 8150 'robots=20&rate=1.6&warm=900'` then **Read the PNG** — eyes on screen.
