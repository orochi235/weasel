/**
 * Smoke test for the repo-root `scripts/gen-font.ts`. Lives under this
 * package's `src/` (rather than next to the script) because `scripts/` isn't
 * covered by any vitest project — the `weasel-ui` project's include glob is
 * `packages/**\/*.test.{ts,tsx}`
 * (see `vitest.config.ts`). Runs the real script as a child process (bakes
 * an actual MSDF atlas), then round-trips the emitted JSON through
 * `parseBmFont`.
 *
 * Skipped when the fixture font isn't present (CI portability — the font
 * is a macOS system font, not vendored).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseBmFont } from './FontAtlas';

const FONT_PATH = '/System/Library/Fonts/Supplemental/Arial.ttf';
// packages/font/src -> repo root -> scripts/
const SCRIPT_PATH = resolve(__dirname, '../../../scripts/gen-font.ts');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe.skipIf(!existsSync(FONT_PATH))('gen-font.ts smoke test', () => {
  it(
    'bakes an ascii atlas from Arial and round-trips it through parseBmFont',
    () => {
      const outDir = mkdtempSync(join(tmpdir(), 'gen-font-smoke-'));
      try {
        execFileSync(
          'node',
          [SCRIPT_PATH, FONT_PATH, '--name', 'Smoke-400', '--out', outDir, '--size', '24', '--charset', 'ascii'],
          { stdio: 'pipe' },
        );

        const jsonPath = join(outDir, 'Smoke-400.json');
        const pngPath = join(outDir, 'Smoke-400.png');

        const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
        expect(raw.pages).toEqual(['Smoke-400.png']);

        const font = parseBmFont(raw);
        expect(font.chars.length).toBeGreaterThanOrEqual(95);

        expect(existsSync(pngPath)).toBe(true);
        const pngHead = readFileSync(pngPath).subarray(0, 8);
        expect(pngHead.equals(PNG_MAGIC)).toBe(true);
      } finally {
        rmSync(outDir, { recursive: true, force: true });
      }
    },
    20_000,
  );
});
