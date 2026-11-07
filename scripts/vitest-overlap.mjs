#!/usr/bin/env node
// vitest with the `browser` project in a process of its own, running beside the rest instead of
// after it: one vitest process runs its sequence groups one after another, so `groupOrder: 1`
// alone would leave the browser project waiting for every jsdom file. Takes vitest's own arguments.
//
// The other process gets the node's idle cores less the browser project's reserve
// (`scripts/lib/node-load.mjs`); WEASEL_JSDOM_WORKERS overrides the count, and WEASEL_OVERLAP=1 or 0
// skips the check.
import { spawn } from 'node:child_process';
import { writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { mergeProgress } from './lib/merge-progress.mjs';
import { roomToOverlap, sampleLoad } from './lib/node-load.mjs';

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
const room = await overlap();
if (!room.ok) runs.push(args);
else {
  const count = process.env.WEASEL_JSDOM_WORKERS || room.jsdomWorkers || '50%';
  const workers = common.some((a) => a.startsWith('--maxWorkers')) ? [] : [`--maxWorkers=${count}`];
  // --passWithNoTests: a branch run can select no browser file at all.
  runs.push([...common, ...rest, ...workers], [...common, ...browser, '--passWithNoTests']);
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

const children = runs.map((argv, i) => {
  const child = spawn(process.execPath, [VITEST, ...argv], { env, stdio: ['inherit', 'inherit', 'inherit', 'pipe'] });
  createInterface({ input: child.stdio[3] }).on('line', (text) => merge.line(i, text).forEach(emit));
  return child;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => children.forEach((c) => c.kill(signal)));

const codes = await Promise.all(
  children.map((c) => new Promise((resolve) => c.on('close', (code, signal) => resolve(signal ? 1 : (code ?? 1))))),
);
merge.finish().forEach(emit);
process.exit(codes.find((c) => c !== 0) ?? 0);
