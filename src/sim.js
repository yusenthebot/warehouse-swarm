// The simulated world. One step() = one discrete tick:
//   generate orders -> assign idle robots -> move (collision-free) -> handle arrivals.
// Deterministic given a seed, so node tests and headless runs reproduce exactly.
import { generateWarehouse, bfsPath } from './grid.js';
import { makeRng } from './rng.js';
import { OrderGenerator } from './orders.js';
import { assignOrders } from './dispatch.js';
import { Robot, IDLE, TO_PICKUP, TO_DROPOFF } from './robot.js';

const key = (x, y) => x * 100000 + y;

export class Sim {
  constructor({ width = 30, height = 20, robots = 12, seed = 1, orderRate = 0.8 } = {}) {
    this.grid = generateWarehouse(width, height);
    this.rng = makeRng(seed);
    this.gen = new OrderGenerator(this.grid, this.rng, orderRate);
    this.robots = [];
    this.queue = [];
    this.tick = 0;
    this.metrics = { ordersCreated: 0, ordersDone: 0, collisions: 0 };
    this._nextRobotId = 0;
    for (let i = 0; i < robots; i++) this.addRobot();
  }

  // Online add — drop a robot on a free charger, else any free passable cell.
  addRobot() {
    const occupied = new Set(this.robots.map(r => key(r.x, r.y)));
    const spot =
      this.grid.chargers.find(c => !occupied.has(key(c.x, c.y))) ||
      this._anyFreeCell(occupied);
    if (!spot) return null;
    const r = new Robot(this._nextRobotId++, spot.x, spot.y);
    this.robots.push(r);
    return r;
  }

  _anyFreeCell(occupied) {
    for (let y = 1; y < this.grid.height - 1; y++)
      for (let x = 1; x < this.grid.width - 1; x++)
        if (this.grid.passable(x, y) && !occupied.has(key(x, y))) return { x, y };
    return null;
  }

  step() {
    // 1. spawn orders
    const fresh = this.gen.step(this.tick);
    this.metrics.ordersCreated += fresh.length;
    for (const o of fresh) this.queue.push(o);

    // 2. assign queued orders to idle robots (nearest-first)
    const idle = this.robots.filter(r => r.state === IDLE);
    if (idle.length && this.queue.length) {
      const taken = assignOrders(this.grid, idle, this.queue);
      const takenSet = new Set(taken);
      this.queue = this.queue.filter(o => !takenSet.has(o));
    }

    // 3. move — fixed-point resolver: a robot enters a cell only once it is free.
    //    Iterating lets convoys follow each other (lead frees a cell, follower takes it)
    //    while still guaranteeing no two robots ever occupy the same cell. Head-on pairs
    //    simply wait (both target cells stay occupied) — never collide.
    const occ = new Set(this.robots.map(r => key(r.x, r.y)));
    const desire = new Map();
    for (const r of this.robots) if (r.path.length) desire.set(r, r.path[0]);
    const moved = new Set();
    let progress = true;
    while (progress) {
      progress = false;
      for (const [r, nxt] of desire) {
        if (moved.has(r)) continue;
        const nk = key(nxt.x, nxt.y);
        if (occ.has(nk)) continue;                 // target still held — retry next pass
        occ.delete(key(r.x, r.y));                 // vacate
        occ.add(nk);                               // occupy
        r.x = nxt.x; r.y = nxt.y; r.path.shift(); r.movedTicks++;
        moved.add(r);
        progress = true;
      }
    }

    // Deadlock breaker: a robot that wanted to move but couldn't for several ticks
    // steps aside to a free neighbour and reroutes — breaks the symmetry that gridlocks
    // a naive lifelong-MAPF swarm. Staggered by id so they don't all yield in lockstep.
    for (const [r] of desire) {
      if (moved.has(r)) { r.blocked = 0; continue; }
      r.blocked++;
      if (r.blocked >= 6 + (r.id % 4)) this._yield(r, occ);
    }

    // collision guard — should stay 0; it's a regression tripwire
    const seen = new Set();
    for (const r of this.robots) {
      const k = key(r.x, r.y);
      if (seen.has(k)) this.metrics.collisions++;
      seen.add(k);
    }

    // 4. handle arrivals (robot reached the end of its path)
    for (const r of this.robots) {
      if (r.path.length > 0) continue;
      if (r.state === TO_PICKUP) {
        r.carrying = true;
        const path = bfsPath(this.grid, r, r.order.dropoff);
        if (path) { r.path = path; r.state = TO_DROPOFF; } else { this._abort(r); }
      } else if (r.state === TO_DROPOFF) {
        r.order.status = 'done';
        r.order.doneTick = this.tick;
        this.metrics.ordersDone++;
        r.delivered++;
        r.carrying = false;
        r.order = null;
        r.state = IDLE;
        this._sendHome(r);                          // clear the aisle when free
      }
    }
    this.tick++;
  }

  // Step a stuck robot sideways to a currently-free neighbour, then reroute to its
  // goal from there. `occupied` is the post-move occupancy set for this tick.
  _yield(r, occupied) {
    const goal = r.state === TO_PICKUP ? r.order?.pickupCell
      : r.state === TO_DROPOFF ? r.order?.dropoff : r.home;
    if (!goal) return;
    const free = this.grid.passableNeighbors(r.x, r.y)
      .filter(c => !occupied.has(key(c.x, c.y)));
    if (!free.length) return;
    const side = free[Math.floor(this.rng() * free.length)];
    const rest = bfsPath(this.grid, side, goal);
    if (!rest) return;
    r.path = [side, ...rest];
    r.blocked = 0;
  }

  // Route an idle robot back to its charger so it stops blocking traffic lanes.
  _sendHome(r) {
    if (r.x === r.home.x && r.y === r.home.y) return;
    const path = bfsPath(this.grid, r, r.home);
    if (path) r.path = path;
  }

  _abort(r) {
    if (r.order) { r.order.status = 'queued'; this.queue.push(r.order); }
    r.order = null; r.carrying = false; r.state = IDLE; r.path = [];
    this._sendHome(r);
  }

  stats() {
    const moving = this.robots.filter(r => r.path.length > 0).length;
    const busy = this.robots.filter(r => r.state !== IDLE).length;
    return {
      tick: this.tick,
      robots: this.robots.length,
      queued: this.queue.length,
      ordersDone: this.metrics.ordersDone,
      ordersCreated: this.metrics.ordersCreated,
      collisions: this.metrics.collisions,
      utilization: this.robots.length ? busy / this.robots.length : 0,
      moving,
    };
  }
}

export { IDLE, TO_PICKUP, TO_DROPOFF };
