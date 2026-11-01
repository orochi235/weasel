import { describe, expect, it } from 'vitest';
import { formatScoped, fromRoot, magnificationOf, resolveScoped, scopesOf, toRoot, type UnitScope } from './scope';
import { IMPERIAL_INCHES, METRIC_MM } from './units';

const SCENE: UnitScope = { system: IMPERIAL_INCHES };
/** A sub-assembly drawn in millimeters inside an inch scene. */
const ASSEMBLY: UnitScope = { system: METRIC_MM, scale: 1 / 25.4 };
/** A detail inside it whose millimeters are worth a tenth of the assembly's. */
const DETAIL: UnitScope = { system: METRIC_MM, scale: 0.1 };

describe('resolveScoped', () => {
  it('reads a value in the innermost scope and returns root base units', () => {
    expect(resolveScoped({ value: 2.54, unit: 'cm' }, [SCENE, ASSEMBLY])).toBeCloseTo(1);
    expect(resolveScoped(254, [SCENE, ASSEMBLY])).toBeCloseTo(10);
  });

  it('converts at every boundary on the way out', () => {
    expect(resolveScoped({ value: 1, unit: 'm' }, [SCENE, ASSEMBLY, DETAIL])).toBeCloseTo(100 / 25.4);
  });

  it('is plain resolveUnit under the root scope alone', () => {
    expect(resolveScoped({ value: 3, unit: 'ft' }, [SCENE])).toBe(36);
  });

  it('refuses a unit the innermost scope does not carry, though an outer one does', () => {
    expect(() => resolveScoped({ value: 1, unit: 'ft' }, [SCENE, ASSEMBLY])).toThrow(/unknown unit 'ft'/);
  });
});

describe('toRoot and fromRoot', () => {
  it('are inverses across the chain', () => {
    const scopes = [SCENE, ASSEMBLY, DETAIL];
    expect(fromRoot(toRoot(37, scopes), scopes)).toBeCloseTo(37);
    expect(fromRoot(1, [SCENE, ASSEMBLY])).toBeCloseTo(25.4);
  });

  it('carries a boundary that moves zero', () => {
    const shifted: UnitScope = { system: METRIC_MM, scale: { factor: 2, offset: 10 } };
    expect(toRoot(5, [SCENE, shifted])).toBe(20);
    expect(fromRoot(20, [SCENE, shifted])).toBe(5);
  });
});

describe('formatScoped', () => {
  it('shows a root measure in a unit of the innermost scope', () => {
    expect(formatScoped(1, 'cm', [SCENE, ASSEMBLY])).toBe('2.54cm');
  });
});

describe('magnificationOf', () => {
  it('multiplies every drawnAt along the chain, absent counting as 1', () => {
    const inset: UnitScope = { system: METRIC_MM, drawnAt: 0.4 };
    const zoomed: UnitScope = { system: METRIC_MM, drawnAt: 5 };
    expect(magnificationOf([SCENE, ASSEMBLY])).toBe(1);
    expect(magnificationOf([SCENE, inset, zoomed])).toBeCloseTo(2);
  });
});

describe('scopesOf', () => {
  const parents: Record<string, string | null> = { bolt: 'assembly', assembly: 'page', page: null };
  const scopes: Record<string, UnitScope | undefined> = { assembly: ASSEMBLY };
  const tree = { parentOf: (id: string) => parents[id] ?? null, scopeOf: (id: string) => scopes[id] };

  it('collects the scopes enclosing a node, outermost first, under the root scope', () => {
    expect(scopesOf('bolt', SCENE, tree)).toEqual([SCENE, ASSEMBLY]);
    expect(scopesOf('page', SCENE, tree)).toEqual([SCENE]);
  });

  it('leaves out a scope the node declares for its own children', () => {
    expect(scopesOf('assembly', SCENE, tree)).toEqual([SCENE]);
    expect(scopesOf('assembly', SCENE, { ...tree, inclusive: true })).toEqual([SCENE, ASSEMBLY]);
  });
});
