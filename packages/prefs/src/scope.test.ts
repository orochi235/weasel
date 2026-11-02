import { describe, expect, it } from 'vitest';
import {
  PREF_ELSE,
  isPrefScope,
  scopeSelectors,
  mapScopeValues,
  memberAt,
  repairScope,
  selectionWeights,
  upgradeScope,
  weighScope,
  writeDeclared,
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

describe('memberAt and writeDeclared', () => {
  const order = [MODE, DENSITY];
  const shared = (by: string, value: unknown, own: Record<string, unknown> = {}) => ({ $by: by, $in: own, [PREF_ELSE]: value });
  const dark = { [MODE]: 'dark', [DENSITY]: 'compact' };

  it('reads the value a selection names, at any depth', () => {
    expect(memberAt(byMode(byDensity(4, 8), 6), { [MODE]: 'dark', [DENSITY]: 'roomy' }, 0)).toBe(8);
  });

  it('writes an option its own value, plain, leaving the others', () => {
    const value = shared(MODE, shared(DENSITY, 1), { light: 2 });
    expect(writeDeclared(value, order, { [MODE]: 'light', [DENSITY]: 'roomy' }, dark, 7, 0)).toEqual(shared(MODE, shared(DENSITY, 1), { light: 7 }));
    expect(value).toEqual(shared(MODE, shared(DENSITY, 1), { light: 2 }));
  });

  it('makes a plain value the shared value of the scope it stands in for, so nothing reads differently', () => {
    expect(writeDeclared(4, order, { [MODE]: 'light', [DENSITY]: 'roomy' }, dark, 9, 0)).toEqual(shared(MODE, 4, { light: 9 }));
  });

  it('flattens a value split by an undeclared selector at that level into the shared value it reads now', () => {
    expect(writeDeclared(byDensity(4, 8), order, { [MODE]: 'light', [DENSITY]: 'roomy' }, { [MODE]: 'dark', [DENSITY]: 'roomy' }, 9, 0))
      .toEqual(shared(MODE, 8, { light: 9 }));
  });

  it('creates an inner scope with no shared value where the outer one held none', () => {
    const list = (selector: string) => (selector === MODE ? ['types'] : undefined);
    expect(writeDeclared({ $by: MODE, $in: {} }, order, { [MODE]: 'light', [DENSITY]: 'roomy' }, dark, 5, 0, list))
      .toEqual(shared(MODE, { $by: DENSITY, $in: { roomy: 5 } }));
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
