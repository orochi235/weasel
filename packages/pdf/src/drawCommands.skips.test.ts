import { loadFontOutlines, registerFontOutlines } from '@weasel-js/font';
import { _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type PdfFontSource, registryFontSource } from './fonts/fontSource';
import { writePdf } from './writePdf';

const INTER_TTF = resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf');

async function registerInter(family: string): Promise<void> {
  const buf = readFileSync(INTER_TTF);
  // Built in this test's realm: the registry's `instanceof ArrayBuffer` rejects Node's.
  const bytes = new ArrayBuffer(buf.byteLength);
  new Uint8Array(bytes).set(buf);
  registerFontOutlines(family, {}, bytes);
  await loadFontOutlines(family, {});
}

afterEach(() => {
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

const run = (text: string, fontFamily: string): TextDrawCommand['runs'][number] => ({
  text, fontFamily, fontSize: 20, fontWeight: 400, fontStyle: 'normal',
  fill: { paint: { color: '#000000' } }, letterSpacing: 0,
  underline: false, strikethrough: false, overline: false, baselineShift: 0,
});

/** A run in a face that fails to embed, drawn as outlines, then one in a face that embeds. */
const text = (x: number): TextDrawCommand => ({
  kind: 'text', x, y: 30,
  runs: [run('Hi', 'pdf-skip-broken'), run('Yo', 'pdf-skip-fine')],
  style: { fontFamily: 'pdf-skip-fine', fontSize: 20 },
});

describe('a command dropped for a non-finite number', () => {
  it('keeps the skip of a face that failed to embed while it was being written', async () => {
    await registerInter('pdf-skip-broken');
    await registerInter('pdf-skip-fine');
    const throwing: PdfFontSource = {
      ...registryFontSource,
      embedding: async (family, weight, style) => {
        if (family === 'pdf-skip-broken') throw new Error('network down');
        return registryFontSource.embedding(family, weight, style);
      },
    };
    const { skipped } = await writePdf(
      [{ width: 200, height: 100, commands: [text(NaN), text(10)] }],
      { fonts: throwing, compress: false },
    );
    const fonts = skipped.filter((s) => s.kind === 'font');
    expect(fonts).toHaveLength(1);
    expect(fonts[0]!.detail).toContain('network down');
    expect(skipped.some((s) => s.kind === 'command')).toBe(true);
  });
});
