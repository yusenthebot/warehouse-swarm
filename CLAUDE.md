# warehouse-swarm — autonomous build loop

A from-scratch warehouse robot swarm simulator, built autonomously round-by-round under
the LoopKeeper loop. This file is the project's loop contract; the full protocol lives in
`~/.claude/CLAUDE.md`. Cold-start every round from STATUS.md + progress.md + git.

## GOAL (acceptance — the only thing that counts as "done")
Launch the sim and watch **20 robots fulfill 500 orders with zero collisions**; the live
dashboard shows throughput / utilization / collisions; adding robots online makes it adapt.
Acceptance is the **real sim**, verified by eyes-on-screen + data — never unit tests alone.

## Per-round cycle
ORIENT (cold-read disk) → PLAN (write a substantial round, bigger than last) → EXECUTE
(test-first) → REAL-VERIFY → RECORD (commit + overwrite STATUS.md + progress.md). Bundle
several related capabilities per round; don't slice into micro-rounds.

## VERIFY — run all three, every round
1. `npm test` — unit/logic (necessary, never sufficient).
2. `node tools/run-headless.mjs <robots> <ticks> <rate> <seed>` — data truth: delivered, collisions, stall.
3. `bash tools/shot.sh .shot/x.png` then **Read the PNG** — confirm it visually.
Never fake verification (no staged numbers, no "tests pass so it works").

## Gates — pause and present an executive summary; do NOT cross autonomously
- Adding any **runtime dependency** (the project is intentionally zero-dep: vanilla JS + canvas + node:test). A new dep is a CEO gate.
- A **major architecture pivot** (e.g. swapping to a game engine / framework / language).
- Anything **irreversible or outward-facing** (publishing, deploying).
Routine impl, tuning, new modules, tests, sim mechanics → just do it.

## Invariants
- Zero runtime deps. Small files (<400 lines). Pure logic modules importable by both browser and node:test.
- Deterministic sim given a seed (so tests + headless runs reproduce). No `Math.random` in sim — use `src/rng.js`.
- `collisions` must stay 0; it is a regression tripwire, not a tunable.
