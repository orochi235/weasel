import { describe, expect, it } from 'vitest';

import { bidiClassOf, mirrorOf, pairedBracket, UNICODE_VERSION } from './tables';

describe('bidiClassOf', () => {
  it('reports the strong classes', () => {
    expect(bidiClassOf(0x0041)).toBe('L'); // LATIN CAPITAL LETTER A
    expect(bidiClassOf(0x05d0)).toBe('R'); // HEBREW LETTER ALEF
    expect(bidiClassOf(0x0628)).toBe('AL'); // ARABIC LETTER BEH
  });

  it('separates European from Arabic-Indic digits', () => {
    expect(bidiClassOf(0x0030)).toBe('EN'); // DIGIT ZERO
    expect(bidiClassOf(0x0660)).toBe('AN'); // ARABIC-INDIC DIGIT ZERO
  });

  it('reports the other weak classes', () => {
    expect(bidiClassOf(0x002b)).toBe('ES'); // PLUS SIGN
    expect(bidiClassOf(0x0024)).toBe('ET'); // DOLLAR SIGN
    expect(bidiClassOf(0x002c)).toBe('CS'); // COMMA
    expect(bidiClassOf(0x0300)).toBe('NSM'); // COMBINING GRAVE ACCENT
    expect(bidiClassOf(0x064b)).toBe('NSM'); // ARABIC FATHATAN
    expect(bidiClassOf(0x200b)).toBe('BN'); // ZERO WIDTH SPACE
  });

  it('reports the neutrals', () => {
    expect(bidiClassOf(0x0020)).toBe('WS'); // SPACE
    expect(bidiClassOf(0x0009)).toBe('S'); // CHARACTER TABULATION
    expect(bidiClassOf(0x000a)).toBe('B'); // LINE FEED
    expect(bidiClassOf(0x000d)).toBe('B'); // CARRIAGE RETURN
    expect(bidiClassOf(0x0028)).toBe('ON'); // LEFT PARENTHESIS
  });

  it('reports the embeddings, overrides and isolates the X rules drive', () => {
    expect(bidiClassOf(0x202a)).toBe('LRE');
    expect(bidiClassOf(0x202b)).toBe('RLE');
    expect(bidiClassOf(0x202d)).toBe('LRO');
    expect(bidiClassOf(0x202e)).toBe('RLO');
    expect(bidiClassOf(0x202c)).toBe('PDF');
    expect(bidiClassOf(0x2066)).toBe('LRI');
    expect(bidiClassOf(0x2067)).toBe('RLI');
    expect(bidiClassOf(0x2068)).toBe('FSI');
    expect(bidiClassOf(0x2069)).toBe('PDI');
  });

  // DerivedBidiClass.txt lists only assigned code points; its `@missing` lines
  // give the rest a per-block default, and inside the right-to-left blocks that
  // default is R or AL rather than L. A table built from the data lines alone
  // passes every test above and fails these.
  it('gives unassigned code points their block default, not L', () => {
    expect(bidiClassOf(0x05eb)).toBe('R'); // unassigned, Hebrew
    expect(bidiClassOf(0xfb45)).toBe('R'); // unassigned, Alphabetic Presentation Forms
    expect(bidiClassOf(0x07b2)).toBe('AL'); // unassigned, Thaana
    expect(bidiClassOf(0x1ee04)).toBe('AL'); // unassigned, Arabic Mathematical
  });

  it('falls back to L outside the code space', () => {
    expect(bidiClassOf(-1)).toBe('L');
    expect(bidiClassOf(0x110000)).toBe('L');
    expect(bidiClassOf(Number.NaN)).toBe('L');
  });

  it('covers every code point, and uses all 23 classes', () => {
    const seen = new Set<string>();
    let gaps = 0;
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      const cls = bidiClassOf(cp);
      if (typeof cls !== 'string') gaps++;
      seen.add(cls);
    }
    expect(gaps).toBe(0);
    expect(seen.size).toBe(23);
  });
});

describe('pairedBracket', () => {
  it('reports both halves of a pair', () => {
    expect(pairedBracket(0x0028)).toEqual({ pair: 0x0029, kind: 'open' });
    expect(pairedBracket(0x0029)).toEqual({ pair: 0x0028, kind: 'close' });
    expect(pairedBracket(0x005b)).toEqual({ pair: 0x005d, kind: 'open' });
    expect(pairedBracket(0x007d)).toEqual({ pair: 0x007b, kind: 'close' });
  });

  it('is null for anything that is not a bracket', () => {
    expect(pairedBracket(0x0041)).toBeNull();
    expect(pairedBracket(0x003c)).toBeNull(); // LESS-THAN SIGN mirrors but does not pair
    expect(pairedBracket(0x05d0)).toBeNull();
  });
});

describe('mirrorOf', () => {
  it('reports the L4 mirroring glyph', () => {
    expect(mirrorOf(0x0028)).toBe(0x0029);
    expect(mirrorOf(0x0029)).toBe(0x0028);
    expect(mirrorOf(0x003c)).toBe(0x003e); // LESS-THAN SIGN
    expect(mirrorOf(0x00ab)).toBe(0x00bb); // LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
  });

  it('is null where a code point has no mirror', () => {
    expect(mirrorOf(0x0041)).toBeNull();
    expect(mirrorOf(0x0020)).toBeNull();
    expect(mirrorOf(0x05d0)).toBeNull();
  });
});

describe('the table as a whole', () => {
  it('pins the Unicode version it was generated from', () => {
    expect(UNICODE_VERSION).toBe('16.0.0');
  });

  it('makes every bracket an ON that round-trips through its pair and its mirror', () => {
    const broken: string[] = [];
    let seen = 0;
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      const bracket = pairedBracket(cp);
      if (bracket === null) continue;
      seen++;
      const back = pairedBracket(bracket.pair);
      const flipped = bracket.kind === 'open' ? 'close' : 'open';
      if (bidiClassOf(cp) !== 'ON') broken.push(`U+${cp.toString(16)} is not ON`);
      if (back?.pair !== cp || back.kind !== flipped) broken.push(`U+${cp.toString(16)} pair does not round-trip`);
      if (mirrorOf(cp) !== bracket.pair) broken.push(`U+${cp.toString(16)} mirror is not its pair`);
    }
    expect(broken).toEqual([]);
    expect(seen).toBe(128);
  });
});
