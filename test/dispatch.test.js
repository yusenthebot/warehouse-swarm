import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid.js';
import { assignOrders, manhattan } from '../src/dispatch.js';
import { Robot, TO_PICKUP } from '../src/robot.js';
import { Order } from '../src/orders.js';

test('nearest idle robot gets the order', () => {
  const g = new Grid(10, 1);
  const near = new Robot(0, 1, 0);
  const far = new Robot(1, 8, 0);
  const order = new Order(1, { x: 2, y: 0 }, { x: 9, y: 0 }, 0);
  const assigned = assignOrders(g, [near, far], [order]);
  assert.equal(assigned.length, 1);
  assert.equal(near.order, order, 'closest robot took it');
  assert.equal(near.state, TO_PICKUP);
  assert.equal(far.order, null, 'far robot stays idle');
});

test('more orders than robots: only as many as robots get assigned', () => {
  const g = new Grid(10, 1);
  const r = new Robot(0, 0, 0);
  const o1 = new Order(1, { x: 2, y: 0 }, { x: 9, y: 0 }, 0);
  const o2 = new Order(2, { x: 3, y: 0 }, { x: 9, y: 0 }, 0);
  const assigned = assignOrders(g, [r], [o1, o2]);
  assert.equal(assigned.length, 1);
});

test('manhattan distance', () => {
  assert.equal(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 }), 7);
});
