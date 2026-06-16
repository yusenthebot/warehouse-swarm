// Robot: position + current job + planned path. Behaviour lives in sim.js (tick()).
export const IDLE = 'idle';
export const TO_PICKUP = 'toPickup';
export const TO_DROPOFF = 'toDropoff';

let palette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308'];

export class Robot {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.home = { x, y };       // its charger/depot cell
    this.state = IDLE;
    this.order = null;
    this.path = [];             // remaining steps (cells) to current target
    this.carrying = false;
    this.blocked = 0;           // consecutive ticks unable to advance (deadlock breaker)
    this.battery = 1.0;         // reserved for the charging round
    this.color = palette[id % palette.length];
    this.delivered = 0;
    this.movedTicks = 0;        // ticks spent moving (for utilization)
  }
}
