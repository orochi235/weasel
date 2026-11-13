/**
 * What `serializeSvg` costs to box one stroked path whose coordinates reach
 * 1e30 to 1e37, the fallback viewBox the path-data property tests drew
 * unstroked because of it, against the same paths unstroked and at a page's
 * size. Each case is a handful of curves and lines, 1 wide.
 * Run: `npx tsx packages/svg/src/hugeStrokeBounds.bench.ts --label <what changed>`.
 * Prints each case as it finishes and appends every run's raw timings, with
 * the machine and its load, to `hugeStrokeBounds.bench.runs.jsonl` beside this file.
 */
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { cpus, hostname, loadavg } from 'node:os';
import { fileURLToPath } from 'node:url';
import { PathBuilder } from '@weasel-js/geom';
import type { SvgPathNode } from './types';

// Core's source imports CSS modules, which node cannot load; the bench draws nothing, so each is empty.
registerHooks({
  load: (url, context, next) => (url.endsWith('.css') ? { format: 'module', source: 'export default {};', shortCircuit: true } : next(url, context)),
});
const { serializeSvg } = await import('./serialize');

const RUNS = 5;

/** Curves and lines with every coordinate `scale` times a small integer. */
function path(scale: number) {
  const s = (v: number) => Math.fround(v * scale);
  return new PathBuilder()
    .moveTo(s(-3), s(1))
    .curveTo(s(4), s(-2), s(-1), s(5), s(2), s(2))
    .quadTo(s(6), s(-4), s(-5), s(-1))
    .lineTo(s(3), s(-3))
    .curveTo(s(-2), s(7), s(5), s(1), s(-4), s(4))
    .close()
    .build();
}

const label = process.argv.includes('--label') ? process.argv[process.argv.indexOf('--label') + 1] : '';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const git = (args: string) => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
const head = git('rev-parse HEAD');
const dirty = git('status --porcelain').split('\n').filter(Boolean).length;
const machine = { host: hostname(), cpus: cpus().length, cpu: cpus()[0]?.model, load: loadavg() };
const runs = fileURLToPath(new URL('./hugeStrokeBounds.bench.runs.jsonl', import.meta.url));

const cases = [1, 1e30, 1e33, 1e37].flatMap((scale) => [true, false].map((stroked) => ({ scale, stroked })));
cases.forEach(({ scale, stroked }, i) => {
  const node: SvgPathNode = {
    kind: 'path', path: path(scale), fill: { kind: 'none' },
    ...(stroked ? { stroke: { paint: { kind: 'solid', color: '#000' }, width: 1 } } : {}),
  } as SvgPathNode;
  const ms: number[] = [];
  let length = 0;
  for (let r = 0; r < RUNS; r++) {
    const t0 = performance.now();
    length = serializeSvg([node]).length;
    ms.push(performance.now() - t0);
  }
  appendFileSync(runs, JSON.stringify({ date: new Date().toISOString(), label, sha: dirty === 0 ? head : null, head, dirty, machine, scale, stroked, length, ms }) + '\n');
  const median = [...ms].sort((a, b) => a - b)[RUNS >> 1]!;
  process.stdout.write(`${i + 1}/${cases.length} scale ${scale.toExponential(0).padStart(5)} ${stroked ? 'stroked  ' : 'unstroked'} ${median.toFixed(2).padStart(8)} ms median of ${RUNS}\n`);
});
