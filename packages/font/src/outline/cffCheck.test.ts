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
});
