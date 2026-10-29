// @vitest-environment node
/**
 * Text a shaper shaped, exported as the glyphs it shaped: Arabic and Devanagari in subsets of
 * Noto Sans (`packages/text-shaping/src/__fixtures__`), read back by pdf.js.
 */
import { loadFontOutlines, registerFontOutlines, unregisterFontOutlines } from '@weasel-js/font';
import { bidi } from '@weasel-js/bidi';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { loadShaper, type Shaper } from '@weasel-js/text-shaping';
import { registerBidi, registerShaper, type ResolvedRun } from '@weasel-js/text';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type PdfFontSource, registryFontSource } from './fonts/fontSource';
import { latin1 } from './latin1';
import { writePdf } from './writePdf';

const FIXTURES = resolve(import.meta.dirname, '../../text-shaping/src/__fixtures__');
const SIZE = 40;

function fixture(file: string): ArrayBuffer {
  const buf = readFileSync(`${FIXTURES}/${file}`);
  // Built in this test's realm: the registry's `instanceof ArrayBuffer` rejects Node's.
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

const ARABIC = fixture('noto-sans-arabic-subset.ttf');
const DEVANAGARI = fixture('noto-sans-devanagari-subset.ttf');
const FACES = [['pdf-shaped-ar', ARABIC], ['pdf-shaped-deva', DEVANAGARI]] as const;

let shaper: Shaper;
let unregister: () => void;
let unregisterBidi: () => void;
beforeAll(async () => {
  shaper = await loadShaper();
  unregister = registerShaper(shaper);
  unregisterBidi = registerBidi(bidi);
  for (const [family, bytes] of FACES) {
    registerFontOutlines(family, {}, bytes);
    await loadFontOutlines(family, {});
  }
});
afterAll(() => {
  unregister();
  unregisterBidi();
  for (const [family] of FACES) unregisterFontOutlines(family, {});
});
beforeEach(() => _resetLayoutCacheForTests());

function textCmd(text: string, family: string): TextDrawCommand {
  const run: ResolvedRun = {
    text, fontFamily: family, fontSize: SIZE, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { color: '#000000' } }, letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
  };
  return { kind: 'text', x: 10, y: 60, runs: [run], style: { fontFamily: family, fontSize: SIZE } };
}

async function render(text: string, family: string, fonts: PdfFontSource = registryFontSource) {
  const { bytes, skipped } = await writePdf([{ width: 300, height: 100, commands: [textCmd(text, family)] }], {
    fonts, compress: false,
  });
  const s = latin1(bytes);
  const content = s.slice(s.indexOf('stream\n') + 7, s.indexOf('\nendstream'));
  return { bytes, s, content, skipped };
}

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

/** Every glyph id the page's text objects draw, in content order. */
const drawnGids = (content: string): string[] =>
  [...content.matchAll(/^\[(.*)\] TJ$/gm)].flatMap((m) => [...m[1].matchAll(/<([0-9A-F]+)>/g)].flatMap((h) => h[1].match(/.{4}/g)!));

/** The text pdf.js reads back from the page. */
async function extracted(bytes: Uint8Array): Promise<string> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    const page = await (await task.promise).getPage(1);
    return (await page.getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join('');
  } finally {
    await task.destroy();
  }
}

// pdf.js reads `/ToUnicode` and ignores `/ActualText`, so it is asked only about clusters of one glyph.
describe('writePdf with a shaper', () => {
  it('draws the conjunct क्ष as the one glyph the shaper formed, and reads it back as its three code points', async () => {
    const [conjunct] = shaper.shape(DEVANAGARI, 'क्ष');
    const { bytes, s, content, skipped } = await render('क्ष', 'pdf-shaped-deva');
    expect(skipped).toEqual([]);
    expect(drawnGids(content)).toEqual([hex4(conjunct.gid)]);
    expect(s).toContain(`<${hex4(conjunct.gid)}> <0915094D0937>`);
    expect(content).not.toContain('ActualText');
    expect(await extracted(bytes)).toBe('क्ष');
  });

  it('draws the i-matra before its consonant, and marks the pair with its text', async () => {
    const glyphs = shaper.shape(DEVANAGARI, 'कि');
    const { content } = await render('कि', 'pdf-shaped-deva');
    expect(drawnGids(content)).toEqual(glyphs.map((g) => hex4(g.gid)));
    // UTF-16BE of कि.
    expect(content).toMatch(/\/Span <<\/ActualText <FEFF0915093F>>> BDC\n\[[^\n]*\] TJ\nEMC/);
  });

  it('draws Arabic in its joining forms, and marks each letter with its text and its dots with none', async () => {
    const shaped = shaper.shape(ARABIC, 'بت');
    const { s, content, skipped } = await render('بت', 'pdf-shaped-ar');
    expect(skipped).toEqual([]);
    expect(drawnGids(content).sort()).toEqual(shaped.map((g) => hex4(g.gid)).sort());
    // Each letter is a dotless body on the baseline and its dots set off it. Teh's body is
    // beh's, so `/ToUnicode` cannot tell them apart: each body carries its letter in a span.
    expect(content).toMatch(/<FEFF0628>>> BDC\n(?:[-\d.]+ Ts\n)?\[[^\n]*\] TJ\nEMC\n\/Span <<\/ActualText <>>> BDC/);
    expect(content).toMatch(/<FEFF062A>>> BDC\n(?:[-\d.]+ Ts\n)?\[[^\n]*\] TJ\nEMC\n\/Span <<\/ActualText <>>> BDC/);
    // The dots, drawn first, claim the letters; the shared body claims nothing.
    const [dotBeh, body] = shaped;
    expect(s).toContain(`<${hex4(dotBeh.gid)}> <0628>`);
    expect(s).not.toMatch(new RegExp(`^<${hex4(body.gid)}> `, 'm'));
  });

  it('sets a mark where the shaper put it with Ts, and lowers it back after', async () => {
    const fatha = shaper.shape(ARABIC, 'بَب').find((g) => g.cluster === 1)!;
    const { content } = await render('بَب', 'pdf-shaped-ar');
    const rises = [...content.matchAll(/^(-?[\d.]+) Ts$/gm)].map((m) => Number(m[1]));
    expect(rises).toContain(Number((-fatha.dy).toFixed(4)));
    expect(rises.at(-1)).toBe(0);
    expect(drawnGids(content)).toContain(hex4(fatha.gid));
  });

  it('draws a face it cannot embed from its shaped outlines, once a cluster', async () => {
    const { content, skipped } = await render('क्ष', 'pdf-shaped-deva', { ...registryFontSource, embedding: async () => null });
    expect(skipped).toEqual([]);
    expect(content).not.toContain('TJ');
    expect([...content.matchAll(/^f$/gm)]).toHaveLength(1);
  });
});
