import { loadFontOutlines, registerFontOutlines, unregisterFontOutlines } from '@weasel-js/font';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { latin1 } from '../latin1';
import { writePdf } from '../writePdf';
import { registryFontSource } from './fontSource';
import { checkTrueType } from './subset';

const buf = readFileSync(resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf'));
const INTER = new Uint8Array(buf).slice().buffer;

function tableAt(sfnt: ArrayBuffer, tag: string): number {
  const v = new DataView(sfnt);
  for (let i = 0; i < v.getUint16(4); i++) {
    if (String.fromCharCode(...new Uint8Array(sfnt, 12 + i * 16, 4)) === tag) return v.getUint32(12 + i * 16 + 8);
  }
  throw new Error(`no ${tag}`);
}

/** Inter with one 16-bit field of `tag` set to `value`. */
function withField(tag: string, at: number, value: number): ArrayBuffer {
  const out = INTER.slice(0);
  new DataView(out).setUint16(tableAt(out, tag) + at, value);
  return out;
}

async function draw(sfnt: ArrayBuffer, family: string) {
  registerFontOutlines(family, {}, sfnt);
  try {
    await loadFontOutlines(family, {});
    const cmd: TextDrawCommand = {
      kind: 'text', x: 5, y: 20,
      runs: [{
        text: 'a', fontFamily: family, fontSize: 12, fontWeight: 400, fontStyle: 'normal', fill: { paint: { color: '#000' } },
        letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
      }],
    };
    return await writePdf([{ width: 100, height: 40, commands: [cmd] }], { fonts: registryFontSource, compress: false });
  } finally {
    unregisterFontOutlines(family, {});
  }
}

afterAll(() => _resetLayoutCacheForTests());

// Shrunk from `subset.pbt.test.ts` (2026-11-11).
describe('a TrueType face the subsetter cannot read, shrunk counterexamples', () => {
  it('draws text in a face with no horizontal metrics as outlines, rather than failing the file', async () => {
    const sfnt = withField('hhea', 34, 0);
    expect(() => checkTrueType(sfnt)).toThrow('pdf: a TrueType face\'s metric count 0 is outside 1..');
    const { bytes } = await draw(sfnt, 'pdf-shrunk-no-metrics');
    expect(latin1(bytes)).not.toContain('/FontFile2');
  });

  it('draws text in a face whose glyph count runs past its loca table as outlines', async () => {
    const sfnt = withField('maxp', 4, 0xffff);
    expect(() => checkTrueType(sfnt)).toThrow(/^pdf: /);
    const { bytes } = await draw(sfnt, 'pdf-shrunk-glyph-count');
    expect(latin1(bytes)).not.toContain('/FontFile2');
  });

  it('still embeds a face whose dropped tables lie past its end', async () => {
    const sfnt = INTER.slice(0);
    const v = new DataView(sfnt);
    for (let i = 0; i < v.getUint16(4); i++) {
      if (String.fromCharCode(...new Uint8Array(sfnt, 12 + i * 16, 4)) === 'gasp') v.setUint32(12 + i * 16 + 8, sfnt.byteLength);
    }
    expect(() => checkTrueType(sfnt)).not.toThrow();
    const { bytes } = await draw(sfnt, 'pdf-shrunk-gasp');
    expect(latin1(bytes)).toContain('/FontFile2');
  });
});
