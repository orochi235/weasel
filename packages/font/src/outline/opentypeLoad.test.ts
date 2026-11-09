import { it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const state = vi.hoisted(() => ({ fail: true }));

vi.mock('opentype.js', async (importOriginal) => {
  if (state.fail) throw new Error('chunk failed to load');
  return importOriginal();
});

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

it.skipIf(!existsSync(INTER_TTF))('imports the parser again after an import that failed', async () => {
  const { openTypeParser } = await import('./opentypeParser');
  const buf = readFileSync(INTER_TTF);
  const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  await expect(openTypeParser(bytes)).rejects.toThrow();
  state.fail = false;
  const face = await openTypeParser(bytes);
  expect(face.unitsPerEm).toBeGreaterThan(0);
});
