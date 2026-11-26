/**
 * What a named easing costs per evaluation now that it plays as blits carries Penner's curves
 * (a bezier or a `linear()`), against geom's function it played before. One evaluation per tween
 * per frame is what a named tween costs, so this is the per-frame difference times the tween count.
 *
 *   onto do --kind bench --quiet --max-cores 1 -- npx tsx tests/perf/easing-names.bench.ts
 *
 * Prints a line per case and appends one record per case and arm to `tests/perf/easing-names.runs.jsonl`.
 */
import { appendFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { execSync } from 'node:child_process';
import { curve, type Easing } from '@msb235/blits';
import { EASINGS } from '@weasel-js/geom';

const OUT = 'tests/perf/easing-names.runs.jsonl';
const NAMES = ['easeOutCubic', 'easeInOutSine', 'easeInOutQuad', 'easeOutBounce', 'easeInOutElastic'] as const;
const CALLS = 1_000_000;
const ROUNDS = Number(process.env.EASING_ROUNDS ?? 7);

const head = (() => { try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { return null; } })();
const machine = { host: hostname(), cpus: cpus().length, cpu: cpus()[0]?.model, load: loadavg() };

let sink = 0;
function time(f: (u: number) => number): number {
  const t0 = performance.now();
  for (let i = 0; i < CALLS; i++) sink += f((i % 1000) / 999);
  return ((performance.now() - t0) * 1e6) / CALLS;
}

const total = NAMES.length * ROUNDS * 2;
let step = 0;
for (const name of NAMES) {
  const arms = { geom: EASINGS[name], blits: curve(name as Easing) };
  for (const f of Object.values(arms)) time(f);
  for (let round = 0; round < ROUNDS; round++) {
    const order = round % 2 === 0 ? (['geom', 'blits'] as const) : (['blits', 'geom'] as const);
    for (const arm of order) {
      const ns = time(arms[arm]);
      appendFileSync(OUT, `${JSON.stringify({ date: new Date().toISOString(), head, machine, name, arm, round, calls: CALLS, nsPerCall: ns })}\n`);
      console.log(`${String(++step).padStart(3)}/${total}  ${name.padEnd(17)} ${arm.padEnd(5)} r${round}  ${ns.toFixed(2).padStart(7)} ns/call`);
    }
  }
}
if (sink === Infinity) console.log(sink);
