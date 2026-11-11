/**
 * Property tests of text beyond Latin: any code points, astral, combining, lone surrogates, controls,
 * and noncharacters included, write a well-formed file whose codes read back, through `/ToUnicode`, as
 * the text less what the writer reported it could not draw and what never inks; and runs in several
 * languages are marked as spans of each language that is not the document's, under a catalog `/Lang`
 * that is the one asked for or the one every run shares.
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
import { isDict, type Name, readContent, type Ref, Str, textOf, type Value } from './pdfReader.fixture';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { writePdf } from './writePdf';

const RUNS = 80;
/** Families named like `Object.prototype` members, beside a plain one. */
const FAMILIES = ['pdf-pbt-unicode', '__proto__', 'constructor', 'toString'];

beforeAll(async () => {
  const buf = readFileSync(resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf'));
  for (const family of FAMILIES) {
    registerFontOutlines(family, {}, new Uint8Array(buf).slice().buffer);
    await loadFontOutlines(family, {});
  }
});
afterAll(() => {
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

const STYLE = { fontFamily: FAMILIES[0]!, fontSize: 12 };

const run = (text: string, over: Partial<ResolvedRun>): ResolvedRun => ({
  text, fontFamily: FAMILIES[0]!, fontSize: 12, fontWeight: 400, fontStyle: 'normal', fill: { paint: { color: '#000' } },
  letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0, ...over,
});

type Pdf = ReturnType<typeof checkPdf>['pdf'];

function page(pdf: Pdf): Record<string, Value> {
  return [...pdf.objects.values()].find((o) => isDict(o.value) && (o.value.Type as Name | undefined)?.value === 'Page')!.value as Record<string, Value>;
}

/** The page's content as text, read through each font's `/ToUnicode`, and the `/Lang` of the span each piece is in. */
function readBack(pdf: Pdf): { text: string; pieces: { text: string; lang: string | undefined }[] } {
  const maps = new Map<number, Map<number, string>>();
  for (const [id, o] of pdf.objects) {
    if (!isDict(o.value) || (o.value.Subtype as Name | undefined)?.value !== 'Type0') continue;
    const cmap = String.fromCharCode(...pdf.objects.get((o.value.ToUnicode as Ref).id)!.stream!.data);
    const m = new Map<number, string>();
    for (const e of cmap.matchAll(/^<([0-9A-F]{4})> <([0-9A-F]+)>$/gm)) m.set(parseInt(e[1]!, 16), String.fromCharCode(...e[2]!.match(/..../g)!.map((h) => parseInt(h, 16))));
    maps.set(id, m);
  }
  const p = page(pdf);
  const fonts = (p.Resources as Record<string, Value>).Font as Record<string, Ref> | undefined;
  let font: Map<number, string> | undefined;
  const spans: (string | undefined)[] = [];
  const pieces: { text: string; lang: string | undefined }[] = [];
  for (const { op, args } of readContent(pdf.objects.get((p.Contents as Ref).id)!.stream!.data)) {
    if (op === 'BDC') spans.push(textOf((args[1] as Record<string, Value>).Lang as Str));
    if (op === 'EMC') spans.pop();
    if (op === 'Tf') font = maps.get(fonts![(args[0] as Name).value]!.id);
    if (op !== 'TJ') continue;
    let read = '';
    for (const part of args[0] as Value[]) {
      if (!(part instanceof Str)) continue;
      for (let i = 0; i + 1 < part.bytes.length; i += 2) read += font!.get((part.bytes[i]! << 8) | part.bytes[i + 1]!) ?? '�';
    }
    pieces.push({ text: read, lang: spans.at(-1) });
  }
  expect(spans).toEqual([]);
  return { text: pieces.map((x) => x.text).join(''), pieces };
}

/** What reads as nothing: white space, the word joiner a mark-only code reads as, and default-ignorable code points. */
const visible = (s: string) => s.replace(/[\s\p{Default_Ignorable_Code_Point}]/gu, '');

const unit = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom('a', 'Z', '0', 'é', 'ß', 'Æ', 'ﬁ', '€', '(', ')', '\\', '%', '#', ' ') },
  { weight: 2, arbitrary: fc.constantFrom('é', '́', '̣̈', 'Ω', 'Ж', 'ø', ' ', '‍', '⁠', '﻿') },
  { weight: 1, arbitrary: fc.constantFrom('😀', '👍🏽', '𝔸', '\ud800', '\udfff', '\0', '\u0007', '\t', '￿', '￾', 'א', 'ب', '中') },
  { weight: 1, arbitrary: fc.string({ unit: 'binary', minLength: 1, maxLength: 2 }) },
);

describe('text beyond Latin', () => {
  it('reads back through ToUnicode as its text, less what was reported undrawn and what never inks', async () => {
    const seen = tally();
    const parts = fc.array(
      fc.record({ text: fc.array(unit, { minLength: 1, maxLength: 10 }).map((u) => u.join('')), family: fc.constantFrom(...FAMILIES) }),
      { minLength: 1, maxLength: 3 },
    );
    await fc.assert(
      fc.asyncProperty(parts, async (list) => {
        const cmd: TextDrawCommand = { kind: 'text', x: 5, y: 30, style: STYLE, runs: list.map((p) => run(p.text, { fontFamily: p.family })) };
        const { bytes, skipped } = await writePdf([{ width: 400, height: 80, commands: [cmd] }], { fonts: registryFontSource, compress: false });
        const { pdf } = checkPdf(bytes);
        const undrawn = new Set(skipped.map((k) => /^U\+([0-9A-F]+) /.exec(k.detail)).filter((m) => m !== null).map((m) => parseInt(m[1]!, 16)));
        expect(skipped.every((k) => k.kind === 'glyph')).toBe(true);
        const want = [...list.map((p) => p.text).join('')].filter((c) => !undrawn.has(c.codePointAt(0)!)).join('');
        expect(visible(readBack(pdf).text)).toBe(visible(want));
        if (undrawn.size) seen.count('undrawn');
        if (visible(want)) seen.count('drawn');
      }),
      runs(RUNS),
    );
    seen.atLeast('undrawn', 10);
    seen.atLeast('drawn', 30);
  }, timeoutFor(RUNS, 400));
});

describe('languages', () => {
  it('marks each run in a language other than the document\'s as a span of it, and writes the shared language', async () => {
    const seen = tally();
    const lang = fc.constantFrom(undefined, 'en', 'EN', 'fr-CA', 'de', '(x)\\', 'é', '__proto__');
    const parts = fc.array(fc.record({ text: fc.string({ unit: fc.constantFrom(...'abcxyz'), minLength: 1, maxLength: 5 }), lang }), { minLength: 1, maxLength: 4 });
    await fc.assert(
      fc.asyncProperty(parts, fc.option(lang, { nil: undefined }), async (list, docLang) => {
        const cmd: TextDrawCommand = { kind: 'text', x: 5, y: 30, style: STYLE, runs: list.map((p) => run(p.text, { lang: p.lang })) };
        const { bytes } = await writePdf([{ width: 400, height: 80, commands: [cmd] }], { fonts: registryFontSource, compress: false, lang: docLang });
        const { pdf } = checkPdf(bytes);
        const mark = (l: string | undefined) => (l && l.toLowerCase() !== docLang?.toLowerCase() ? l : undefined);
        const { pieces } = readBack(pdf);
        const langOf = new Map<string, string | undefined>();
        // Each run's letters are its own, so a piece names its run by its first letter's place in the text.
        let at = 0;
        const flat = list.flatMap((p) => [...p.text].map(() => mark(p.lang)));
        for (const piece of pieces) {
          for (const _ of piece.text) expect(piece.lang).toBe(flat[at++]);
          langOf.set(piece.text, piece.lang);
        }
        expect(at).toBe(flat.length);
        const shared = new Set(list.map((p) => p.lang));
        const want = docLang ?? (shared.size === 1 ? [...shared][0] : undefined);
        const catalog = pdf.objects.get((pdf.trailer.Root as Ref).id)!.value as Record<string, Value>;
        expect(catalog.Lang === undefined ? undefined : textOf(catalog.Lang as Str)).toBe(want);
        if (pieces.some((p) => p.lang !== undefined)) seen.count('marked');
        if (want !== undefined && docLang === undefined) seen.count('shared');
      }),
      runs(RUNS),
    );
    seen.atLeast('marked', 10);
    seen.atLeast('shared', 5);
  }, timeoutFor(RUNS, 300));
});
