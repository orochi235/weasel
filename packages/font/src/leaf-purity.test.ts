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
/**
 * Core's internal path aliases, derived from the root tsconfig rather than
 * hand-listed — `packages/font/tsconfig.json` extends root without overriding
 * `paths`, so every one of them resolves inside this package and every one is
 * a reach-back this guard must catch. Hand-listing them is how you end up
 * checking three of seven.
 */
const CORE_ALIASES = (() => {
  const root = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../tsconfig.json'), 'utf8')
      .replace(/^\s*\/\/.*$/gm, ''),   // tsconfig allows comments; JSON.parse does not
  );
  const names = Object.keys(root.compilerOptions.paths)
    .filter((k) => k.endsWith('/*') && !k.startsWith('@'))
    .map((k) => k.slice(0, -2));
  return new RegExp(`from ['"](${names.join('|')})/`);
})();

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
      // Bare `@weasel-js/core`, and core's internal path aliases.
      if (/from ['"]@weasel-js\/core/.test(src) || CORE_ALIASES.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders, '@weasel-js/font is a Tier A leaf and must not import core — a reach-back is a cycle the bundler resolves by duplicating the font registry, which renders no glyphs at all').toEqual([]);
  });
});
