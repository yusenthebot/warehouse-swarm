# progress — warehouse-swarm

GOAL (acceptance): launch the sim, watch 20 robots fulfill 500 orders with **zero collisions**;
live dashboard shows throughput / utilization / collisions; add robots online and see it adapt.

## State: round 1 done — runnable, verified baseline

### Works (verified)
- Grid warehouse (shelves / chargers / dropoffs), BFS pathfinding around static obstacles.
- Order generation, nearest-idle-robot dispatch, pickup → dropoff fulfillment.
- **Collision-free movement** (fixed-point claim resolver) + **deadlock breaker** (stuck → yield aside + reroute, staggered by id). Idle robots return home to clear lanes.
- Live canvas render + HUD (orders done, queued, robots, collisions, utilization, throughput, tick), `+1/+5 robot` and speed controls.
- 13 node:test unit tests green. Headless data run: **20 robots / 8000 ticks → 1846 delivered, 0 collisions, max stall 4 ticks**. 12 robots / 3000 ticks → 610 delivered, 0 collisions.
- REAL-VERIFY: `tools/shot.sh` screenshot read back — robots routing, carrying loads, delivering; HUD live. See git.

### Does NOT work yet / known gaps
- **No battery/charging behaviour** — `robot.battery` field exists but unused; chargers are just parking spots.
- Deadlock breaker is a **heuristic** (yield), not principled lifelong-MAPF; very high density could still thrash. No one-way lanes / traffic rules.
- `orderRate 1.4` floods the queue (backlog grows) — capacity is proven but there's **no "scenario" mode** that injects exactly 500 orders and reports makespan + final collisions as the literal acceptance.
- Dashboard shows instantaneous throughput only — **no throughput-over-time chart**.
- Idle-return-home is naive (always to spawn charger), not demand-aware.
- No regression test asserting the deadlock breaker keeps `longestStall` bounded.

### Next-round seed (round 2)
1. **Scenario acceptance harness**: `node tools/run-headless.mjs --orders 500 --robots 20` injects exactly 500 orders, runs to completion, prints `{delivered:500, collisions:0, makespanTicks}`. Make this THE acceptance check + a unit test.
2. **Battery + charging**: battery drains per move; below threshold the robot reserves a free charger, routes there, recharges; never strands mid-aisle. Show battery in render + a "charging" count in HUD.
3. **Throughput-over-time sparkline** in the dashboard.
Then a Review round (adversarial: try to force a collision / deadlock / stranded robot in the real sim + screenshot).

## How to verify (REAL-VERIFY, the only acceptance that counts)
- `npm test` — unit (necessary, not sufficient).
- `node tools/run-headless.mjs 20 8000 1.4 7` — data truth (delivered, collisions, stall).
- `bash tools/shot.sh .shot/x.png` then **Read the PNG** — eyes on screen.
