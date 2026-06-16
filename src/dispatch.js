// Task assignment: give each queued order to the nearest idle robot.
// Greedy nearest-first by Manhattan distance. Returns the orders that got assigned
// (each mutated robot now has .order/.path/.state set). Pure of DOM; sim wires paths.
import { bfsPath } from './grid.js';
import { TO_PICKUP } from './robot.js';

function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

export function assignOrders(grid, idleRobots, queuedOrders) {
  const assigned = [];
  const free = new Set(idleRobots);
  for (const order of queuedOrders) {
    if (!free.size) break;
    let best = null, bestD = Infinity;
    for (const r of free) {
      const d = manhattan(r, order.pickupCell);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (!best) continue;
    const path = bfsPath(grid, best, order.pickupCell);
    if (!path) continue;               // unreachable — leave it queued for next tick
    best.order = order;
    best.path = path;
    best.state = TO_PICKUP;
    order.status = 'assigned';
    free.delete(best);
    assigned.push(order);
  }
  return assigned;
}

export { manhattan };
