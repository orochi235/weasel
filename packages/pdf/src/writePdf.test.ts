import { loadFontOutlines, registerFontOutlines } from '@weasel-js/font';
import { _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { registryFontSource } from './fonts/fontSource';
import { latin1 } from './latin1';
import { NO_FONTS } from './testing/noFonts';
import { writePdf, writePdfWith } from './writePdf';

describe('writePdf', () => {
  it('writes one page per input page, each its own size', async () => {
    const { bytes } = await writePdf(
      [
        { width: 150, height: 75, commands: [] },
        { width: 75, height: 150, commands: [] },
      ],
      { fonts: NO_FONTS, compress: false },
    );
    const s = latin1(bytes);
    expect(s.startsWith('%PDF-1.7')).toBe(true);
    expect(s.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(s).toContain('/MediaBox [0 0 150 75]');
    expect(s).toContain('/MediaBox [0 0 75 150]');
    expect(s).toContain('1 0 0 -1 0 75 cm');
  });

  it('compresses streams with the injected deflater and marks them FlateDecode', async () => {
    const { bytes } = await writePdfWith(
      [{ width: 10, height: 10, commands: [] }],
      { fonts: NO_FONTS },
      async () => Uint8Array.of(65, 66, 67),
    );
    const s = latin1(bytes);
    expect(s).toContain('/Filter /FlateDecode /Length 3>>\nstream\nABC\nendstream');
  });

  it('puts the title in the info dictionary', async () => {
    const { bytes } = await writePdf([{ width: 10, height: 10, commands: [] }], {
      fonts: NO_FONTS,
      compress: false,
      title: 'Chart',
    });
    expect(latin1(bytes)).toContain('/Title (Chart)');
  });

  it('refuses an empty page list', async () => {
    await expect(writePdf([], { fonts: NO_FONTS, compress: false })).rejects.toThrow('pdf: a document needs at least one page');
  });
});

describe('writePdf with an embedded face', () => {
  afterEach(() => {
    _resetFontOutlinesForTests();
    _resetLayoutCacheForTests();
  });

  it('writes a one-line page in a fraction of the bytes the whole face takes', async () => {
    const buf = readFileSync(resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf'));
    const ttf = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ttf).set(buf);
    registerFontOutlines('pdf-size', {}, ttf);
    await loadFontOutlines('pdf-size', {});
    const line: TextDrawCommand = {
      kind: 'text', x: 10, y: 30, style: { fontFamily: 'pdf-size', fontSize: 12 },
      runs: [{
        text: 'Quarterly revenue by region', fontFamily: 'pdf-size', fontSize: 12, fontWeight: 400, fontStyle: 'normal',
        fill: { paint: { color: '#000000' } }, letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
    };
    const size = async (subsetFonts: boolean) => {
      const { bytes, skipped } = await writePdfWith(
        [{ width: 300, height: 60, commands: [line] }],
        { fonts: registryFontSource, subsetFonts },
        async (d) => new Uint8Array(deflateSync(d)),
      );
      expect(skipped).toEqual([]);
      expect(latin1(bytes)).toContain('/FontFile2');
      return bytes.byteLength;
    };
    const whole = await size(false);
    const subset = await size(true);
    expect(whole).toBeGreaterThan(ttf.byteLength / 2);
    expect(subset).toBeLessThan(whole / 4);
    expect(subset).toBeLessThan(5000);
  });
});
