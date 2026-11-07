/**
 * What `pathFaceArrangement` costs on glyphs overlaid in one cell, the way a
 * segment display cuts them: Inter's digits, capitals, and printable ASCII,
 * once with the font's curves and once flattened to polygons first, within
 * 0.0005 em. Run on the fleet:
 * `onto do --kind bench -- npx tsx packages/geom/src/booleans/faceArrangement.bench.ts --label <what changed>`.
 * Prints each case as it finishes and appends every run's raw timings, with
 * the machine and its load, to `faceArrangement.bench.runs.jsonl` beside this file.
 *
 * A record's `sha` is the commit measured, or null when the tree was not one;
 * see `warp.bench.ts` for how `head`, `dirty` and an armed tree decide it.
 */
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkTree, treeReport, treeStamp } from '../../../../scripts/lib/fleet-tree.mjs';
import type { Path } from '../path';
import { multiPolygonToPath, pathToMultiPolygon } from './adapter';
import { ASCII, DIGITS, UPPER, glyphCell } from './glyphCell.fixtures';
import { pathFaceArrangement } from './ops';

const RUNS = 5;
const CELL = 100;
/** The cell is the glyphs' height less a margin, a little over an em; flatten to 0.0005 em of that. */
const FLAT_TOLERANCE = 0.0005 * CELL * 0.92;

function timed(paths: Path[]) {
  let faces = 0, neighbors = 0;
  const ms: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const r = pathFaceArrangement(paths);
    ms.push(performance.now() - t0);
    faces = r.faces.length;
    neighbors = r.neighbors.length;
  }
  return { faces, neighbors, ms };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const fmt = (v: number) => v.toFixed(1).padStart(8);

const labelAt = process.argv.indexOf('--label');
const label = labelAt >= 0 ? process.argv[labelAt + 1] : '';
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
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
const runs = fileURLToPath(new URL('./faceArrangement.bench.runs.jsonl', import.meta.url));

const sets = [['digits', DIGITS], ['A–Z', UPPER], ['printable ASCII', ASCII]] as const;
const cases = sets.flatMap(([name, chars]) => {
  const curves = glyphCell(chars, CELL);
  const flat = curves.map((p) => multiPolygonToPath(pathToMultiPolygon(p, { tolerance: FLAT_TOLERANCE })));
  return [{ name, input: 'curves', paths: curves }, { name, input: 'flattened', paths: flat }];
});

cases.forEach((c, i) => {
  const result = timed(c.paths);
  if (treeStamp(ROOT) !== stamp) {
    process.stderr.write(`the tree changed during the run (${stamp} → ${treeStamp(ROOT)}); nothing from ${c.name} on is recorded\n`);
    process.exit(1);
  }
  const record = { date: new Date().toISOString(), label, sha, head, dirty, machine, case: c.name, input: c.input, glyphs: c.paths.length, ...result };
  appendFileSync(runs, JSON.stringify(record) + '\n');
  process.stdout.write(
    `${i + 1}/${cases.length} ${c.name.padEnd(15)} ${c.input.padEnd(9)} ${String(result.faces).padStart(6)} faces `
    + `${String(result.neighbors).padStart(6)} neighbors  ${fmt(median(result.ms))} ms median of ${RUNS}\n`,
  );
});
