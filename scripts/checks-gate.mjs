/**
 * Runs every check the gate runs (`scripts/ci-checks.gate.ts`): the typecheck, lint, `check:*` and
 * `audit:*` steps above ci.yml's first build, read from ci.yml, longest first, a few at once. Exits 1
 * when any fails, after printing each failure's output.
 *
 *   npm run checks:gate [-- --jobs 3]
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CI_YML, longestFirst, readCi, sourceChecks } from './lib/ci-steps.mjs';
import { stepEnv } from './lib/fleet-tree.mjs';

/** Runs `npm run <args>` and resolves `{ ok, output }`. */
const npmRun = (args, cwd) =>
  new Promise((done) => {
    const child = spawn('npm', ['run', '--silent', ...args], { cwd, env: stepEnv(process.env), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => done({ ok: false, output: String(error) }));
    child.on('close', (code, signal) => done({ ok: code === 0, output: `${output.trim()}\n(exit ${code ?? '?'}${signal ? `, signal ${signal}` : ''})` }));
  });

/**
 * Runs each of `checks` through `runOne`, at most `jobs` at once, calling `report` as each ends with its
 * position, and resolves the failures in the order they ended.
 */
export const runChecks = async (checks, { jobs, runOne, report = () => {} }) => {
  const failures = [];
  let next = 0;
  let ended = 0;
  const worker = async () => {
    while (next < checks.length) {
      const args = checks[next++];
      const started = Date.now();
      const result = await runOne(args);
      ended += 1;
      report({ args, ...result, at: ended, of: checks.length, ms: Date.now() - started });
      if (!result.ok) failures.push({ args, output: result.output });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, checks.length)) }, worker));
  return failures;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const jobsAt = process.argv.indexOf('--jobs');
  const jobs = jobsAt < 0 ? 3 : Number(process.argv[jobsAt + 1]);
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error('checks:gate: --jobs takes a whole number of at least 1');
  const checks = longestFirst(sourceChecks(readCi(readFileSync(CI_YML, 'utf8')).steps));
  const failures = await runChecks(checks, {
    jobs,
    runOne: (args) => npmRun(args, ROOT),
    report: ({ args, ok, at, of, ms }) =>
      console.log(`${ok ? 'pass' : 'FAIL'} ${String(at).padStart(String(of).length)}/${of} npm run ${args.join(' ')} (${(ms / 1000).toFixed(1).padStart(5)} s)`),
  });
  for (const { args, output } of failures) console.log(`\n--- npm run ${args.join(' ')}\n${output}`);
  console.log(failures.length ? `\nchecks:gate: ${failures.length} of ${checks.length} failed` : `\nchecks:gate: all ${checks.length} passed`);
  process.exitCode = failures.length ? 1 : 0;
}
