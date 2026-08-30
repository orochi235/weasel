import { describe, expect, it } from 'vitest';

import {
  AUTO_LTR,
  LTR,
  RTL,
  loadBidiCharacterTest,
  loadBidiTest,
  parseBidiCharacterTest,
  parseBidiTest,
  readBidiCharacterTestText,
  readBidiTestText,
} from './parseConformance';

/** Non-comment, non-blank lines — what a case count has to agree with. */
const dataLines = (text: string, alsoSkipAt: boolean): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#') && !(alsoSkipAt && l.startsWith('@')));

describe('parseBidiCharacterTest', () => {
  const cases = loadBidiCharacterTest();

  it('yields one case per data line', () => {
    expect(cases).toHaveLength(91707);
    expect(cases).toHaveLength(dataLines(readBidiCharacterTestText(), false).length);
  });

  // 05D0 05D1 0028 05D2 05D3 005B 0026 0065 0066 005D 002E 0029 0067 0068;0;0;
  //   1 1 0 1 1 0 0 0 0 0 0 0 0 0;1 0 2 4 3 5 6 7 8 9 10 11 12 13
  it('parses the first case (UAX #9 section 3.3.5, LTR paragraph)', () => {
    expect(cases[0]).toEqual({
      codePoints: [
        0x05d0, 0x05d1, 0x0028, 0x05d2, 0x05d3, 0x005b, 0x0026, 0x0065, 0x0066, 0x005d, 0x002e,
        0x0029, 0x0067, 0x0068,
      ],
      direction: 0,
      paragraphLevel: 0,
      levels: [1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      visualOrder: [1, 0, 2, 4, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    });
  });

  // Same code points as case 0, RTL paragraph: only fields 1-4 differ.
  it('parses the second case, which shares field 0 with the first', () => {
    expect(cases[1]!.codePoints).toEqual(cases[0]!.codePoints);
    expect(cases[1]!.direction).toBe(1);
    expect(cases[1]!.paragraphLevel).toBe(1);
    expect(cases[1]!.levels).toEqual([1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2]);
    expect(cases[1]!.visualOrder).toEqual([12, 13, 11, 10, 9, 7, 8, 6, 5, 4, 3, 2, 1, 0]);
  });

  // 202E 0061 202A 0062 202C 2066 0063 2069 202A 0064 202C 0065 202C;2;0;
  //   x 1 x 2 x 1 2 1 x 2 x 1 x;11 9 7 6 5 3 1
  it('parses an `x` level to null in the right position', () => {
    const c = cases[12]!;
    expect(c.codePoints).toEqual([
      0x202e, 0x0061, 0x202a, 0x0062, 0x202c, 0x2066, 0x0063, 0x2069, 0x202a, 0x0064, 0x202c,
      0x0065, 0x202c,
    ]);
    expect(c.direction).toBe(2);
    expect(c.paragraphLevel).toBe(0);
    expect(c.levels).toEqual([null, 1, null, 2, null, 1, 2, 1, null, 2, null, 1, null]);
    // Removed characters keep their slot in `levels` but are absent from `visualOrder`.
    expect(c.levels).toHaveLength(c.codePoints.length);
    expect(c.visualOrder).toEqual([11, 9, 7, 6, 5, 3, 1]);
    expect(c.visualOrder).toHaveLength(c.levels.filter((l) => l !== null).length);
  });

  it('keeps levels index-aligned with code points in every case', () => {
    expect(cases.filter((c) => c.levels.length !== c.codePoints.length)).toEqual([]);
  });

  it('never emits a visual-order index pointing at a removed character', () => {
    const bad = cases.filter((c) => c.visualOrder.some((i) => c.levels[i] === null));
    expect(bad).toEqual([]);
  });
});

describe('parseBidiTest', () => {
  const cases = loadBidiTest();

  it('yields one case per data line, matching the file’s own total', () => {
    expect(cases).toHaveLength(490846);
    expect(cases).toHaveLength(dataLines(readBidiTestText(), true).length);
    expect(readBidiTestText()).toContain('#Total Count:\t490846');
  });

  // @Levels: x / @Reorder: (empty) / LRE; 7
  it('parses the first block: a lone removed character and an empty reorder', () => {
    expect(cases[0]).toEqual({
      classes: ['LRE'],
      paragraphDirections: 7,
      levels: [null],
      visualOrder: [],
    });
    expect(cases[0]!.paragraphDirections).toBe(AUTO_LTR | LTR | RTL);
  });

  it('carries the @Levels/@Reorder state onto every data line in the block', () => {
    // Lines 2-6 of that first block: LRO, RLE, RLO, PDF, BN.
    expect(cases.slice(1, 6).map((c) => c.classes)).toEqual([
      ['LRO'],
      ['RLE'],
      ['RLO'],
      ['PDF'],
      ['BN'],
    ]);
    for (const c of cases.slice(0, 6)) {
      expect(c.levels).toEqual([null]);
      expect(c.visualOrder).toEqual([]);
    }
  });

  // @Levels: x 1 x 2 / @Reorder: 3 1 / LRE S PDF L; 4
  it('parses a mid-file block with interior `x` levels and an RTL-only bitset', () => {
    const c = cases[119933]!;
    expect(c).toEqual({
      classes: ['LRE', 'S', 'PDF', 'L'],
      paragraphDirections: 4,
      levels: [null, 1, null, 2],
      visualOrder: [3, 1],
    });
    expect(c.paragraphDirections).toBe(RTL);
    // Next two lines of the same block reuse the same state.
    expect(cases[119934]!.classes).toEqual(['LRE', 'S', 'PDF', 'EN']);
    expect(cases[119934]!.levels).toEqual([null, 1, null, 2]);
    expect(cases[119935]!.classes).toEqual(['LRE', 'S', 'PDF', 'AN']);
    expect(cases[119935]!.levels).toEqual([null, 1, null, 2]);
  });

  it('keeps levels index-aligned with classes in every case', () => {
    expect(cases.filter((c) => c.levels.length !== c.classes.length)).toEqual([]);
  });

  it('only ever sets bits 1, 2 and 4 in the paragraph-direction bitset', () => {
    const seen = new Set(cases.map((c) => c.paragraphDirections));
    expect([...seen].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 7]);
    expect(cases.filter((c) => c.paragraphDirections & ~(AUTO_LTR | LTR | RTL))).toEqual([]);
  });
});

describe('parser edge cases', () => {
  it('treats @Levels and @Reorder as independent state', () => {
    const cases = parseBidiTest(
      ['@Reorder:\t1 0', '@Levels:\t1 1', 'R R; 4', '@Levels:\tx 2', 'RLE L; 4'].join('\n'),
    );
    // The second @Levels does not clear the @Reorder set before it.
    expect(cases).toEqual([
      { classes: ['R', 'R'], paragraphDirections: 4, levels: [1, 1], visualOrder: [1, 0] },
      { classes: ['RLE', 'L'], paragraphDirections: 4, levels: [null, 2], visualOrder: [1, 0] },
    ]);
  });

  it('ignores unrecognized @ lines, per the file header', () => {
    const cases = parseBidiTest(
      ['@Levels:\t0', '@Reorder:\t0', '@Something: whatever', 'L; 7'].join('\n'),
    );
    expect(cases).toHaveLength(1);
    expect(cases[0]!.classes).toEqual(['L']);
  });

  it('rejects a class name that is not a Bidi_Class', () => {
    expect(() => parseBidiTest(['@Levels:\t0', '@Reorder:\t0', 'XX; 7'].join('\n'))).toThrow(
      /unknown Bidi_Class "XX"/,
    );
  });

  it('rejects a BidiTest line whose class count disagrees with @Levels', () => {
    expect(() => parseBidiTest(['@Levels:\t0 0', '@Reorder:\t0 1', 'L; 7'].join('\n'))).toThrow(
      /1 classes but @Levels has 2/,
    );
  });

  it('rejects a BidiCharacterTest line whose level count disagrees with field 0', () => {
    expect(() => parseBidiCharacterTest('0061 0062;0;0;0;0 1')).toThrow(
      /2 code points but 1 levels/,
    );
  });

  it('skips comments and blank lines in BidiCharacterTest', () => {
    expect(parseBidiCharacterTest('# a comment\n\n0061;0;0;0;0\n')).toHaveLength(1);
  });
});
