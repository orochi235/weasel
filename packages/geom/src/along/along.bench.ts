/**
 * What a point at a length along a path costs: `measurePath(...).at()` and
 * `pointAtLength` on a path of four cubics, and a 1,000-vertex `bendAlongPath`
 * on a curved spine. Run on the fleet:
 * `onto do --kind bench -- npx tsx packages/geom/src/along/along.bench.ts --out <runs.jsonl> --label <what>`.
 * Prints each item as it finishes; with `--out`, appends one record per item
 * holding every batch's timing and the machine and its load.
 */
import { appendFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { PathBuilder } from '../paths/builder';
import { bendAlongPath } from '../paths/bendAlongPath';
import { measurePath } from '../paths/pathMeasure';
import { pathLengthTable } from './pathTable';
import { pointAtLength } from './positions';

const BATCHES = 15;
const QUERIES = 1000;

/** Four cubics, each bending a different way, so no two segments share a shape. */
function fourCubics() {
  return new PathBuilder()
    .moveTo(0, 0)
    .curveTo(40, -80, 120, -60, 160, 0)
    .curveTo(200, 60, 260, 90, 320, 20)
    .curveTo(360, -30, 380, -120, 300, -140)
    .curveTo(220, -160, 120, -120, 60, -60)
    .build();
}

function wave(n: number) {
  const b = new PathBuilder().moveTo(0, 0);
  for (let i = 1; i < n; i++) b.lineTo(i * 2, Math.sin(i / 7) * 10);
  for (let i = n - 1; i >= 0; i--) b.lineTo(i * 2, 30 + Math.cos(i / 5) * 10);
  return b.close().build();
}

/** Microseconds per call, one figure per batch of `per` calls. */
function batches(per: number, count: number, run: () => void): number[] {
  for (let i = 0; i < 3; i++) run();
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t0 = performance.now();
    run();
    out.push(((performance.now() - t0) * 1000) / per);
  }
  return out;
}

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const out = arg('--out');
const label = arg('--label') ?? '';

const path = fourCubics();
const measure = measurePath(path)!;
const table = pathLengthTable(path);
const stations = Float64Array.from({ length: QUERIES }, (_v, i) => ((i + 0.5) / QUERIES) * measure.length);
const shape = wave(500);
let sink = 0;

const items: [string, number, () => void][] = [
  ['measurePath at() on four cubics', QUERIES * 50, () => {
    for (let r = 0; r < 50; r++) for (let i = 0; i < QUERIES; i++) sink += measure.at(stations[i]).point.x;
  }],
  ['pointAtLength on four cubics', QUERIES * 50, () => {
    for (let r = 0; r < 50; r++) for (let i = 0; i < QUERIES; i++) sink += pointAtLength(table, stations[i]).point[0];
  }],
  ['bendAlongPath, 1,000-vertex shape', 1, () => {
    sink += bendAlongPath(shape, fourCubics())!.coords.length;
  }],
];

items.forEach(([name, per, run], i) => {
  const us = batches(per, BATCHES, run);
  const median = [...us].sort((a, b) => a - b)[us.length >> 1];
  process.stdout.write(`${i + 1}/${items.length} ${name.padEnd(36)} ${median.toFixed(4).padStart(11)} us\n`);
  if (out) {
    const machine = { host: hostname(), cpus: cpus().length, cpu: cpus()[0]?.model, load: loadavg(), node: process.version };
    appendFileSync(out, JSON.stringify({ date: new Date().toISOString(), label, item: name, per, us, machine }) + '\n');
  }
});
if (sink === 42) process.stdout.write('\n');
