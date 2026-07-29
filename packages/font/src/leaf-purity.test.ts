import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `@weasel-js/font` is a Tier A leaf: core depends on it, never the reverse.
 * A reach-back would be a dependency cycle that the bundler resolves by
 * duplicating a module — and a duplicated font registry renders no glyphs at
 * all. Assert it structurally rather than trusting review.
 *
 * Scoped to `src/` only, not `scripts/`: `scripts/gen-font.ts` is a
 * build-time CLI (see `genFontSmoke.test.ts`), not part of the published
 * package (`files` in package.json is `["dist", "README.md", "LICENSE"]`)
 * and not bundled by tsup into `dist/` — so it can't trigger the
 * bundler-duplication failure mode this test guards against.
 */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

describe('leaf purity', () => {
  it('imports nothing from @weasel-js/core or core-internal aliases', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(import.meta.dirname, '.'))) {
      const src = readFileSync(file, 'utf8');
      // Bare `@weasel-js/core`, and core's internal path aliases
      // (`core/...`, `features/...`, `affordances/...`) which resolve only
      // inside core's tsconfig.
      if (/from ['"]@weasel-js\/core/.test(src) ||
          /from ['"](core|features|affordances)\//.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
