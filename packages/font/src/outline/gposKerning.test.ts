import { describe, expect, it, vi } from 'vitest';
import { gposPairKerning } from './gposKerning';

/** A one-table sfnt holding `gpos` as its GPOS table. */
function sfntWithGpos(gpos: number[]): ArrayBuffer {
  const out = new DataView(new ArrayBuffer(12 + 16 + gpos.length));
  out.setUint32(0, 0x00010000);
  out.setUint16(4, 1);
  [...'GPOS'].forEach((c, i) => out.setUint8(12 + i, c.charCodeAt(0)));
  out.setUint32(12 + 8, 28);
  out.setUint32(12 + 12, gpos.length);
  gpos.forEach((b, i) => out.setUint8(28 + i, b));
  return out.buffer;
}

const u16 = (n: number) => [n >> 8, n & 0xff];
const u32 = (n: number) => [...u16(n >>> 16), ...u16(n & 0xffff)];

/** A GPOS whose one `kern` lookup is an extension `subtableOffset` past the lookup, pointing `extensionOffset` past
 *  its own header. */
function kernExtension(extensionOffset: number, subtableOffset = 8): number[] {
  return [
    ...u32(0x00010000), ...u16(0), ...u16(10), ...u16(24), // version, script, feature and lookup lists
    // FeatureList at 10: one record, 'kern', its table 8 bytes on.
    ...u16(1), 0x6b, 0x65, 0x72, 0x6e, ...u16(8),
    // Feature at 18: no params, one lookup, index 0.
    ...u16(0), ...u16(1), ...u16(0),
    // LookupList at 24: one lookup, 4 bytes on.
    ...u16(1), ...u16(4),
    // Lookup at 28: type 9, no flags, one subtable, 8 bytes on.
    ...u16(9), ...u16(0), ...u16(1), ...u16(subtableOffset),
    // Extension at 36: format 1, wrapping a pair lookup.
    ...u16(1), ...u16(2), ...u32(extensionOffset),
  ];
}

/** A PairPos format 1 subtable kerning glyph 1 then `second` by `value`. */
function pairPos(second: number, value: number): number[] {
  return [
    ...u16(1), ...u16(12), ...u16(4), ...u16(0), ...u16(1), ...u16(18), // format, coverage, XAdvance only, one PairSet
    ...u16(1), ...u16(1), ...u16(1), // Coverage at 12: format 1, glyph 1
    ...u16(1), ...u16(second), ...u16(value & 0xffff), // PairSet at 18
  ];
}

/**
 * A GPOS whose `DFLT` and `latn` scripts each name one `kern` feature with a lookup of its own, the first holding
 * `dflt` and the second `latn`.
 */
function perScriptKern(dflt: number[], latn: number[]): number[] {
  const langSys = (feature: number) => [...u16(4), ...u16(0), ...u16(0), ...u16(0xffff), ...u16(1), ...u16(feature)];
  return [
    ...u32(0x00010000), ...u16(10), ...u16(48), ...u16(74),
    // ScriptList at 10: DFLT 14 on, latn 26 on.
    ...u16(2), 0x44, 0x46, 0x4c, 0x54, ...u16(14), 0x6c, 0x61, 0x74, 0x6e, ...u16(26),
    ...langSys(0), ...langSys(1),
    // FeatureList at 48: two `kern` features, 14 and 20 on, naming lookups 0 and 1.
    ...u16(2), 0x6b, 0x65, 0x72, 0x6e, ...u16(14), 0x6b, 0x65, 0x72, 0x6e, ...u16(20),
    ...u16(0), ...u16(1), ...u16(0), ...u16(0), ...u16(1), ...u16(1),
    // LookupList at 74: lookups 6 and 14 on, their subtables at 96 and 120.
    ...u16(2), ...u16(6), ...u16(14),
    ...u16(2), ...u16(0), ...u16(1), ...u16(16),
    ...u16(2), ...u16(0), ...u16(1), ...u16(32),
    ...dflt, ...latn,
  ];
}

