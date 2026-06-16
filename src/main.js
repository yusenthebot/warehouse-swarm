// Browser entry: wire the Sim to a canvas + HUD, run a fixed-timestep loop,
// and expose controls (add robots, speed). window.__sim is exposed for headless checks.
import { Sim } from './sim.js';
import { draw } from './render.js';

const CELL = 26;
const TICK_MS = 90;                 // base sim tick interval at 1x speed

const sim = new Sim({ width: 30, height: 20, robots: 12, seed: 7, orderRate: 0.9 });
window.__sim = sim;

const canvas = document.getElementById('view');
canvas.width = sim.grid.width * CELL;
canvas.height = sim.grid.height * CELL;
const ctx = canvas.getContext('2d');

let speed = 2;
let acc = 0;
let last = performance.now();
const startWall = last;

function hud() {
  const s = sim.stats();
  const secs = Math.max(1, (performance.now() - startWall) / 1000);
  const tput = (s.ordersDone / secs).toFixed(2);
  document.getElementById('m-done').textContent = s.ordersDone;
  document.getElementById('m-queued').textContent = s.queued;
  document.getElementById('m-robots').textContent = s.robots;
  document.getElementById('m-collisions').textContent = s.collisions;
  document.getElementById('m-util').textContent = (s.utilization * 100).toFixed(0) + '%';
  document.getElementById('m-tput').textContent = tput + '/s';
  document.getElementById('m-tick').textContent = s.tick;
}

function frame(now) {
  acc += now - last;
  last = now;
  const interval = TICK_MS / speed;
  let guard = 0;
  while (acc >= interval && guard++ < 20) { sim.step(); acc -= interval; }
  draw(ctx, sim, CELL);
  hud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// controls
document.getElementById('add1').onclick = () => sim.addRobot();
document.getElementById('add5').onclick = () => { for (let i = 0; i < 5; i++) sim.addRobot(); };
const sp = document.getElementById('speed');
sp.oninput = () => { speed = Number(sp.value); document.getElementById('speed-val').textContent = speed + 'x'; };
