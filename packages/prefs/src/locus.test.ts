import { describe, expect, it } from 'vitest';
import {
  isPrefLocus,
  joinLocus,
  locusSelectors,
  mapLocusMembers,
  memberAt,
  repairLocus,
  selectionWeights,
  splitLocus,
  weighLocus,
  writeMember,
} from './locus';

const MODE = 'look.mode';
const DENSITY = 'look.density';
const byMode = (dark: unknown, light: unknown) => ({ $by: MODE, $of: { dark, light } });
const byDensity = (compact: unknown, roomy: unknown) => ({ $by: DENSITY, $of: { compact, roomy } });
const OPTIONS: Record<string, readonly string[]> = { [MODE]: ['dark', 'light'], [DENSITY]: ['compact', 'roomy'] };
const optionsOf = (path: string) => OPTIONS[path];

describe('isPrefLocus', () => {
  it('holds for an object of exactly $by and $of', () => {
    expect(isPrefLocus(byMode(1, 2))).toBe(true);
    expect(isPrefLocus({ $by: MODE, $of: {}, extra: 1 })).toBe(false);
    expect(isPrefLocus({ by: MODE, dark: 1 })).toBe(false);
    expect(isPrefLocus({ $by: 3, $of: {} })).toBe(false);
    expect(isPrefLocus({ $by: MODE, $of: [] })).toBe(false);
    expect(isPrefLocus(4)).toBe(false);
  });
});

describe('weighLocus', () => {
  it('is the value itself, at full weight, where nothing is split', () => {
    expect(weighLocus(4, {}, 0)).toEqual([{ value: 4, weight: 1 }]);
  });

  it('is the one member a plain selection names', () => {
    expect(weighLocus(byMode(4, 8), selectionWeights({ [MODE]: 'light' }), 0)).toEqual([{ value: 8, weight: 1 }]);
  });

  it('multiplies weights down a nested locus, and gives an unsplit side its whole share', () => {
    const value = byMode(byDensity(4, 8), 6);
    const weights = { [MODE]: { dark: 0.5, light: 0.5 }, [DENSITY]: { compact: 0.5, roomy: 0.5 } };
    expect(weighLocus(value, weights, 0)).toEqual([
      { value: 4, weight: 0.25 },
      { value: 8, weight: 0.25 },
      { value: 6, weight: 0.5 },
    ]);
  });

  it('reads an option the locus has no member for as the absent value', () => {
    expect(weighLocus({ $by: MODE, $of: { dark: 4 } }, selectionWeights({ [MODE]: 'light' }), 99)).toEqual([{ value: 99, weight: 1 }]);
  });

  it('has no members where the selector has no weight', () => {
    expect(weighLocus(byMode(4, 8), {}, 0)).toEqual([]);
  });
});

describe('memberAt and writeMember', () => {
  it('reads and writes the member a selection names, leaving the others', () => {
    const value = byMode(byDensity(4, 8), 6);
    const at = { [MODE]: 'dark', [DENSITY]: 'roomy' };
    expect(memberAt(value, at, 0)).toBe(8);
    expect(writeMember(value, at, 10)).toEqual(byMode(byDensity(4, 10), 6));
    expect(writeMember(value, { [MODE]: 'light', [DENSITY]: 'roomy' }, 7)).toEqual(byMode(byDensity(4, 8), 7));
    expect(value).toEqual(byMode(byDensity(4, 8), 6));
  });

  it('replaces a value that is not split', () => {
    expect(writeMember(4, { [MODE]: 'dark' }, 5)).toBe(5);
  });
});

describe('splitLocus', () => {
  const order = [MODE, DENSITY];

  it('gives every option the value it had', () => {
    expect(splitLocus(4, MODE, OPTIONS[MODE]!, order)).toEqual(byMode(4, 4));
  });

  it('nests a later selector inside an earlier one, whichever was split first', () => {
    expect(splitLocus(byMode(4, 8), DENSITY, OPTIONS[DENSITY]!, order)).toEqual(byMode(byDensity(4, 4), byDensity(8, 8)));
    expect(splitLocus(byDensity(4, 8), MODE, OPTIONS[MODE]!, order)).toEqual(byMode(byDensity(4, 8), byDensity(4, 8)));
  });

  it('leaves a value already split by that selector', () => {
    const value = byMode(4, 8);
    expect(splitLocus(value, MODE, OPTIONS[MODE]!, order)).toBe(value);
  });
});

describe('joinLocus', () => {
  it('keeps the member the selection names, at any depth', () => {
    const value = byMode(byDensity(4, 8), 6);
    expect(joinLocus(value, DENSITY, { [DENSITY]: 'roomy' }, 0)).toEqual(byMode(8, 6));
    expect(joinLocus(value, MODE, { [MODE]: 'dark' }, 0)).toEqual(byDensity(4, 8));
    expect(joinLocus(4, MODE, { [MODE]: 'dark' }, 0)).toBe(4);
  });
});

describe('locusSelectors and mapLocusMembers', () => {
  it('names every selector a value is split by', () => {
    expect([...locusSelectors(byMode(byDensity(4, 8), 6))]).toEqual([MODE, DENSITY]);
    expect([...locusSelectors(4)]).toEqual([]);
  });

  it('maps each member and keeps the shape, returning the same value when nothing changed', () => {
    const value = byMode(byDensity(4, 8), 6);
    expect(mapLocusMembers(value, (v) => (v as number) * 2)).toEqual(byMode(byDensity(8, 16), 12));
    expect(mapLocusMembers(value, (v) => v)).toBe(value);
  });
});

describe('repairLocus', () => {
  const double = (v: unknown) => (v as number) * 2;

  it('repairs each member and drops a key that is no option', () => {
    const stored = { $by: MODE, $of: { dark: 1, light: 2, sepia: 3 } };
    expect(repairLocus(stored, [MODE], optionsOf, double)).toEqual(byMode(2, 4));
  });

  it('refuses a selector the leaf may not be split by, one that is no enum, and one met twice', () => {
    expect(repairLocus(byDensity(1, 2), [MODE], optionsOf, double)).toBeUndefined();
    expect(repairLocus({ $by: 'nope', $of: { a: 1 } }, ['nope'], optionsOf, double)).toBeUndefined();
    expect(repairLocus(byMode(byMode(1, 2), 3), [MODE], optionsOf, double)).toBeUndefined();
  });

  it('reads a nested locus in either order', () => {
    expect(repairLocus(byDensity(byMode(1, 2), 3), [MODE, DENSITY], optionsOf, double)).toEqual(byDensity(byMode(2, 4), 6));
  });
});
