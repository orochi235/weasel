import { describe, expect, it } from 'vitest';
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

describe('gposPairKerning', () => {
  it('kerns nothing, rather than throwing, through a subtable that runs past the end of the font', () => {
    const kern = gposPairKerning(sfntWithGpos(kernExtension(0x10000)));
    expect(() => kern?.(1, 2)).not.toThrow();
    expect(kern?.(1, 2) ?? 0).toBe(0);
  });

  it('kerns nothing, rather than throwing, through an extension whose header lies past the end of the font', () => {
    const kern = gposPairKerning(sfntWithGpos(kernExtension(8, 0x1000)));
    expect(kern?.(1, 2) ?? 0).toBe(0);
  });
});
