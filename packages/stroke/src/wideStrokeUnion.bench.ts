/**
 * What `trianglesToPath` costs on the ribbon of one shape stroked wider each
 * time, the union `strokeToPath` makes of it: paths the size of pdf's writer
 * property tests draw, from a width of 1 to a width of a million, where a
 * round stroke's fans pile thousands of long triangles through the path.
 * Run on the fleet:
 * `onto do --kind bench -- npx tsx packages/stroke/src/wideStrokeUnion.bench.ts --label <what changed>`.
 * `--most <n>` skips meshes of more than `n` triangles. Prints each case as it
 * finishes and appends every run's raw timings, with the machine and its load,
 * to `wideStrokeUnion.bench.runs.jsonl` beside this file.
 *
 * A record's `sha` is the commit measured, or null when the tree was not one;
 * see `warp.bench.ts` in geom for how `head`, `dirty` and an armed tree decide it.
 */
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { fileURLToPath } from 'node:url';
import { pathFromD } from '@weasel-js/geom';
import { trianglesToPath } from '@weasel-js/geom/booleans';
import type { Stroke } from '@weasel-js/paint';
import { checkTree, treeReport, treeStamp } from '../../../scripts/lib/fleet-tree.mjs';
import { tessellateStroke } from './tessellate/stroke';

const RUNS = 3;
const SHAPES = {
  'quad arch': 'M0 0 Q100 200 200 0',
  'line and quad': 'M10 20 L200 30 Q90 210 40 60',
  'cubic, line, quad': 'M10 20 C80 200 150 -40 220 90 L60 140 Q0 60 120 30',
};
const WIDTHS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];
const STYLES: Pick<Stroke, 'cap' | 'join'>[] = [{ cap: 'round', join: 'round' }, { cap: 'butt', join: 'miter' }];

const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const label = arg('--label') ?? '';
const most = Number(arg('--most') ?? Infinity);
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const git = (args: string) => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
const head = git('rev-parse HEAD');
const dirty = git('status --porcelain').split('\n').filter(Boolean).length;
const armed = checkTree(ROOT, process.env);
if (armed.armed && armed.problems.length > 0) {
  process.stderr.write(`${treeReport(armed).text}\n`);
  process.exit(1);
}
const sha = armed.armed ? armed.commit : dirty === 0 ? head : null;
const stamp = treeStamp(ROOT);
const machine = { host: hostname(), cpus: cpus().length, cpu: cpus()[0]?.model, load: loadavg() };
const runs = fileURLToPath(new URL('./wideStrokeUnion.bench.runs.jsonl', import.meta.url));

const cases = Object.entries(SHAPES).flatMap(([shape, d]) =>
  STYLES.flatMap((style) => WIDTHS.map((width) => {
    const mesh = tessellateStroke(pathFromD(d), { ...style, width } as Stroke, {});
    return { shape, d, ...style, width, mesh, triangles: mesh.indices.length / 3 };
  })));
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;

cases.forEach((c, i) => {
  const at = `${String(i + 1).padStart(2)}/${cases.length} ${c.shape.padEnd(17)} ${c.cap!.padEnd(5)} ${c.join!.padEnd(5)} `
    + `${c.width.toExponential(0).padStart(5)} ${String(c.triangles).padStart(5)} triangles`;
  if (c.triangles > most) {
    process.stdout.write(`${at}  skipped\n`);
    return;
  }
  const ms: number[] = [];
  let commands = 0;
  for (let r = 0; r < RUNS; r++) {
    const t0 = performance.now();
    commands = trianglesToPath(c.mesh.vertices, c.mesh.indices).commands.length;
    ms.push(performance.now() - t0);
  }
  if (treeStamp(ROOT) !== stamp) {
    process.stderr.write(`the tree changed during the run (${stamp} → ${treeStamp(ROOT)}); nothing from case ${i + 1} on is recorded\n`);
    process.exit(1);
  }
  const record = {
    date: new Date().toISOString(), label, sha, head, dirty, machine,
    shape: c.shape, d: c.d, cap: c.cap, join: c.join, width: c.width, triangles: c.triangles, commands, ms,
  };
  appendFileSync(runs, JSON.stringify(record) + '\n');
  process.stdout.write(`${at} ${String(commands).padStart(6)} commands ${median(ms).toFixed(1).padStart(9)} ms median of ${RUNS}\n`);
});
