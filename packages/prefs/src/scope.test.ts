import { describe, expect, it } from 'vitest';
import {
  isPrefScope,
  joinScope,
  scopeSelectors,
  mapScopeValues,
  memberAt,
  repairScope,
  selectionWeights,
  splitScope,
  upgradeScope,
  weighScope,
  writeMember,
} from './scope';

const MODE = 'look.mode';
const DENSITY = 'look.density';
const byMode = (dark: unknown, light: unknown) => ({ $by: MODE, $in: { dark, light } });
const byDensity = (compact: unknown, roomy: unknown) => ({ $by: DENSITY, $in: { compact, roomy } });
const OPTIONS: Record<string, readonly string[]> = { [MODE]: ['dark', 'light'], [DENSITY]: ['compact', 'roomy'] };
const optionsOf = (path: string) => OPTIONS[path];

describe('isPrefScope', () => {
  it('holds for an object of exactly $by and $in', () => {
    expect(isPrefScope(byMode(1, 2))).toBe(true);
    expect(isPrefScope({ $by: MODE, $in: {}, extra: 1 })).toBe(false);
    expect(isPrefScope({ by: MODE, dark: 1 })).toBe(false);
    expect(isPrefScope({ $by: 3, $in: {} })).toBe(false);
    expect(isPrefScope({ $by: MODE, $in: [] })).toBe(false);
    expect(isPrefScope(4)).toBe(false);
  });
});

describe('weighScope', () => {
  it('is the value itself, at full weight, where nothing is split', () => {
    expect(weighScope(4, {}, 0)).toEqual([{ value: 4, weight: 1 }]);
  });

  it('is the one member a plain selection names', () => {
    expect(weighScope(byMode(4, 8), selectionWeights({ [MODE]: 'light' }), 0)).toEqual([{ value: 8, weight: 1 }]);
  });

  it('multiplies weights down a nested scope, and gives an unsplit side its whole share', () => {
    const value = byMode(byDensity(4, 8), 6);
    const weights = { [MODE]: { dark: 0.5, light: 0.5 }, [DENSITY]: { compact: 0.5, roomy: 0.5 } };
    expect(weighScope(value, weights, 0)).toEqual([
      { value: 4, weight: 0.25 },
      { value: 8, weight: 0.25 },
      { value: 6, weight: 0.5 },
    ]);
  });

  it('reads an option the scope has no member for as the absent value', () => {
    expect(weighScope({ $by: MODE, $in: { dark: 4 } }, selectionWeights({ [MODE]: 'light' }), 99)).toEqual([{ value: 99, weight: 1 }]);
  });

  it('has no members where the selector has no weight', () => {
    expect(weighScope(byMode(4, 8), {}, 0)).toEqual([]);
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

describe('splitScope', () => {
  const order = [MODE, DENSITY];

  it('gives every option the value it had', () => {
    expect(splitScope(4, MODE, OPTIONS[MODE]!, order)).toEqual(byMode(4, 4));
  });

  it('nests a later selector inside an earlier one, whichever was split first', () => {
    expect(splitScope(byMode(4, 8), DENSITY, OPTIONS[DENSITY]!, order)).toEqual(byMode(byDensity(4, 4), byDensity(8, 8)));
    expect(splitScope(byDensity(4, 8), MODE, OPTIONS[MODE]!, order)).toEqual(byMode(byDensity(4, 8), byDensity(4, 8)));
  });

  it('leaves a value already split by that selector', () => {
    const value = byMode(4, 8);
    expect(splitScope(value, MODE, OPTIONS[MODE]!, order)).toBe(value);
  });
});

describe('joinScope', () => {
  it('keeps the member the selection names, at any depth', () => {
    const value = byMode(byDensity(4, 8), 6);
    expect(joinScope(value, DENSITY, { [DENSITY]: 'roomy' }, 0)).toEqual(byMode(8, 6));
    expect(joinScope(value, MODE, { [MODE]: 'dark' }, 0)).toEqual(byDensity(4, 8));
    expect(joinScope(4, MODE, { [MODE]: 'dark' }, 0)).toBe(4);
  });
});

describe('scopeSelectors and mapScopeValues', () => {
  it('names every selector a value is split by', () => {
    expect([...scopeSelectors(byMode(byDensity(4, 8), 6))]).toEqual([MODE, DENSITY]);
    expect([...scopeSelectors(4)]).toEqual([]);
  });

  it('maps each member and keeps the shape, returning the same value when nothing changed', () => {
    const value = byMode(byDensity(4, 8), 6);
    expect(mapScopeValues(value, (v) => (v as number) * 2)).toEqual(byMode(byDensity(8, 16), 12));
    expect(mapScopeValues(value, (v) => v)).toBe(value);
  });
});

describe('repairScope', () => {
  const double = (v: unknown) => (v as number) * 2;

  it('repairs each member and drops a key that is no option', () => {
    const stored = { $by: MODE, $in: { dark: 1, light: 2, sepia: 3 } };
    expect(repairScope(stored, [MODE], optionsOf, double)).toEqual(byMode(2, 4));
  });

  it('refuses a selector the leaf may not be split by, one that is no enum, and one met twice', () => {
    expect(repairScope(byDensity(1, 2), [MODE], optionsOf, double)).toBeUndefined();
    expect(repairScope({ $by: 'nope', $in: { a: 1 } }, ['nope'], optionsOf, double)).toBeUndefined();
    expect(repairScope(byMode(byMode(1, 2), 3), [MODE], optionsOf, double)).toBeUndefined();
  });

  it('reads a nested scope in either order', () => {
    expect(repairScope(byDensity(byMode(1, 2), 3), [MODE, DENSITY], optionsOf, double)).toEqual(byDensity(byMode(2, 4), 6));
  });
});

describe('upgradeScope', () => {
  it('rekeys a scope stored as { $by, $of } at any depth', () => {
    const old = { $by: MODE, $of: { dark: { $by: DENSITY, $of: { compact: 4, roomy: 8 } }, light: 6 } };
    expect(upgradeScope(old)).toEqual(byMode(byDensity(4, 8), 6));
    expect(upgradeScope(byMode({ $by: DENSITY, $of: { compact: 1 } }, 2))).toEqual(byMode({ $by: DENSITY, $in: { compact: 1 } }, 2));
  });

  it('returns the same value where there is nothing to upgrade', () => {
    const current = byMode(byDensity(4, 8), 6);
    expect(upgradeScope(current)).toBe(current);
    for (const value of [4, 'x', null, [1], { $of: { a: 1 } }, { $by: MODE, $of: {}, other: 1 }]) expect(upgradeScope(value)).toBe(value);
  });
});
