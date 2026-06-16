import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, generateWarehouse, bfsPath, SHELF, FLOOR, isPassable } from '../src/grid.js';

test('warehouse generates shelves, chargers, dropoffs', () => {
  const g = generateWarehouse(30, 20);
  assert.ok(g.shelves.length > 10, 'has shelves');
  assert.ok(g.chargers.length > 2, 'has chargers');
  assert.ok(g.dropoffs.length > 2, 'has dropoffs');
});

test('bfs finds a path around a static obstacle', () => {
  const g = new Grid(5, 1);          // straight corridor
  const path = bfsPath(g, { x: 0, y: 0 }, { x: 4, y: 0 });
  assert.equal(path.length, 4);
  assert.deepEqual(path.at(-1), { x: 4, y: 0 });
});

test('bfs routes around a shelf wall', () => {
  const g = new Grid(3, 3);
  g.set(1, 0, SHELF); g.set(1, 1, SHELF);   // wall with a gap at (1,2)
  const path = bfsPath(g, { x: 0, y: 0 }, { x: 2, y: 0 });
  assert.ok(path, 'path exists through the gap');
  for (const p of path) assert.ok(isPassable(g.get(p.x, p.y)), 'never steps on a shelf');
});

test('bfs returns null when the goal is walled off', () => {
  const g = new Grid(3, 1);
  g.set(1, 0, SHELF);
  assert.equal(bfsPath(g, { x: 0, y: 0 }, { x: 2, y: 0 }), null);
});

test('passability rules', () => {
  assert.ok(isPassable(FLOOR));
  assert.ok(!isPassable(SHELF));
});
