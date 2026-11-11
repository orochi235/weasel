/**
 * Faces opentype.js writes, with CFF outlines, read back by the default outline parser and the registry: every
 * glyph keeps its outline, vertex for vertex, and its advance, from any code point in any plane, under any family
 * name; code points the face does not map answer as misses.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createOpenTypeParser } from './opentypeParser';
import { _resetFontOutlinesForTests, glyphOutline, loadFontOutlines, registerFontOutlines } from './outlineRegistry';
import { codePoint, expectedPoints, fontSpec, readD, writeFont } from './writtenFont.fixture';

const RUNS = 100;
const parse = createOpenTypeParser();

afterEach(() => _resetFontOutlinesForTests());

describe('a written CFF face, read back', () => {
  it('keeps every glyph\'s outline and advance, and misses every code point it does not map', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(fontSpec, fc.array(codePoint, { maxLength: 4 }), async (spec, others) => {
      const bytes = writeFont(spec);
      const face = await parse(bytes);
      expect(face.unitsPerEm).toBe(spec.unitsPerEm);
      expect(face.embedding?.().outlines).toBe('cff');
      for (const g of spec.glyphs) {
        const cp = g.unicodes[0]!;
        expect(face.advanceOf(cp)).toBeCloseTo(g.advance / spec.unitsPerEm, 9);
        const d = face.glyphD(cp);
        if (g.contours.length === 0) { expect(d).toBeNull(); t.count('empty'); continue; }
        const { commands, numbers } = readD(d!);
        expect(commands.replace(/Z/g, '')).toBe(g.contours.map((c) => `M${c.segments.map((s) => s.kind).join('')}`).join(''));
        const want = expectedPoints(g, spec.unitsPerEm);
        expect(numbers.length).toBe(want.length);
        numbers.forEach((n, i) => expect(Math.abs(n - want[i]!)).toBeLessThanOrEqual(6e-6));
        if (cp > 0xffff) t.count('astral');
        t.count('outlined');
      }
      const mapped = new Set(spec.glyphs.map((g) => g.unicodes[0]));
      for (const cp of others) {
        if (mapped.has(cp)) continue;
        expect(face.advanceOf(cp)).toBeNull();
        expect(face.glyphD(cp)).toBeNull();
        t.count('missed');
      }
    }), runs(RUNS));
    t.atLeast('outlined', 200);
    t.atLeast('astral', 30);
    t.atLeast('empty', 10);
    t.atLeast('missed', 30);
  }, timeoutFor(RUNS, 60));

  it('serves each glyph closed through the registry, under any family name', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(fontSpec, async (spec) => {
      _resetFontOutlinesForTests();
      registerFontOutlines(spec.family, {}, writeFont(spec));
      expect(await loadFontOutlines(spec.family)).toBe('ready');
      for (const g of spec.glyphs) {
        const d = glyphOutline(spec.family, 400, 'normal', g.unicodes[0]!);
        if (g.contours.length === 0) { expect(d).toBeNull(); continue; }
        expect(readD(d!).commands.match(/Z/g)?.length).toBe(g.contours.length);
        expect(d!.endsWith('Z')).toBe(true);
        t.count(spec.family);
      }
    }), runs(RUNS));
    t.atLeast('__proto__', 1);
  }, timeoutFor(RUNS, 60));
});
