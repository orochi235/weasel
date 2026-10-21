import { parse } from 'opentype.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { subsetTrueType } from './subset';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

function interBytes(): ArrayBuffer {
  const buf = readFileSync(INTER_TTF);
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

type Composite = { isComposite?: boolean; components?: { glyphIndex: number }[] };

/** Table tag to offset, from the sfnt's directory. */
function directory(bytes: Uint8Array): Map<string, number> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, number>();
  for (let i = 0; i < v.getUint16(4); i++) {
    out.set(String.fromCharCode(...bytes.subarray(12 + i * 16, 16 + i * 16)), v.getUint32(12 + i * 16 + 8));
  }
  return out;
}

/** The sfnt's raw glyph records and advances, read straight from its tables. */
function glyphsOf(bytes: Uint8Array): { glyphs: Uint8Array[]; advances: number[] } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dir = directory(bytes);
  const [head, maxp, loca, glyf, hhea, hmtx] = ['head', 'maxp', 'loca', 'glyf', 'hhea', 'hmtx'].map((t) => dir.get(t)!);
  const long = v.getInt16(head + 50) === 1;
  const at = (i: number) => (long ? v.getUint32(loca + i * 4) : v.getUint16(loca + i * 2) * 2);
  const n = v.getUint16(maxp + 4);
  const metrics = v.getUint16(hhea + 34);
  return {
    glyphs: Array.from({ length: n }, (_, i) => bytes.slice(glyf + at(i), glyf + at(i + 1))),
    advances: Array.from({ length: n }, (_, i) => v.getUint16(hmtx + Math.min(i, metrics - 1) * 4)),
  };
}

const inked = (glyphs: Uint8Array[]) => new Set(glyphs.flatMap((g, i) => (g.byteLength > 0 ? [i] : [])));

describe('subsetTrueType', () => {
  const whole = parse(interBytes());
  const original = glyphsOf(new Uint8Array(interBytes()));
  const gidOf = (ch: string) => whole.charToGlyphIndex(ch);
  /** opentype.js reads a glyph's components only once its path has been asked for. */
  const componentsOf = (gid: number): number[] => {
    const glyph = whole.glyphs.get(gid);
    void glyph.path;
    return ((glyph as unknown as Composite).components ?? []).map((c) => c.glyphIndex);
  };
  const composite = (() => {
    for (let gid = 1; gid < whole.numGlyphs; gid++) {
      const parts = componentsOf(gid);
      if (parts.some((p) => p !== 0)) return { gid, parts };
    }
    throw new Error('Inter has no composite glyph');
  })();

  it('keeps exactly the glyphs used, .notdef, and the components of a composite', () => {
    const used = [gidOf('H'), gidOf('i'), composite.gid];
    const want = new Set([0, ...used]);
    for (const gid of want) for (const part of componentsOf(gid)) want.add(part);
    const ink = inked(original.glyphs);
    const kept = inked(glyphsOf(subsetTrueType(interBytes(), used)).glyphs);
    expect(kept).toEqual(new Set([...want].filter((g) => ink.has(g))));
    expect(composite.parts.filter((p) => ink.has(p)).every((p) => kept.has(p))).toBe(true);
  });

  it('leaves every glyph id where it was, with its outline and advance', () => {
    const used = [gidOf('H'), gidOf('i'), composite.gid];
    const sub = glyphsOf(subsetTrueType(interBytes(), used));
    for (const gid of used) {
      // Records are padded to four bytes, so the subset's may run past the original's.
      const want = original.glyphs[gid]!;
      expect(sub.glyphs[gid]!.subarray(0, want.byteLength)).toEqual(want);
      expect(sub.glyphs[gid]!.byteLength - want.byteLength).toBeLessThan(4);
      expect(sub.advances[gid]).toBe(whole.glyphs.get(gid).advanceWidth);
    }
  });

  it('carries only the tables a PDF TrueType font program needs, and is a fraction of the face', () => {
    const bytes = subsetTrueType(interBytes(), [gidOf('H'), gidOf('i')]);
    expect([...directory(bytes).keys()].sort()).toEqual(['glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp']);
    expect(bytes.byteLength).toBeLessThan(interBytes().byteLength / 8);
  });

  it('writes a checksum the font file validates against', () => {
    const bytes = subsetTrueType(interBytes(), [gidOf('H')]);
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let sum = 0;
    for (let i = 0; i < bytes.byteLength; i += 4) sum = (sum + v.getUint32(i)) >>> 0;
    expect(sum).toBe(0xb1b0afba);
  });

  it('ignores a glyph id past the end of the face', () => {
    const sub = glyphsOf(subsetTrueType(interBytes(), [gidOf('H'), 60000]));
    expect(sub.glyphs).toHaveLength(gidOf('H') + 1);
  });
});
