// Browser entry: wire the Sim to a canvas + HUD, run a fixed-timestep loop, expose
// controls. URL params (?robots=&rate=&speed=&seed=&warm=) launch a specific scenario.
// window.__sim is exposed for headless checks.
import { Sim } from './sim.js';
import { draw } from './render.js';

const CELL = 26;
const TICK_MS = 90;                 // base sim tick interval at 1x speed

const params = new URLSearchParams(location.search);
const clamp = (k, d, lo, hi) => Math.max(lo, Math.min(hi, Number(params.get(k)) || d));

// ?orders=N runs a fixed-batch scenario: inject exactly N, then freeze on a DONE banner.
const ORDERS = clamp('orders', 0, 0, 100000);
const sim = new Sim({
  width: 30, height: 20,
  robots: clamp('robots', 12, 1, 60),
  seed: clamp('seed', 7, 1, 1e9),
  orderRate: Number(params.get('rate')) || (ORDERS ? 5 : 0.9),
  maxOrders: ORDERS || Infinity,
});
window.__sim = sim;

let scenarioDone = false, makespanTicks = 0;
function checkDone() {
  if (ORDERS && !scenarioDone && sim.metrics.ordersDone >= ORDERS) {
    scenarioDone = true;
    makespanTicks = sim.tick;
    const b = document.getElementById('banner');
    b.textContent = `✓ ${ORDERS} orders delivered in ${makespanTicks} ticks · ${sim.stats().collisions} collisions`;
    b.style.display = 'block';
  }
  return scenarioDone;
}

const canvas = document.getElementById('view');
canvas.width = sim.grid.width * CELL;
canvas.height = sim.grid.height * CELL;
const ctx = canvas.getContext('2d');

let speed = clamp('speed', 2, 1, 8);
let acc = 0;
let last = performance.now();
const startWall = last;

// --- throughput sparkline ---
const spark = document.getElementById('spark');
const sctx = spark.getContext('2d');
const hist = [];
function pushSpark(v) { hist.push(v); if (hist.length > 60) hist.shift(); }
function drawSpark() {
  const w = spark.width, h = spark.height, max = Math.max(0.001, ...hist);
  sctx.clearRect(0, 0, w, h);
  if (hist.length < 2) return;
  sctx.strokeStyle = '#38bdf8';
  sctx.lineWidth = 1.5;
  sctx.beginPath();
  hist.forEach((v, i) => {
    const x = (i / (hist.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
  });
  sctx.stroke();
}

function hud() {
  const s = sim.stats();
  const secs = Math.max(1, (performance.now() - startWall) / 1000);
  document.getElementById('m-done').textContent = s.ordersDone;
  document.getElementById('m-queued').textContent = s.queued;
  document.getElementById('m-robots').textContent = s.robots;
  document.getElementById('m-collisions').textContent = s.collisions;
  document.getElementById('m-charging').textContent = s.charging;
  document.getElementById('m-util').textContent = (s.utilization * 100).toFixed(0) + '%';
  document.getElementById('m-tput').textContent = (s.ordersDone / secs).toFixed(2) + '/s';
  document.getElementById('m-tick').textContent = s.tick;
}

// Warm-start: advance the sim before first paint so headless screenshots and demos
// open on a busy warehouse, seeding the sparkline from the warm run. Deterministic.
const WARM = clamp('warm', 0, 0, 50000);
const SAMPLE = 40;
let warmPrevDone = 0;
for (let i = 0; i < WARM; i++) {
  sim.step();
  if ((i + 1) % SAMPLE === 0) { pushSpark(sim.metrics.ordersDone - warmPrevDone); warmPrevDone = sim.metrics.ordersDone; }
  if (checkDone()) break;
}

// live sampling on wall-clock windows
let lastSampleT = startWall, lastSampleDone = sim.metrics.ordersDone;
function sampleThroughput(now) {
  if (now - lastSampleT < 400) return;
  pushSpark(sim.metrics.ordersDone - lastSampleDone);
  lastSampleT = now;
  lastSampleDone = sim.metrics.ordersDone;
}

function frame(now) {
  acc += now - last;
  last = now;
  if (!scenarioDone) {
    const interval = TICK_MS / speed;
    let guard = 0;
    while (acc >= interval && guard++ < 240) { sim.step(); if (checkDone()) break; acc -= interval; }
  } else {
    acc = 0;
  }
  draw(ctx, sim, CELL);
  hud();
  sampleThroughput(now);
  drawSpark();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// controls
document.getElementById('add1').onclick = () => sim.addRobot();
document.getElementById('add5').onclick = () => { for (let i = 0; i < 5; i++) sim.addRobot(); };
const sp = document.getElementById('speed');
sp.value = speed;
document.getElementById('speed-val').textContent = speed + 'x';
sp.oninput = () => { speed = Number(sp.value); document.getElementById('speed-val').textContent = speed + 'x'; };
