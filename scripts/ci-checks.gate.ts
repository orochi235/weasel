import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, inject, it } from 'vitest';
import { CI_YML, readCi, sourceChecks } from './lib/ci-steps.mjs';
import type { BranchChanges } from './lib/fleet-tree.mjs';
import { stepEnv } from './lib/fleet-tree.mjs';
import { skipReason } from './lib/gate-inputs.mjs';

declare module 'vitest' {
  export interface ProvidedContext {
    /** What a branch run changes, from `vitest.config.ts`; null when the run tests everything. */
    gateChanges: BranchChanges | null;
  }
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = promisify(execFile);
const CHECK_ENV = stepEnv(process.env);
/** By their times in a full run on `main` (2026-10-29): typecheck 97 s, check:needs 59, forge-stories 28. */
const LONGEST_FIRST = ['typecheck', 'check:needs', 'check:forge-stories', 'check:first-publish', 'audit:jsdoc', 'check:test-projects'];

const output = (error: unknown) => {
  const { stdout, stderr } = error as { stdout?: string; stderr?: string };
  return `${stdout ?? ''}${stderr ?? ''}`.trim() || String(error);
};

/** The checks above ci.yml's first build. The ones after it read `dist`; `test:fleet:postbuild` runs them. */
describe('the checks ci.yml runs as steps', () => {
  const checks = sourceChecks(readCi(readFileSync(CI_YML, 'utf8')).steps);
  const changes = inject('gateChanges');

  it('reads them from ci.yml', () => {
    const names = checks.map(([name]) => name);
    expect(names).toContain('typecheck');
    expect(names).toContain('lint');
    expect(names.filter((name) => name.startsWith('check:')).length).toBeGreaterThan(10);
  });

  // Concurrent, or typecheck, lint, and check:needs queue behind each other for five minutes. Only
  // `maxConcurrency` start at once, in this order, so the longest go first: ci.yml's order had
  // typecheck, the longest by far, starting about 20 s late (gate 117 s, typecheck 97 s, 2026-10-29).
  const order = (name: string) => {
    const at = LONGEST_FIRST.indexOf(name);
    return at < 0 ? LONGEST_FIRST.length : at;
  };
  for (const args of [...checks].sort((a, b) => order(a[0]) - order(b[0]))) {
    const skip = skipReason(args[0], changes);
    if (skip) console.log(`gate: skipped npm run ${args[0]}: ${skip}`);
    // Concurrent when skipped too: vitest runs each unbroken run of concurrent tests as one batch, so
    // a plain skip between two checks makes the second wait for the first to end.
    (skip ? it.concurrent.skip : it.concurrent)(`npm run ${args.join(' ')}`, async () => {
      try {
        await run('npm', ['run', '--silent', ...args], { cwd: ROOT, env: CHECK_ENV, encoding: 'utf8', maxBuffer: 1 << 26 });
      } catch (error) {
        expect.fail(output(error));
      }
    });
  }
});
