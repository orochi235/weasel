import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '../..');
const FILES = ['tokens.css', 'themes.ts', 'manifest.ts'];

describe('generated output', () => {
  it('is exactly what the generator produces from the current source', () => {
    const before = FILES.map((f) => readFileSync(resolve(here, f), 'utf8'));
    execFileSync('npm', ['run', '--silent', 'gen:tokens'], { cwd: pkgRoot, stdio: 'pipe' });
    const after = FILES.map((f) => readFileSync(resolve(here, f), 'utf8'));

    for (const [i, name] of FILES.entries()) {
      expect(
        after[i],
        `${name} is stale — run \`npm run gen:tokens -w @weasel-js/theme\` and commit`,
      ).toBe(before[i]);
    }
  });
});
