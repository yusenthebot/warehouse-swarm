// The simulated world. One step() = one discrete tick:
//   generate -> assign -> move (+battery drain) -> arrivals -> charge -> charge-decision.
// Deterministic given a seed, so node tests and headless runs reproduce exactly.
import { generateWarehouse, bfsPath } from './grid.js';
import { makeRng } from './rng.js';
import { OrderGenerator } from './orders.js';
import { assignOrders } from './dispatch.js';
import { Robot, IDLE, TO_PICKUP, TO_DROPOFF, TO_CHARGER, CHARGING } from './robot.js';

const key = (x, y) => x * 100000 + y;

const BATTERY_DRAIN = 0.0005;   // per move (~2000 moves per full charge)
const CHARGE_THRESHOLD = 0.45;  // go recharge below this — ample headroom to reach a charger
const CHARGE_RATE = 0.04;       // per tick while docked (full in ~25 ticks)

export class Sim {
  constructor({ width = 30, height = 20, robots = 12, seed = 1, orderRate = 0.8, maxOrders = Infinity } = {}) {
    this.grid = generateWarehouse(width, height);
    this.rng = makeRng(seed);
    this.gen = new OrderGenerator(this.grid, this.rng, orderRate, maxOrders);
    this.maxOrders = maxOrders;
    this.robots = [];
    this.queue = [];
    this.reservedChargers = new Set();
    this.tick = 0;
    this.metrics = { ordersCreated: 0, ordersDone: 0, collisions: 0 };
    this._nextRobotId = 0;
    for (let i = 0; i < robots; i++) this.addRobot();
  }

  addRobot() {
    const occupied = new Set(this.robots.map(r => key(r.x, r.y)));
    const spot =
      this.grid.chargers.find(c => !occupied.has(key(c.x, c.y))) ||
      this._anyFreeCell(occupied);
    if (!spot) return null;
    const r = new Robot(this._nextRobotId++, spot.x, spot.y);
    r.battery = 0.6 + 0.4 * this.rng();           // stagger so charge waves desync
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
    // 1. spawn orders (capped by maxOrders in scenario mode)
    const fresh = this.gen.step(this.tick);
    this.metrics.ordersCreated += fresh.length;
    for (const o of fresh) this.queue.push(o);

    // 2. assign queued orders to idle robots that have enough charge
    const idle = this.robots.filter(r => r.state === IDLE && r.battery >= CHARGE_THRESHOLD);
    if (idle.length && this.queue.length) {
      const taken = assignOrders(this.grid, idle, this.queue);
      const takenSet = new Set(taken);
      this.queue = this.queue.filter(o => !takenSet.has(o));
    }

    // 3. move — fixed-point resolver: enter a cell only once it is free. Convoys follow;
    //    head-on pairs simply wait. Moving costs battery.
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
        if (occ.has(nk)) continue;
        occ.delete(key(r.x, r.y));
        occ.add(nk);
        r.x = nxt.x; r.y = nxt.y; r.path.shift(); r.movedTicks++;
        r.battery = Math.max(0, r.battery - BATTERY_DRAIN);
        moved.add(r);
        progress = true;
      }
    }

    // deadlock breaker. Head-on swaps (A wants B's cell while B wants A's) would livelock,
    // so resolve them decisively: the lower-id robot wins, the other yields aside at once.
    // Everyone else yields only after being stuck a while (staggered by id).
    const posOf = new Map(this.robots.map(r => [key(r.x, r.y), r]));
    for (const [r, nxt] of desire) {
      if (moved.has(r)) { r.blocked = 0; continue; }
      r.blocked++;
      const other = posOf.get(key(nxt.x, nxt.y));
      const od = other && desire.get(other);
      const headOn = od && od.x === r.x && od.y === r.y;
      if (headOn && r.id > other.id) { this._yield(r, occ); continue; }
      if (r.blocked >= 6 + (r.id % 4)) this._yield(r, occ);
    }

    // collision guard — must stay 0
    const seen = new Set();
    for (const r of this.robots) {
      const k = key(r.x, r.y);
      if (seen.has(k)) this.metrics.collisions++;
      seen.add(k);
    }

    // 4. arrivals (robot reached the end of its path)
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
        if (r.battery < CHARGE_THRESHOLD) this._goCharge(r); else this._sendHome(r);
      } else if (r.state === TO_CHARGER) {
        r.state = CHARGING;                       // docked
      }
    }

    // 5. charge docked robots; release the bay when full
    for (const r of this.robots) {
      if (r.state !== CHARGING) continue;
      r.battery = Math.min(1, r.battery + CHARGE_RATE);
      if (r.battery >= 1) {
        this.reservedChargers.delete(key(r.x, r.y));
        r.chargerTarget = null;
        r.state = IDLE;
      }
    }

    // 6. any idle-but-low robot that isn't already heading to a bay: send it to charge
    for (const r of this.robots)
      if (r.state === IDLE && r.battery < CHARGE_THRESHOLD && !r.chargerTarget) this._goCharge(r);

    this.tick++;
  }

  _goCharge(r) {
    const occupied = new Set(this.robots.filter(o => o !== r).map(o => key(o.x, o.y)));
    let best = null, bd = Infinity;
    for (const c of this.grid.chargers) {
      const k = key(c.x, c.y);
      if (this.reservedChargers.has(k) || occupied.has(k)) continue;
      const d = Math.abs(r.x - c.x) + Math.abs(r.y - c.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;                            // no free bay — retry next tick
    const path = bfsPath(this.grid, r, best);
    if (!path) return;
    this.reservedChargers.add(key(best.x, best.y));
    r.chargerTarget = best;
    r.path = path;
    r.state = TO_CHARGER;
  }

  _yield(r, occupied) {
    const goal = r.state === TO_PICKUP ? r.order?.pickupCell
      : r.state === TO_DROPOFF ? r.order?.dropoff
      : r.state === TO_CHARGER ? r.chargerTarget
      : r.home;
    if (!goal) return;
    const free = this.grid.passableNeighbors(r.x, r.y).filter(c => !occupied.has(key(c.x, c.y)));
    if (!free.length) return;
    const side = free[Math.floor(this.rng() * free.length)];
    const rest = bfsPath(this.grid, side, goal);
    if (!rest) return;
    r.path = [side, ...rest];
    r.blocked = 0;
  }

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
    const busy = this.robots.filter(r => r.state !== IDLE && r.state !== CHARGING).length;
    const charging = this.robots.filter(r => r.state === CHARGING).length;
    const minBattery = this.robots.length ? Math.min(...this.robots.map(r => r.battery)) : 1;
    return {
      tick: this.tick,
      robots: this.robots.length,
      queued: this.queue.length,
      ordersDone: this.metrics.ordersDone,
      ordersCreated: this.metrics.ordersCreated,
      collisions: this.metrics.collisions,
      utilization: this.robots.length ? busy / this.robots.length : 0,
      charging,
      minBattery,
    };
  }
}

export { IDLE, TO_PICKUP, TO_DROPOFF, TO_CHARGER, CHARGING };
