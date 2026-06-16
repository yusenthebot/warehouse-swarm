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

test('robots never run flat (charging keeps the fleet alive)', () => {
  const sim = new Sim({ robots: 14, seed: 3, orderRate: 1.2 });
  let everCharged = false;
  for (let i = 0; i < 12000; i++) {
    sim.step();
    for (const r of sim.robots) assert.ok(r.battery > 0, `robot ${r.id} still has charge at tick ${i}`);
    if (sim.stats().charging > 0) everCharged = true;
  }
  assert.ok(everCharged, 'at least one robot recharged during a long run');
});

test('scenario: a fixed batch of orders all get delivered, collision-free', () => {
  const sim = new Sim({ robots: 8, seed: 7, orderRate: 5, maxOrders: 60 });
  let makespan = -1;
  for (let t = 0; t < 100000 && makespan < 0; t++) {
    sim.step();
    if (sim.metrics.ordersDone >= 60) makespan = sim.tick;
  }
  assert.equal(sim.metrics.ordersDone, 60, 'all 60 delivered');
  assert.equal(sim.stats().collisions, 0, 'zero collisions');
  assert.ok(makespan > 0, 'completed within the cap');
});

test('order generator honours maxOrders', () => {
  const sim = new Sim({ robots: 6, seed: 2, orderRate: 5, maxOrders: 25 });
  for (let i = 0; i < 4000; i++) sim.step();
  assert.equal(sim.metrics.ordersCreated, 25, 'never creates more than the cap');
});

test('scenario is robust across seeds (no stall / collision / strand)', () => {
  for (let s = 1; s <= 6; s++) {
    const sim = new Sim({ robots: 16, seed: s, orderRate: 5, maxOrders: 200 });
    let makespan = -1;
    for (let t = 0; t < 100000 && makespan < 0; t++) {
      sim.step();
      if (sim.metrics.ordersDone >= 200) makespan = sim.tick;
    }
    assert.equal(sim.metrics.ordersDone, 200, `seed ${s}: all 200 delivered`);
    assert.equal(sim.stats().collisions, 0, `seed ${s}: zero collisions`);
    assert.ok(sim.stats().minBattery > 0, `seed ${s}: no robot stranded`);
  }
});
