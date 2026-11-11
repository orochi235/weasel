/** Counterexamples `opentypeTables.pbt.test.ts` shrank to, kept as examples. */
import { describe, expect, it, vi } from 'vitest';
import { mutate, tablesOf } from '../pbt.fixture';
import { createOpenTypeParser } from './opentypeParser';
import { writeFont } from './writtenFont.fixture';

describe('damaged tables, shrunk', () => {
  it('refuses a CFF glyph whose charstring reads past its operands, rather than writing NaN', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const written = writeFont({
      family: ' ', unitsPerEm: 1000,
      glyphs: [{ unicodes: [33], advance: 0, contours: [] }, {
        unicodes: [1], advance: 0,
        contours: [{ start: [0, 0], segments: [{ kind: 'C', c1: [0, 0], c2: [0, 23], to: [-108, -85] }, { kind: 'C', c1: [108, 0], c2: [0, -108], to: [108, 0] }] }],
      }],
    });
    const cff = tablesOf(written).find((t) => t.tag === 'CFF ')!;
    const face = await createOpenTypeParser()(mutate(written, [{ kind: 'word', at: 0.80137, value: 21 }], cff.offset, cff.offset + cff.length));
    expect(() => face.glyphD(33)).toThrow(/not a finite number/);
    vi.restoreAllMocks();
  });
});
