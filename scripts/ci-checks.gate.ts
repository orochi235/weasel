import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { CI_YML, readCi, sourceChecks } from './lib/ci-steps.mjs';
import { stepEnv } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = promisify(execFile);
const CHECK_ENV = stepEnv(process.env);

const output = (error: unknown) => {
  const { stdout, stderr } = error as { stdout?: string; stderr?: string };
  return `${stdout ?? ''}${stderr ?? ''}`.trim() || String(error);
};

/** The checks above ci.yml's first build. The ones after it read `dist`; `test:fleet:postbuild` runs them. */
describe('the checks ci.yml runs as steps', () => {
  const checks = sourceChecks(readCi(readFileSync(CI_YML, 'utf8')).steps);

  it('reads them from ci.yml', () => {
    const names = checks.map(([name]) => name);
    expect(names).toContain('typecheck');
    expect(names).toContain('lint');
    expect(names.filter((name) => name.startsWith('check:')).length).toBeGreaterThan(10);
  });

  // Concurrent, or typecheck, lint, and check:needs queue behind each other for five minutes.
  it.concurrent.each(checks.map((args) => [args.join(' '), args] as const))('npm run %s', async (_, args) => {
    try {
      await run('npm', ['run', '--silent', ...args], { cwd: ROOT, env: CHECK_ENV, encoding: 'utf8', maxBuffer: 1 << 26 });
    } catch (error) {
      expect.fail(output(error));
    }
  });
});
