/** Counterexamples `opentypeTables.pbt.test.ts` shrank to, kept as examples. */
import { describe, expect, it } from 'vitest';
import { tablesOf } from '../pbt.fixture';
import { checkCff } from './cffCheck';
import { createOpenTypeParser } from './opentypeParser';
import { writeFont } from './writtenFont.fixture';

const written = () => writeFont({
  family: 'f', unitsPerEm: 1000,
  glyphs: [{ unicodes: [65], advance: 500, contours: [{ start: [0, 0], segments: [{ kind: 'L', to: [0, 700] }, { kind: 'L', to: [500, 0] }] }] }],
});
const cffOf = (bytes: ArrayBuffer) => {
  const t = tablesOf(bytes).find((r) => r.tag === 'CFF ')!;
  return { at: t.offset, view: new DataView(bytes, t.offset, t.length) };
};

/** The written font with its Top DICT's `CharStrings` operand, a 5-byte integer, rewritten as five 1-byte zeros. */
function charStringsAsFiveOperands(): ArrayBuffer {
  const bytes = written();
  const { at, view } = cffOf(bytes);
  for (let i = 5; i < view.byteLength; i++) {
    if (view.getUint8(i) === 17 && view.getUint8(i - 5) === 29) {
      new Uint8Array(bytes, at + i - 5, 5).fill(139);
      return bytes;
    }
  }
  throw new Error('no CharStrings operator written as a 5-byte integer');
}

describe('checkCff, shrunk', () => {
  it('passes a face opentype.js wrote', () => {
    expect(() => checkCff(cffOf(written()).view)).not.toThrow();
  });

  it('refuses a top DICT offset operator with the wrong operand count, which opentype.js adds to an offset as a string', async () => {
    const bytes = charStringsAsFiveOperands();
    expect(() => checkCff(cffOf(bytes).view)).toThrow(/Top DICT operator 17 holds 0 0 0 0 0$/);
    await expect(createOpenTypeParser()(bytes)).rejects.toThrow(/CFF table is damaged/);
  });

  it('refuses an INDEX whose offsets are wider than 4 bytes', () => {
    const bytes = written();
    const { view } = cffOf(bytes);
    view.setUint8(view.getUint8(2) + 2, 252);
    expect(() => checkCff(view)).toThrow(/Name INDEX has offsets 252 bytes wide/);
  });
});