/** A GPOS whose `kern` feature names lookup `index` of a LookupList holding one, behind which `stray` sits where a
 *  second offset would be; both offsets point at a lookup of `type` holding `subtable`. */
function oneLookup(index: number, subtable: number[], type = 2): number[] {
  return [
    ...u32(0x00010000), ...u16(0), ...u16(10), ...u16(24),
    ...u16(1), 0x6b, 0x65, 0x72, 0x6e, ...u16(8),
    ...u16(0), ...u16(1), ...u16(index),
    // LookupList at 24: one lookup 6 on, then a stray word holding the same offset.
    ...u16(1), ...u16(6), ...u16(6),
    ...u16(type), ...u16(0), ...u16(1), ...u16(8),
    ...subtable,
  ];
}

describe('gposPairKerning', () => {
  it('skips a lookup index past the LookupList\'s count', () => {
    expect(gposPairKerning(sfntWithGpos(oneLookup(0, pairPos(2, -50))))!(1, 2)).toBe(-50);
    expect(gposPairKerning(sfntWithGpos(oneLookup(1, pairPos(2, -50))))?.(1, 2) ?? 0).toBe(0);
  });

  it('skips a coverage index past the PairSet count', () => {
    // Coverage names glyphs 1 and 2, but only one PairSet follows; a stray word points where a second would be.
    const sub = [
      ...u16(1), ...u16(14), ...u16(4), ...u16(0), ...u16(1), ...u16(22), ...u16(22),
      ...u16(1), ...u16(2), ...u16(1), ...u16(2),
      ...u16(1), ...u16(3), ...u16(-30 & 0xffff),
    ];
    const kern = gposPairKerning(sfntWithGpos(oneLookup(0, sub)))!;
    expect(kern(1, 3)).toBe(-30);
    expect(kern(2, 3)).toBe(0);
  });

  it('answers null, so the legacy kern table is read, when its kern feature holds no pair lookup', () => {
    expect(gposPairKerning(sfntWithGpos(oneLookup(0, pairPos(2, -50), 1)))).toBeNull();
  });

  it('kerns a pair two scripts\' lookups both cover by one script\'s value, not their sum', () => {
    const kern = gposPairKerning(sfntWithGpos(perScriptKern(pairPos(2, -40), pairPos(2, -50))))!;
    expect(kern(1, 2)).toBe(-50);
  });

  it('kerns a pair only another script\'s lookup covers', () => {
    const kern = gposPairKerning(sfntWithGpos(perScriptKern(pairPos(3, -40), pairPos(2, -50))))!;
    expect(kern(1, 2)).toBe(-50);
    expect(kern(1, 3)).toBe(-40);
  });

  it('kerns nothing, rather than throwing, through a subtable that runs past the end of the font', () => {
    const kern = gposPairKerning(sfntWithGpos(kernExtension(0x10000)));
    expect(() => kern?.(1, 2)).not.toThrow();
    expect(kern?.(1, 2) ?? 0).toBe(0);
  });

  it('kerns nothing, rather than throwing, through an extension whose header lies past the end of the font', () => {
    const kern = gposPairKerning(sfntWithGpos(kernExtension(8, 0x1000)));
    expect(kern?.(1, 2) ?? 0).toBe(0);
  });

  it('remembers a bounded number of pairs, however many it is asked about', () => {
    const kern = gposPairKerning(sfntWithGpos(perScriptKern(pairPos(3, -40), pairPos(2, -50))))!;
    let largest = 0;
    const set = Map.prototype.set;
    const spy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<unknown, unknown>, k, val) {
      const out = set.call(this, k, val);
      largest = Math.max(largest, this.size);
      return out;
    });
    try {
      for (let l = 0; l < 100; l++) for (let r = 0; r < 100; r++) kern(l, r);
    } finally {
      spy.mockRestore();
    }
    expect(kern(1, 2)).toBe(-50);
    expect(largest).toBeLessThanOrEqual(4096);
  });
});
