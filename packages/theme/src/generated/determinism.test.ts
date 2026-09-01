import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '../..');
const FILES = ['tokens.css', 'themes.ts', 'manifest.ts'];

describe('generated output', () => {
  it('is exactly what the generator produces from the current source', () => {
    // Generate into a temp dir rather than over the committed files: the rest
    // of the suite imports them, and rewriting them mid-run is a race even
    // when the bytes come out identical.
    const out = mkdtempSync(resolve(tmpdir(), 'wzl-tokens-'));
    try {
      execFileSync('npm', ['run', '--silent', 'gen:tokens'], {
        cwd: pkgRoot,
        stdio: 'pipe',
        env: { ...process.env, WZL_TOKENS_OUT_DIR: out },
      });

      for (const name of FILES) {
        expect(
          readFileSync(resolve(out, name), 'utf8'),
          `${name} is stale — run \`npm run gen:tokens -w @weasel-js/theme\` and commit`,
        ).toBe(readFileSync(resolve(here, name), 'utf8'));
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
