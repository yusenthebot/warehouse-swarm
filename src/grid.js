// Warehouse grid: cell types, layout generation, and BFS pathfinding.
// Pure module — no DOM — so it runs in the browser and under node:test alike.

export const FLOOR = 0;
export const SHELF = 1;
export const CHARGER = 2;
export const DROPOFF = 3;
export const WALL = 4;

// Robots may stand on FLOOR / CHARGER / DROPOFF; SHELF and WALL block movement.
export function isPassable(type) {
  return type === FLOOR || type === CHARGER || type === DROPOFF;
}

export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height); // FLOOR by default
    this.shelves = [];
    this.chargers = [];
    this.dropoffs = [];
  }

  idx(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  get(x, y) { return this.cells[this.idx(x, y)]; }
  set(x, y, t) { this.cells[this.idx(x, y)] = t; }
  passable(x, y) { return this.inBounds(x, y) && isPassable(this.get(x, y)); }

  // Floor neighbours a robot can stand on next to a (possibly blocked) cell.
  passableNeighbors(x, y) {
    const out = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (this.passable(nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }
}

// Build a warehouse: outer walls, regular shelf blocks with aisles,
// a column of chargers on the left, a row of dropoff bays at the bottom.
export function generateWarehouse(width = 30, height = 20) {
  const g = new Grid(width, height);
  for (let x = 0; x < width; x++) { g.set(x, 0, WALL); g.set(x, height - 1, WALL); }
  for (let y = 0; y < height; y++) { g.set(0, y, WALL); g.set(width - 1, y, WALL); }

  // Shelf blocks: short 2-wide racks with wide walkable aisles between them.
  for (let y = 3; y < height - 3; y += 3) {
    for (let x = 4; x < width - 2; x += 1) {
      if ((x - 4) % 5 < 2) { g.set(x, y, SHELF); g.shelves.push({ x, y }); }
    }
  }
  // Chargers: left service column.
  for (let y = 2; y < height - 2; y += 2) { g.set(1, y, CHARGER); g.chargers.push({ x: 1, y }); }
  // Dropoff bays: bottom service row.
  for (let x = 3; x < width - 2; x += 3) { g.set(x, height - 2, DROPOFF); g.dropoffs.push({ x, y: height - 2 }); }
  return g;
}

// BFS shortest path over passable cells. Returns the list of steps AFTER start
// up to and including goal, or null if unreachable. 4-connected grid.
export function bfsPath(grid, start, goal) {
  if (!grid.passable(goal.x, goal.y)) return null;
  const sk = grid.idx(start.x, start.y);
  const gk = grid.idx(goal.x, goal.y);
  if (sk === gk) return [];
  const prev = new Int32Array(grid.width * grid.height).fill(-1);
  const seen = new Uint8Array(grid.width * grid.height);
  const queue = [start];
  seen[sk] = 1;
  while (queue.length) {
    const cur = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!grid.passable(nx, ny)) continue;
      const nk = grid.idx(nx, ny);
      if (seen[nk]) continue;
      seen[nk] = 1;
      prev[nk] = grid.idx(cur.x, cur.y);
      if (nk === gk) return reconstruct(grid, prev, sk, gk);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

function reconstruct(grid, prev, sk, gk) {
  const path = [];
  let k = gk;
  while (k !== sk) {
    path.push({ x: k % grid.width, y: Math.floor(k / grid.width) });
    k = prev[k];
  }
  return path.reverse();
}
