# progress — warehouse-swarm

GOAL (acceptance): launch the sim, watch 20 robots fulfill 500 orders with **zero collisions**;
live dashboard shows throughput / utilization / collisions; add robots online and see it adapt; robots recharge.

## State: GOAL MET — verified in the real sim (data + eyes), robust across seeds

### The GOAL, demonstrated
- **In-browser**: `?orders=500&robots=20` runs the batch and freezes on a banner
  *"✓ 500 orders delivered in 1228 ticks · 0 collisions"* — screenshot read back, HUD shows 500 done / 0 collisions.
- **Headless data**: `node tools/scenario.mjs 500 20 7` → delivered 500, collisions 0, makespan 1228, minBattery 0.49 (deterministic — matches the browser exactly).
- **Adversarial**: `node tools/sweep.mjs 40 500 20` → 40/40 seeds pass; stress 30 robots × 800 orders → 15/15 pass, worst minBattery 0.397. No stall / collision / strand found.

### Works (all verified)
- Grid + BFS pathfinding; order generation (with `maxOrders` scenario cap); nearest-idle-robot dispatch.
- Collision-free movement (fixed-point claim resolver) + deadlock breaker (generic stuck→yield + decisive head-on-swap priority).
- Battery + charging: drain per move, reserve a charger below 45%, recharge, never strand; staggered to desync waves.
- Live dashboard: orders/queued/robots/collisions/charging/utilization/throughput/tick + throughput sparkline; battery bars; charging rings; online `+1/+5 robot`; speed; `?robots=&rate=&speed=&seed=&warm=&orders=` URL params; in-browser scenario DONE banner.
- 17 unit tests green (incl. multi-seed robustness regression). Zero runtime deps.

### Known limitations (acceptable — beyond the GOAL)
- Deadlock handling is heuristic (robust across all tested seeds, but no formal lifelong-MAPF proof). One-way lanes would raise the density ceiling.
- After a scenario completes the view freezes (by design); online-add adaptation is shown in endless mode (default).

### Status / next
- **GOAL reached and real-verified → loop stopped.** All 3 rounds pushed to public GitHub (`yusenthebot/warehouse-swarm`, de12b1b) with refreshed hero screenshot.
- Optional future polish (not required by the GOAL): one-way traffic lanes, SKU/inventory model, demand-aware idle parking.

## How to verify (REAL-VERIFY)
- `npm test` · `node tools/scenario.mjs 500 20 7` (exit 0 = GOAL pass) · `node tools/sweep.mjs 40 500 20`
- `bash tools/shot.sh .shot/done.png 8000 8150 'orders=500&robots=20&warm=4000'` then Read the PNG (DONE banner).
