// Acceptance scenario: inject exactly N orders, run to completion, report makespan.
// This is the literal GOAL check ("20 robots complete 500 orders, zero collisions").
// Usage: node tools/scenario.mjs [orders=500] [robots=20] [seed=7] [rate=5] [cap=200000]
// Exits non-zero if not all delivered, any collision, or a robot ran flat.
import { Sim } from '../src/sim.js';

const [orders = 500, robots = 20, seed = 7, rate = 5, cap = 200000] = process.argv.slice(2).map(Number);
const sim = new Sim({ robots, seed, orderRate: rate, maxOrders: orders });

let makespan = -1;
for (let t = 0; t < cap; t++) {
  sim.step();
  if (sim.metrics.ordersDone >= orders) { makespan = sim.tick; break; }
}
const s = sim.stats();
const pass = s.ordersDone === orders && s.collisions === 0 && makespan > 0 && s.minBattery > 0;
console.log(JSON.stringify({
  orders, robots,
  delivered: s.ordersDone,
  collisions: s.collisions,
  makespanTicks: makespan,
  ordersPerKtick: makespan > 0 ? Number((1000 * orders / makespan).toFixed(1)) : 0,
  minBattery: Number(s.minBattery.toFixed(3)),
  pass,
}, null, 2));
process.exit(pass ? 0 : 1);
