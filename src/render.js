// Draw the world to a 2D canvas context. Pure presentation — reads sim, mutates nothing.
import { FLOOR, SHELF, CHARGER, DROPOFF, WALL } from './grid.js';
import { CHARGING } from './robot.js';

const CELL_COLORS = {
  [FLOOR]: '#0f172a',
  [SHELF]: '#475569',
  [CHARGER]: '#065f46',
  [DROPOFF]: '#7c2d12',
  [WALL]: '#1e293b',
};

export function draw(ctx, sim, cell) {
  const g = sim.grid;
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, g.width * cell, g.height * cell);

  // cells
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const t = g.get(x, y);
      if (t === FLOOR) continue;
      ctx.fillStyle = CELL_COLORS[t];
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  // subtle grid lines
  ctx.strokeStyle = 'rgba(148,163,184,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= g.width; x++) { ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, g.height * cell); ctx.stroke(); }
  for (let y = 0; y <= g.height; y++) { ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(g.width * cell, y * cell); ctx.stroke(); }

  // robots + their remaining path
  for (const r of sim.robots) {
    if (r.path.length) {
      ctx.strokeStyle = r.color + '55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo((r.x + 0.5) * cell, (r.y + 0.5) * cell);
      for (const p of r.path) ctx.lineTo((p.x + 0.5) * cell, (p.y + 0.5) * cell);
      ctx.stroke();
    }
  }
  for (const r of sim.robots) {
    const cx = (r.x + 0.5) * cell, cy = (r.y + 0.5) * cell;
    if (r.state === CHARGING) {             // green ring while docked + charging
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.46, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
    if (r.carrying) {                       // box on top when carrying a load
      ctx.fillStyle = '#fde68a';
      const s = cell * 0.3;
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    }
    // battery bar above the robot
    const bw = cell * 0.62, bh = 3, bx = cx - bw / 2, by = cy - cell * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = r.battery > 0.5 ? '#34d399' : r.battery > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(bx, by, bw * r.battery, bh);
  }
}
