// Orders: a pick-from-shelf -> deliver-to-dropoff job, and a Poisson-ish generator.
import { pick } from './rng.js';

export class Order {
  constructor(id, pickupCell, dropoff, createdTick) {
    this.id = id;
    this.pickupCell = pickupCell;   // walkable cell adjacent to the shelf
    this.dropoff = dropoff;         // a dropoff bay cell
    this.status = 'queued';         // queued -> assigned -> done
    this.createdTick = createdTick;
    this.doneTick = -1;
  }
}

export class OrderGenerator {
  constructor(grid, rng, ratePerTick = 0.8, maxOrders = Infinity) {
    this.grid = grid;
    this.rng = rng;
    this.ratePerTick = ratePerTick; // expected new orders per tick
    this.maxOrders = maxOrders;     // stop emitting after this many (scenario mode)
    this.emitted = 0;
    this.nextId = 1;
  }

  // Returns an array of new orders for this tick (usually 0 or 1, more at high rate).
  step(tick) {
    const out = [];
    let budget = this.ratePerTick;
    while (budget > 0) {
      if (this.emitted >= this.maxOrders) break;
      if (this.rng() < Math.min(budget, 1)) {
        const o = this.makeOrder(tick);
        if (o) { out.push(o); this.emitted++; }
      }
      budget -= 1;
    }
    return out;
  }

  makeOrder(tick) {
    const shelf = pick(this.rng, this.grid.shelves);
    if (!shelf) return null;
    const access = this.grid.passableNeighbors(shelf.x, shelf.y);
    if (!access.length) return null;
    const pickupCell = pick(this.rng, access);
    const dropoff = pick(this.rng, this.grid.dropoffs);
    if (!dropoff) return null;
    return new Order(this.nextId++, pickupCell, dropoff, tick);
  }
}
