#!/usr/bin/env node
// vitest with the `browser` project in a process of its own, running beside the rest instead of
// after it: one vitest process runs its sequence groups one after another, so `groupOrder: 1`
// alone would leave the browser project waiting for every jsdom file. Takes vitest's own arguments.
//
// The other process gets the node's idle cores less the browser project's reserve
// (`scripts/lib/node-load.mjs`); WEASEL_JSDOM_WORKERS overrides the count, and WEASEL_OVERLAP=1 or 0
// skips the check. Beside the rest, the browser project takes fewer Chromiums than alone
// (`scripts/lib/browser-shape.mjs`).
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { mergeProgress } from './lib/merge-progress.mjs';
import { roomToOverlap, sampleLoad } from './lib/node-load.mjs';
import { browserShape } from './lib/browser-shape.mjs';
import { rerunPlan } from './lib/load-reruns.mjs';

const require = createRequire(import.meta.url);
const pkg = require.resolve('vitest/package.json');
const VITEST = join(dirname(pkg), require(pkg).bin.vitest);

const args = process.argv.slice(2);
const isProject = (a) => a.startsWith('--project=');
const projects = args.filter(isProject);
const common = args.filter((a) => !isProject(a));
const browser = projects.filter((a) => a === '--project=browser');
const rest = projects.filter((a) => a !== '--project=browser');

const overlap = async () => {
  if (!browser.length || !rest.length) return { ok: false };
  const forced = process.env.WEASEL_OVERLAP;
  if (forced === '0') return { ok: false };
  const room = roomToOverlap(await sampleLoad());
  if (forced === '1') return { ok: true, jsdomWorkers: room.jsdomWorkers };
  console.log(
    `vitest-overlap: ${room.reading}; ` +
      (room.ok ? `running the browser project beside ${room.jsdomWorkers} jsdom workers` : 'running it after the rest, in one process'),
  );
  return room;
};

const runs = [];
let browserEnv = {};
const room = await overlap();
if (!room.ok) runs.push(args);
else {
  const count = process.env.WEASEL_JSDOM_WORKERS || room.jsdomWorkers || '50%';
  const workers = common.some((a) => a.startsWith('--maxWorkers')) ? [] : [`--maxWorkers=${count}`];
  const shape = browserShape(cpus().length, process.env, { beside: true });
  // --passWithNoTests: a branch run can select no browser file at all.
  runs.push([...common, ...rest, ...workers], [...common, ...browser, '--passWithNoTests']);
  browserEnv = { WEASEL_BROWSER_CHROMIUMS: String(shape.chromiums), WEASEL_BROWSER_TABS: String(shape.tabs) };
}

// The protocol channel onto reads; run without onto, it is closed and stdout stands in, as the
// reporter itself does.
const emit = (line) => {
  try {
    writeSync(3, line + '\n');
  } catch {
    process.stdout.write('\n' + line + '\n');
  }
};

// The suite's last total belongs to the merged bar. A child told 1 reports the tests it has
// collected and skips its own estimate, which would otherwise overshoot that total.
const expected = Number(process.env.ONTO_EXPECT_TESTS) || 0;
const env = { ...process.env, ONTO_EXPECT_TESTS: expected ? '1' : '' };
const merge = mergeProgress(runs.length, expected);

const reports = mkdtempSync(join(tmpdir(), 'weasel-load-'));
const reportOf = (i) => join(reports, `${i}.json`);
const exited = (child) => new Promise((resolve) => child.on('close', (code, signal) => resolve(signal ? 1 : (code ?? 1))));

const children = runs.map((argv, i) => {
  const own = { ...(i === 1 ? { ...env, ...browserEnv } : env), WEASEL_LOAD_REPORT: reportOf(i) };
  const child = spawn(process.execPath, [VITEST, ...argv], { env: own, stdio: ['inherit', 'inherit', 'inherit', 'pipe'] });
  createInterface({ input: child.stdio[3] }).on('line', (text) => merge.line(i, text).forEach(emit));
  return child;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => children.forEach((c) => c.kill(signal)));

const codes = await Promise.all(children.map(exited));
merge.finish().forEach(emit);

// Files a macOS network change kept from loading run once more, and their run's verdict stands in for
// the first one's where nothing else failed (`scripts/lib/load-reruns.mjs`).
const readReport = (i) => {
  try {
    return JSON.parse(readFileSync(reportOf(i), 'utf8'));
  } catch {
    return null;
  }
};
const plan = rerunPlan(runs.map((_, i) => readReport(i)));
rmSync(reports, { recursive: true, force: true });
if (plan.files.length) {
  console.log(`\nvitest-overlap: the network changed and ${plan.files.length} file(s) loaded no tests; running them again:`);
  for (const f of plan.files) console.log(`  ${f}`);
  const again = spawn(process.execPath, [VITEST, ...args, ...plan.files], {
    env: { ...env, ...browserEnv, WEASEL_LOAD_REPORT: '' },
    stdio: ['inherit', 'inherit', 'inherit', 'ignore'],
  });
  children.push(again);
  for (const i of plan.settles) codes[i] = 0;
  codes.push(await exited(again));
}
process.exit(codes.find((c) => c !== 0) ?? 0);
