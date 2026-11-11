/**
 * Property test of text written in an embedded face: for any text, size, style, and placement the file
 * is well-formed, and the codes it draws read back, through the face's `/ToUnicode`, as the text's
 * characters in order, spaces aside.
 */
import { loadFontOutlines, registerFontOutlines } from '@weasel-js/font';
import { _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import type { TextDrawCommand } from '@weasel-js/renderer';
import type { ResolvedRun } from '@weasel-js/text';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registryFontSource } from './fonts/fontSource';
import { checkPdf } from './pdfCheck.fixture';
import { isDict, type Name, readContent, type Ref, Str, type Value } from './pdfReader.fixture';
import { runs, stroke, tally, timeoutFor } from './pbt.fixture';
import { writePdf } from './writePdf';

const RUNS = 60;
const FAMILY = 'pdf-pbt-text';

beforeAll(async () => {
  const buf = readFileSync(resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf'));
  const ttf = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ttf).set(buf);
  // Inter stands in for its own italic: an outline style or weight with no face of its own draws nothing.
  for (const style of ['normal', 'italic'] as const) {
    registerFontOutlines(FAMILY, { style }, ttf.slice(0));
    await loadFontOutlines(FAMILY, { style });
  }
});
afterAll(() => {
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

const latin = fc.string({ unit: fc.constantFrom(...'abcXYZ019 .,;()\\-%/éßøÆ'), minLength: 1, maxLength: 16 });

const run = (text: string, over: Partial<ResolvedRun>): ResolvedRun => ({
  text, fontFamily: FAMILY, fontSize: 12, fontWeight: 400, fontStyle: 'normal', fill: { paint: { color: '#000' } },
  letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0, ...over,
});

const textCmd: fc.Arbitrary<{ cmd: TextDrawCommand; text: string }> = fc
  .record({
    parts: fc.array(
      fc.record({
        text: latin,
        fontSize: fc.oneof(fc.double({ min: 1, max: 80, noNaN: true }), fc.constantFrom(0.001, 0.05, 1e4)),
        fontStyle: fc.constantFrom('normal' as const, 'italic' as const),
        letterSpacing: fc.double({ min: -2, max: 5, noNaN: true }),
        color: fc.constantFrom('#000000', '#336699', 'red'),
        // Thin and undashed: a dashed round-capped outline of a whole line is a slow union (docs/PERF.md).
        stroke: fc.option(stroke().map(({ dash: _d, ...st }) => ({ ...st, width: typeof st.width === 'number' ? Math.min(st.width, 2) : st.width })), { nil: undefined }),
        underline: fc.boolean(),
        baselineShift: fc.double({ min: -5, max: 5, noNaN: true }),
        lang: fc.constantFrom(undefined, 'en', 'fr'),
      }),
      { minLength: 1, maxLength: 3 },
    ),
    x: fc.double({ min: -50, max: 250, noNaN: true }),
    y: fc.double({ min: -50, max: 250, noNaN: true }),
  })
  .map(({ parts, x, y }) => ({
    text: parts.map((p) => p.text).join(''),
    cmd: {
      kind: 'text',
      x,
      y,
      style: { fontFamily: FAMILY, fontSize: 12 },
      runs: parts.map(({ color, stroke: s, ...p }) => run(p.text, { ...p, fill: { paint: { color } }, ...(s && { stroke: s }) })),
    },
  }));

/** The ToUnicode of each font, code to text. */
function readings(pdf: ReturnType<typeof checkPdf>['pdf']): Map<string, Map<number, string>> {
  const out = new Map<string, Map<number, string>>();
  for (const [id, o] of pdf.objects) {
    const v = o.value;
    if (!isDict(v) || (v.Subtype as Name | undefined)?.value !== 'Type0') continue;
    const cmap = String.fromCharCode(...pdf.objects.get((v.ToUnicode as Ref).id)!.stream!.data);
    const m = new Map<number, string>();
    for (const e of cmap.matchAll(/^<([0-9A-F]{4})> <([0-9A-F]+)>$/gm)) {
      m.set(parseInt(e[1]!, 16), String.fromCharCode(...e[2]!.match(/..../g)!.map((h) => parseInt(h, 16))));
    }
    out.set(String(id), m);
  }
  return out;
}

describe('writeText', () => {
  it('writes text that reads back, through ToUnicode, as its characters in order', async () => {
    const seen = tally();
    await fc.assert(
      fc.asyncProperty(textCmd, async ({ cmd, text }) => {
        const { bytes } = await writePdf([{ width: 300, height: 200, commands: [cmd] }], { fonts: registryFontSource, compress: false });
        const { pdf } = checkPdf(bytes);
        const maps = readings(pdf);
        const page = [...pdf.objects.values()].find((o) => isDict(o.value) && (o.value.Type as Name | undefined)?.value === 'Page')!.value as Record<string, Value>;
        const fonts = (page.Resources as Record<string, Value>).Font as Record<string, Ref> | undefined;
        const content = String.fromCharCode(...pdf.objects.get((page.Contents as Ref).id)!.stream!.data);
        let font: Map<number, string> | undefined;
        let read = '';
        for (const { op, args } of readContent(Uint8Array.from(content, (c) => c.charCodeAt(0)))) {
          if (op === 'Tf') font = maps.get(String(fonts![(args[0] as Name).value]!.id));
          if (op !== 'TJ') continue;
          for (const part of args[0] as Value[]) {
            if (!(part instanceof Str)) continue;
            for (let i = 0; i + 1 < part.bytes.length; i += 2) read += font!.get((part.bytes[i]! << 8) | part.bytes[i + 1]!) ?? '�';
          }
        }
        const visible = (s: string) => s.replace(/[\s⁠]/g, '');
        expect(visible(read)).toBe(visible(text));
        seen.count(fonts ? 'embedded' : 'none');
      }),
      runs(RUNS),
    );
    seen.atLeast('embedded', 20);
  }, timeoutFor(RUNS, 500));
});
