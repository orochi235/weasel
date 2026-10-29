// What `npm run typecheck` costs on a node under each state its build info can be in: none, current,
// and current but for one edit. Runs both programs, each with --extendedDiagnostics, and writes every
// run's log and one JSON line of its numbers to --out as the run finishes. `break` changes the type of
// an export, keeping the file's mtime, and records whether the error reaches the files importing it,
// which the build info had recorded as clean.
//
//   node scripts/bench-typecheck.mjs --out .bench/typecheck [--states warm,break,mended]
import { execFile } from 'node:child_process';
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { cpus, hostname } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { sampleLoad } from './lib/node-load.mjs';

const { values } = parseArgs({ options: { out: { type: 'string', default: '.bench/typecheck' }, states: { type: 'string' } } });
mkdirSync(values.out, { recursive: true });
const node = hostname().split('.')[0];
const TSC = 'node_modules/.bin/tsc';
const PROGRAMS = { root: [], browser: ['-p', 'packages'] };
const LEAF = 'packages/geom/src/index.ts';
const HUB = 'packages/core/src/index.ts';
const TYPED = ['packages/geom/src/view.ts', 'export const ZOOM_FLOOR = 1e-9;', "export const ZOOM_FLOOR: string = '1e-9';"];
/** Files that import ZOOM_FLOOR and are left alone, so an error naming one came from build info's dependents. */
const IMPORTERS = /packages\/core\/src\/domains\/viewports\/aim\.ts/;

const tsc = (args) =>
  new Promise((resolve) => {
    const started = Date.now();
    execFile(TSC, ['--noEmit', '--extendedDiagnostics', ...args], { maxBuffer: 1 << 26 }, (error, stdout, stderr) =>
      resolve({ code: error ? (error.code ?? 1) : 0, wallSeconds: (Date.now() - started) / 1000, text: `${stdout}${stderr}` }),
    );
  });

const diagnostics = (text) =>
  Object.fromEntries(
    [...text.matchAll(/^([A-Z][\w ]+?):\s+([\d.]+)(s|K)?\s*$/gm)].map(([, key, value]) => [key, Number(value)]),
  );

const edit = (file, extra) => {
  copyFileSync(file, `${file}.bench-orig`);
  appendFileSync(file, extra);
  return () => {
    copyFileSync(`${file}.bench-orig`, file);
    rmSync(`${file}.bench-orig`);
  };
};

const retype = ([file, from, to]) => {
  const { atime, mtime } = statSync(file);
  const text = readFileSync(file, 'utf8');
  if (!text.includes(from)) throw new Error(`${file} no longer holds ${from}`);
  writeFileSync(file, text.replace(from, to));
  utimesSync(file, atime, mtime);
  return () => {
    writeFileSync(file, text);
    utimesSync(file, atime, mtime);
  };
};

const ALL_STATES = [
  ['cold', () => rmSync('.tsbuildinfo', { recursive: true, force: true })],
  ['warm', () => {}],
  ['leaf-body', () => edit(LEAF, '\nexport const benchProbe = 1;\n')],
  ['hub-type', () => edit(HUB, '\nexport type BenchProbe = { probe: number };\n')],
  ['warm-after', () => {}],
  ['break', () => retype(TYPED)],
  ['mended', () => {}],
];
const STATES = values.states ? values.states.split(',').map((name) => ALL_STATES.find(([n]) => n === name)) : ALL_STATES;

const total = STATES.length * Object.keys(PROGRAMS).length;
let n = 0;
for (const [state, prepare] of STATES) {
  const undo = prepare();
  for (const [program, args] of Object.entries(PROGRAMS)) {
    n++;
    const loadBefore = await sampleLoad();
    const r = await tsc(args);
    writeFileSync(join(values.out, `${node}-${state}-${program}.log`), r.text);
    const row = { node, cores: cpus().length, state, program, at: new Date().toISOString(), loadBefore, code: r.code, wallSeconds: r.wallSeconds, importerError: IMPORTERS.test(r.text), diagnostics: diagnostics(r.text) };
    appendFileSync(join(values.out, 'runs.jsonl'), `${JSON.stringify(row)}\n`);
    const d = row.diagnostics;
    console.log(
      `${String(n).padStart(2)}/${total}  ${node}  ${state.padEnd(10)} ${program.padEnd(7)}  ${r.wallSeconds.toFixed(1).padStart(6)}s` +
        `  check ${(d['Check time'] ?? 0).toFixed(2).padStart(6)}s  program ${(d['Program time'] ?? 0).toFixed(2).padStart(6)}s  exit ${r.code}` +
        `${row.importerError ? '  error in an unchanged importer' : ''}`,
    );
  }
  if (typeof undo === 'function') undo();
}
console.log(readFileSync(join(values.out, 'runs.jsonl'), 'utf8').trim().split('\n').length, 'rows in', values.out);
