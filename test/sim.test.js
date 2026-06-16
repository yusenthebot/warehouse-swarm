import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/sim.js';
import { isPassable } from '../src/grid.js';

test('sim fulfills orders over time', () => {
  const sim = new Sim({ robots: 12, seed: 7, orderRate: 0.9 });
  for (let i = 0; i < 3000; i++) sim.step();
  const s = sim.stats();
  assert.ok(s.ordersDone > 50, `delivered a meaningful number of orders (got ${s.ordersDone})`);
});

test('robots never occupy a blocked cell', () => {
  const sim = new Sim({ robots: 14, seed: 3, orderRate: 1.0 });
  for (let i = 0; i < 1500; i++) {
    sim.step();
    for (const r of sim.robots) {
      assert.ok(isPassable(sim.grid.get(r.x, r.y)), `robot ${r.id} on a passable cell at tick ${i}`);
    }
  }
});

test('claim-based movement stays collision-free', () => {
  const sim = new Sim({ robots: 16, seed: 5, orderRate: 1.2 });
  for (let i = 0; i < 2000; i++) sim.step();
  assert.equal(sim.stats().collisions, 0, 'zero same-cell collisions');
});

test('runs are deterministic for a fixed seed', () => {
  const a = new Sim({ robots: 10, seed: 42, orderRate: 0.8 });
  const b = new Sim({ robots: 10, seed: 42, orderRate: 0.8 });
  for (let i = 0; i < 800; i++) { a.step(); b.step(); }
  assert.deepEqual(a.stats(), b.stats());
});

test('online-added robots also deliver', () => {
  const sim = new Sim({ robots: 4, seed: 9, orderRate: 1.0 });
  for (let i = 0; i < 400; i++) sim.step();
  for (let i = 0; i < 8; i++) sim.addRobot();
  assert.equal(sim.stats().robots, 12);
  const before = sim.stats().ordersDone;
  for (let i = 0; i < 1500; i++) sim.step();
  assert.ok(sim.stats().ordersDone > before, 'throughput continues after scaling up');
});
