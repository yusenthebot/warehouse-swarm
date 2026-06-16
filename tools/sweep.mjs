// Adversarial sweep: run the GOAL scenario across many seeds and try to break it
// (force a stall / collision / stranded robot). Usage: node tools/sweep.mjs [seeds=40] [orders=500] [robots=20]
import { Sim } from '../src/sim.js';

const seeds = Number(process.argv[2] || 40);
const orders = Number(process.argv[3] || 500);
const robots = Number(process.argv[4] || 20);
const CAP = 200000;

let pass = 0, worstMakespan = 0, worstMinBattery = 1;
const fails = [];
for (let s = 1; s <= seeds; s++) {
  const sim = new Sim({ robots, seed: s, orderRate: 5, maxOrders: orders });
  let makespan = -1;
  for (let t = 0; t < CAP; t++) {
    sim.step();
    if (sim.metrics.ordersDone >= orders) { makespan = sim.tick; break; }
  }
  const st = sim.stats();
  const ok = st.ordersDone === orders && st.collisions === 0 && makespan > 0 && st.minBattery > 0;
  if (ok) {
    pass++;
    worstMakespan = Math.max(worstMakespan, makespan);
    worstMinBattery = Math.min(worstMinBattery, st.minBattery);
  } else {
    fails.push({ seed: s, delivered: st.ordersDone, collisions: st.collisions, makespan, minBattery: Number(st.minBattery.toFixed(3)) });
  }
}
console.log(JSON.stringify({
  seeds, orders, robots, pass, failed: fails.length,
  worstMakespan, worstMinBattery: Number(worstMinBattery.toFixed(3)), fails,
}, null, 2));
process.exit(fails.length ? 1 : 0);
