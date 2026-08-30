import { describe, it, expect } from 'vitest';
import { resolveLevels } from './resolve';
import type { BidiClass } from './types';

const C = (s: string): BidiClass[] => s.split(' ') as BidiClass[];
/** Levels of the characters X9 keeps, which is what the conformance data pins. */
const lv = (s: string, dir: 'ltr' | 'rtl' | 'auto' = 'auto', cps?: number[]) => {
  const r = resolveLevels(C(s), dir, cps);
  return [...r.levels].filter((_, i) => !r.removed[i]);
};

describe('W rules — weak types', () => {
  it('W1: a combining mark takes the class before it', () => {
    expect(lv('R NSM', 'rtl')).toEqual([1, 1]);
  });

  it('W2: a European number after an Arabic letter becomes an Arabic number', () => {
    // AL becomes R by W3, but the EN it governs has already become AN — which
    // is why W2 has to run before W3 and read the *original* strong type.
    expect(lv('AL EN', 'rtl')).toEqual([1, 2]);
  });

  it('W4: a separator between two European numbers joins them', () => {
    // Without W4 the ES falls to W6/N2 and drops back to the R level.
    expect(lv('R EN ES EN', 'rtl')).toEqual([1, 2, 2, 2]);
  });

  it('W5: a terminator run adjacent to a European number joins it', () => {
    expect(lv('R EN ET', 'rtl')).toEqual([1, 2, 2]);
  });

  it('W6: a terminator with no number beside it goes neutral', () => {
    expect(lv('R ET', 'rtl')).toEqual([1, 1]);
  });

  it('W7: a European number after a left-to-right letter becomes one', () => {
    // Becomes L, so it stays at the even level rather than being bumped by I1.
    expect(lv('L EN', 'ltr')).toEqual([0, 0]);
  });
});

describe('N rules — neutrals', () => {
  it('N1: a neutral between two of the same direction takes it', () => {
    expect(lv('R ON R', 'rtl')).toEqual([1, 1, 1]);
    expect(lv('L ON L', 'ltr')).toEqual([0, 0, 0]);
  });

  it('N1: numbers count as right-to-left for the surrounding neutral', () => {
    // The ON sits between R and EN; EN counts as R, so the ON goes R rather
    // than falling through to N2.
    expect(lv('R ON EN', 'rtl')).toEqual([1, 1, 2]);
  });

  it('N2: a neutral between opposing directions takes the embedding', () => {
    expect(lv('L ON R', 'ltr')).toEqual([0, 0, 1]);
  });
});

describe('N0 — bracket pairs', () => {
  const PAREN_OPEN = 0x28;
  const PAREN_CLOSE = 0x29;
  const ALEF = 0x05d0;
  const A = 0x41;

  it('gives a bracket pair the direction it encloses, against the embedding', () => {
    // e is L. The pair encloses R, and the strong text before the opening
    // bracket is also R, so N0 gives both brackets R. The closing bracket is
    // what proves the rule ran: N1/N2 alone would leave it at the L level,
    // because it sits between R and L.
    const cps = [ALEF, PAREN_OPEN, ALEF, PAREN_CLOSE, A];
    expect(lv('R ON R ON L', 'ltr', cps)).toEqual([1, 1, 1, 1, 0]);
  });

  it('leaves brackets to the neutral rules when the pair encloses nothing strong', () => {
    const cps = [ALEF, PAREN_OPEN, PAREN_CLOSE, A];
    expect(lv('R ON ON L', 'ltr', cps)).toEqual([1, 0, 0, 0]);
  });

  it('skips N0 when no code points are supplied', () => {
    // BidiTest.txt expresses cases in classes alone, so bracket pairing is
    // unavailable there and the rule must degrade rather than guess.
    expect(lv('R ON R ON L', 'ltr')).toEqual([1, 1, 1, 0, 0]);
  });
});

describe('I rules — implicit levels', () => {
  it('I1: raises right-to-left and numbers above an even level', () => {
    expect(lv('L R', 'ltr')).toEqual([0, 1]);
    expect(lv('L AN', 'ltr')).toEqual([0, 2]);
  });

  it('I2: raises left-to-right and numbers above an odd level', () => {
    expect(lv('R L', 'rtl')).toEqual([1, 2]);
    expect(lv('R AN', 'rtl')).toEqual([1, 2]);
  });
});

describe('paragraph direction', () => {
  it('auto takes the first strong character', () => {
    expect(resolveLevels(C('R L'), 'auto').paragraphLevel).toBe(1);
    expect(resolveLevels(C('L R'), 'auto').paragraphLevel).toBe(0);
  });

  it('an explicit direction overrides the first strong character', () => {
    expect(resolveLevels(C('R L'), 'ltr').paragraphLevel).toBe(0);
    expect(resolveLevels(C('L R'), 'rtl').paragraphLevel).toBe(1);
  });
});
