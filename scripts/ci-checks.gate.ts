import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { COMMIT_ENV } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = promisify(execFile);
// A check that starts vitest itself (check:test-projects) would otherwise inherit a branch run's selection.
const { [COMMIT_ENV]: _selected, ...CHECK_ENV } = process.env;
const CHECK = /^\s*-\s*run:\s*npm run ((?:check:[\w-]+|audit:[\w-]+|typecheck|lint)\b.*?)\s*$/;

const BUILD = /^\s*-\s*run:\s*npm run build\b/;

/**
 * The typecheck, lint, and `check:*` steps of ci.yml that run on source, each as the arguments
 * after `npm run`. The ones after its first build step read `dist`, which a fleet node has not built.
 */
const ciChecks = (): string[][] => {
  const lines = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').split('\n');
  const built = lines.findIndex((line) => BUILD.test(line));
  return lines.slice(0, built < 0 ? undefined : built).flatMap((line) => {
    const command = CHECK.exec(line)?.[1];
    return command ? [command.split(/\s+/)] : [];
  });
};

const output = (error: unknown) => {
  const { stdout, stderr } = error as { stdout?: string; stderr?: string };
  return `${stdout ?? ''}${stderr ?? ''}`.trim() || String(error);
};

describe('the checks ci.yml runs as steps', () => {
  const checks = ciChecks();

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
