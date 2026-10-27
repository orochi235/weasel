/**
 * What a puppet warp costs a frame, split into the solve and the refit, on the
 * hard cases in `foldCases` and an easy star. Run on the fleet:
 * `onto do --kind bench -- npx tsx packages/geom/src/warp/warp.bench.ts --label <what changed>`.
 * Prints each case as it finishes and appends every run's raw timings, with
 * the machine and its load, to `warp.bench.runs.jsonl` beside this file.
 *
 * A record's `sha` is the commit measured, or null when the tree was not one:
 * onto places uncommitted files over HEAD, so HEAD names the commit only when
 * the tree is clean, or when a launcher armed it (`armTree` in
 * `scripts/lib/fleet-tree.mjs`) and it matches. `head` and `dirty` say what
 * the tree held either way. A sync that lands mid-run voids the rest.
 */
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkTree, treeReport, treeStamp } from '../../../../scripts/lib/fleet-tree.mjs';
import type { PolygonPath } from '../path';
import { PathBuilder } from '../paths/builder';
import { pathToAnchors } from '../paths/anchors';
import { createArapSolver, type ArapStage } from './arap';
import { barS, discSquash, type FoldCase } from './foldCases';
import { puppetMap } from './puppet';
import { puppetMesh } from './puppetMesh';
import { warpPath } from './warpPath';

const SOLVES = 60;
const REFITS = 30;
const WARMUP = 5;

function star(): PolygonPath {
  const b = new PathBuilder();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 ? 60 : 180;
    const x = 200 + r * Math.cos(a), y = 200 + r * Math.sin(a);
    if (i === 0) b.moveTo(x, y);
    else b.curveTo(x - 10, y - 10, x + 10, y + 10, x, y);
  }
  return b.close().build();
}

const starPull: FoldCase = {
  name: 'star pull',
  shape: star(),
  pins: [{ x: 200, y: 200 }, { x: 380, y: 200 }, { x: 200, y: 380 }, { x: 60, y: 200 }]
    .map((p, i) => ({ from: p, to: i === 1 ? { x: p.x + 20, y: p.y - 20 } : p })),
  outline: () => [],
};

function timed(count: number, run: () => void): number[] {
  for (let i = 0; i < WARMUP; i++) run();
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const t0 = performance.now();
    run();
    out.push(performance.now() - t0);
  }
  return out;
}

function solveCase(c: FoldCase) {
  const mesh = puppetMesh(c.shape, c.pins.map((p) => p.from));
  const pinned: number[] = [], targets: number[] = [];
  c.pins.forEach((pin, k) => {
    const v = mesh.pinVertex[k];
    if (v < 0 || pinned.includes(v)) return;
    pinned.push(v);
    targets.push(pin.to.x + mesh.vertices[2 * v] - pin.from.x, pin.to.y + mesh.vertices[2 * v + 1] - pin.from.y);
  });
  const solver = createArapSolver(mesh, pinned);
  const rounds: Partial<Record<ArapStage, number>> = {};
  solver.solve(targets, { trace: (s) => { rounds[s.stage] = Math.max(rounds[s.stage] ?? 0, s.round); } });
  return { vertices: mesh.vertices.length / 2, rounds, solveMs: timed(SOLVES, () => solver.solve(targets)) };
}

function refitCase(c: FoldCase) {
  const map = puppetMap(c.shape, c.pins);
  const anchors = pathToAnchors(warpPath(c.shape, map)).anchors.reduce((n, a) => n + a.length, 0);
  return { anchors, refitMs: timed(REFITS, () => warpPath(c.shape, map)) };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const fmt = (v: number) => v.toFixed(2).padStart(7);

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
const runs = fileURLToPath(new URL('./warp.bench.runs.jsonl', import.meta.url));
const cases = [discSquash, barS, starPull];

cases.forEach((c, i) => {
  const solve = solveCase(c);
  const refit = refitCase(c);
  if (treeStamp(ROOT) !== stamp) {
    process.stderr.write(`the tree changed during the run (${stamp} → ${treeStamp(ROOT)}); nothing from ${c.name} on is recorded\n`);
    process.exit(1);
  }
  const record = { date: new Date().toISOString(), label, sha, head, dirty, machine, case: c.name, ...solve, ...refit };
  appendFileSync(runs, JSON.stringify(record) + '\n');
  process.stdout.write(
    `${i + 1}/${cases.length} ${c.name.padEnd(11)} ${String(solve.vertices).padStart(4)} vertices  `
    + `injective ${String(solve.rounds.injective ?? 0).padStart(3)} rounds  solve ${fmt(median(solve.solveMs))} ms  `
    + `refit ${fmt(median(refit.refitMs))} ms  ${String(refit.anchors).padStart(3)} anchors\n`,
  );
});
