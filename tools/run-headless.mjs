// Run the pure sim headless and print stats as JSON — data-side verification,
// independent of the browser. Usage: node tools/run-headless.mjs [robots] [ticks] [rate] [seed]
import { Sim } from '../src/sim.js';

const [robots = 20, ticks = 6000, rate = 1.4, seed = 7] = process.argv.slice(2).map(Number);
const sim = new Sim({ robots, seed, orderRate: rate });

let stuckTicks = 0, lastDone = 0;
for (let i = 0; i < ticks; i++) {
  sim.step();
  const d = sim.metrics.ordersDone;
  stuckTicks = d === lastDone ? stuckTicks + 1 : 0;
  lastDone = d;
}
const s = sim.stats();
console.log(JSON.stringify({
  robots: s.robots, ticks: s.tick,
  ordersCreated: s.ordersCreated, ordersDone: s.ordersDone,
  queued: s.queued, collisions: s.collisions,
  utilization: Number((s.utilization * 100).toFixed(1)),
  longestStallTicks: stuckTicks,
}, null, 2));
