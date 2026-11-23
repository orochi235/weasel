import { describe, expect, it } from 'vitest';
import { checkCff } from './cffCheck';

/** A CID-keyed CFF: one Top DICT naming CharStrings and an FDArray whose one Font DICT is `fontDict`. */
function cidCff(fontDict: number[]): DataView {
  const top = [28, 0, 28, 17, 28, 0, 34, 12, 36];
  const bytes = [
    1, 0, 4, 1, // header
    0, 1, 1, 1, 2, 0x61, // Name INDEX at 4
    0, 1, 1, 1, top.length + 1, ...top, // Top DICT INDEX at 10
    0, 0, // String INDEX at 24
    0, 0, // Global Subr INDEX at 26
    0, 1, 1, 1, 2, 14, // CharStrings INDEX at 28
    0, 1, 1, 1, fontDict.length + 1, ...fontDict, // FDArray INDEX at 34
  ];
  return new DataView(new Uint8Array(bytes).buffer);
}

describe('checkCff', () => {
  it('passes an FDArray Font DICT with a Private DICT inside the table', () => {
    // Private: size 0 at offset 0.
    expect(() => checkCff(cidCff([139, 139, 18]))).not.toThrow();
  });

  it('refuses an FDArray Font DICT whose Private holds the wrong number of operands', () => {
    expect(() => checkCff(cidCff([139, 139, 139, 18]))).toThrow(/Font DICT operator 18 holds 0 0 0/);
  });

  it('refuses an FDArray Font DICT whose Private runs past the table', () => {
    expect(() => checkCff(cidCff([139, 28, 0x7f, 0, 18]))).toThrow(/Private DICT runs past the table/);
  });

  it('refuses an FDArray Font DICT whose Private DICT Subrs holds two operands', () => {
    // Private at 42, the last 3 of the Font DICT's 6 bytes: `0 0 19`.
    const view = cidCff([139 + 3, 139 + 42, 18, 139, 139, 19]);
    expect(() => checkCff(view)).toThrow(/Private DICT Subrs holds 0 0/);
  });

  it('refuses a header naming a version other than 1 or 2, which opentype.js would read as CFF 1 unchecked', () => {
    const view = cidCff([139, 139, 18]);
    view.setUint8(0, 0);
    expect(() => checkCff(view)).toThrow(/names version 0/);
  });
});

/** A CFF2 table: a Top DICT naming CharStrings at 18 and an FDArray at 26, whose one Font DICT, at 33, is `fontDict`;
 *  `after` follows it from 33 + its length. */
function cff2(fontDict: number[], { top = [28, 0, 18, 17, 28, 0, 26, 12, 36], after = [] as number[] } = {}): DataView {
  const bytes = [
    2, 0, 5, 0, top.length, // header
    ...top, // Top DICT at 5
    0, 0, 0, 0, // Global Subr INDEX
    0, 0, 0, 1, 1, 1, 2, 0x0e, // CharStrings INDEX at 18
    0, 0, 0, 1, 1, 1, fontDict.length + 1, ...fontDict, // FDArray INDEX at 26
    ...after,
  ];
  return new DataView(new Uint8Array(bytes).buffer);
}

describe('checkCff on a CFF2 table', () => {
  it('passes one whose Top DICT, FDArray, and Private DICT lie inside the table', () => {
    expect(() => checkCff(cff2([139, 139, 18]))).not.toThrow();
  });

  it('refuses a Top DICT CharStrings holding two operands, which opentype.js would add to a number as a string', () => {
    expect(() => checkCff(cff2([139, 139, 18], { top: [28, 0, 18, 139, 17, 28, 0, 26, 12, 36] })))
      .toThrow(/Top DICT operator 17 holds 18 0/);
  });

  it('refuses a Top DICT that runs past the table', () => {
    const view = cff2([139, 139, 18]);
    view.setUint16(3, 0x7fff);
    expect(() => checkCff(view)).toThrow(/Top DICT runs past the table/);
  });

  it('refuses an FDArray Font DICT whose Private holds the wrong number of operands', () => {
    expect(() => checkCff(cff2([139, 139, 139, 18]))).toThrow(/Font DICT operator 18 holds 0 0 0/);
  });

  // A 5-byte Private at 36 giving Subrs through blend: `n 0 1 blend 19` keeps the first operand, n.
  const blended = (n: number): DataView => cff2([139 + 5, 139 + 36, 18], { after: [139 + n, 139, 139 + 1, 23, 19, 0, 0, 0, 0] });

  it('reads a Private DICT operand through blend, as opentype.js does', () => {
    expect(() => checkCff(blended(5))).not.toThrow();
  });

  it('refuses a Private DICT whose Subrs, read through blend, runs past the table', () => {
    expect(() => checkCff(blended(50))).toThrow(/Local Subr INDEX runs past the table/);
  });
});
