/**
 * The default outline parser over tables the first pass left alone: a `cmap` of format 4 or 12 that maps code points
 * to any glyph id, a written face's `CFF ` table, and Inter's `glyf`, `loca`, `name`, and `post`, cut, overwritten,
 * and zeroed. It rejects a face, or reads one whose every answer is a finite number, a miss, or path data of finite
 * numbers, for any code point; a glyph id past the face's last glyph is a miss.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { interBytes, mutate, mutations, runs, tablesOf, tally, timeoutFor } from '../pbt.fixture';
import { createOpenTypeParser } from './opentypeParser';
import type { OutlineFace } from './OutlineFace';
import { _resetFontOutlinesForTests, glyphOutline, loadFontOutlines, registerFontOutlines } from './outlineRegistry';
import { cmapSubtables, codePoint, fontSpec, glyphIdFields, readD, writeFont } from './writtenFont.fixture';

const RUNS = 150;
const INTER = interBytes();
const parse = createOpenTypeParser();
const cps = fc.array(fc.oneof(fc.integer({ min: 0x20, max: 0x7e }), codePoint), { minLength: 1, maxLength: 8 });

// opentype.js logs every operator a damaged charstring holds, and the registry warns of every face it cannot load.
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  _resetFontOutlinesForTests();
});

/** Every answer `face` gives about `points` is finite or a miss; counts the hits. */
function checkFace(face: OutlineFace, points: readonly number[], t: ReturnType<typeof tally>): void {
  expect(face.unitsPerEm).toBeGreaterThan(0);
  expect(Number.isFinite(face.ascender)).toBe(true);
  for (const cp of points) {
    const advance = face.advanceOf(cp);
    if (advance !== null) {
      expect(Number.isFinite(advance)).toBe(true);
      expect(advance).toBeGreaterThanOrEqual(0);
      t.count('advance');
    }
    expect(Number.isFinite(face.kernOf(cp, points[0]!))).toBe(true);
  }
  const emb = face.embedding?.();
  if (!emb) return;
  for (const n of [emb.unitsPerEm, emb.ascent, emb.descent, emb.capHeight, emb.italicAngle, ...emb.bbox]) {
    expect(Number.isFinite(n)).toBe(true);
  }
  for (const cp of points) {
    const gid = emb.glyphIndexOf(cp);
    if (gid !== null) expect(Number.isFinite(emb.advanceOfGlyph(gid))).toBe(true);
  }
}

/** Through the registry, every glyph is null or path data of finite numbers, and asking never throws. */
async function checkOutlines(bytes: ArrayBuffer, points: readonly number[], t: ReturnType<typeof tally>): Promise<void> {
  _resetFontOutlinesForTests();
  registerFontOutlines('f', {}, bytes);
  if ((await loadFontOutlines('f')) !== 'ready') return;
  for (const cp of points) {
    const d = glyphOutline('f', 400, 'normal', cp);
    if (d === null) continue;
    expect(d).not.toMatch(/NaN|Infinity/);
    expect(readD(d).numbers.every(Number.isFinite)).toBe(true);
    t.count('outline');
  }
}

describe('a cmap mapping code points to any glyph id', () => {
  it('reads a glyph id past the last glyph as a miss', async () => {
    const t = tally();
    const gid = fc.oneof(fc.nat(0xffff), fc.constantFrom(0, 1, 0xffff, 0x7fff, 0x8000, 300, 0xffffffff));
    await fc.assert(fc.asyncProperty(fontSpec, fc.array(fc.tuple(fc.nat(), gid), { minLength: 1, maxLength: 4 }), cps,
      async (spec, pokes, extra) => {
        const bytes = writeFont(spec);
        const cmap = tablesOf(bytes).find((r) => r.tag === 'cmap')!;
        const fields = cmapSubtables(bytes, cmap.offset).flatMap((s) => glyphIdFields(bytes, s));
        const v = new DataView(bytes);
        for (const [i, value] of pokes) {
          const [at, size] = fields[i % fields.length]!;
          if (size === 2) v.setUint16(at, value & 0xffff); else v.setUint32(at, value >>> 0);
        }
        const points = [...spec.glyphs.map((g) => g.unicodes[0]!), ...extra];
        let face;
        try {
          face = await parse(bytes);
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
          return t.count('rejected');
        }
        t.count('read');
        checkFace(face, points, t);
        await checkOutlines(bytes, points, t);
      }), runs(RUNS));
    t.atLeast('read', 30);
    t.atLeast('rejected', 30);
    t.atLeast('advance', 100);
    t.atLeast('outline', 50);
  }, timeoutFor(RUNS, 150));
});

describe('damaged tables', () => {
  const inter = tablesOf(INTER);
  const span = (tag: string): [number, number] => {
    const r = inter.find((x) => x.tag === tag)!;
    return [r.offset, r.offset + r.length];
  };
  const REGIONS: Record<string, [number, number]> = {
    glyf: span('glyf'), loca: span('loca'), name: span('name'), post: span('post'), head: span('head'),
  };

  it('in Inter: rejected, or read with every answer finite', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(mutations(4), fc.constantFrom(...Object.keys(REGIONS)), cps, async (edits, where, points) => {
      const [from, to] = REGIONS[where]!;
      const bytes = mutate(INTER, edits, from, to);
      let face;
      try {
        face = await parse(bytes);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        return t.count('rejected');
      }
      t.count('read');
      checkFace(face, points, t);
      await checkOutlines(bytes, points, t);
    }), runs(RUNS));
    t.atLeast('read', 50);
    t.atLeast('outline', 50);
  }, timeoutFor(RUNS, 150));

  it('in a written CFF face: rejected, or read with every answer finite', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(fontSpec, mutations(4), fc.constantFrom('CFF ', 'cmap', 'hmtx', 'name', 'anywhere'), cps,
      async (spec, edits, where, extra) => {
        const written = writeFont(spec);
        const r = tablesOf(written).find((x) => x.tag === where);
        const bytes = r ? mutate(written, edits, r.offset, r.offset + r.length) : mutate(written, edits);
        const points = [...spec.glyphs.map((g) => g.unicodes[0]!), ...extra];
        let face;
        try {
          face = await parse(bytes);
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
          return t.count('rejected');
        }
        t.count('read');
        checkFace(face, points, t);
        await checkOutlines(bytes, points, t);
      }), runs(RUNS));
    t.atLeast('read', 50);
    t.atLeast('rejected', 5);
    t.atLeast('outline', 50);
  }, timeoutFor(RUNS, 150));
});
