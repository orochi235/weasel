import { it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// opentype.js 1.x's `toPathData` takes a bare precision, so 2.x's options object formats every
// coordinate with `toFixed(NaN)` and each glyph comes out a whole-em box. A broken install that
// resolved the root's hoisted 1.3.4 drew exactly that (2026-11-16).
vi.mock('opentype.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('opentype.js')>();
  class Path1x extends real.Path {
    toPathData(decimalPlaces?: unknown): string {
      const places = typeof decimalPlaces === 'number' ? decimalPlaces : Number(decimalPlaces);
      return super.toPathData({ decimalPlaces: Number.isNaN(places) ? 0 : places, optimize: false, flipY: false } as never);
    }
  }
  return { ...real, Path: Path1x, default: { ...real, Path: Path1x } };
});

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

it.skipIf(!existsSync(INTER_TTF))('refuses an opentype.js whose toPathData ignores its options', async () => {
  const { openTypeParser } = await import('./opentypeParser');
  const buf = readFileSync(INTER_TTF);
  const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  await expect(openTypeParser(bytes)).rejects.toThrow(/opentype\.js 2/);
});
