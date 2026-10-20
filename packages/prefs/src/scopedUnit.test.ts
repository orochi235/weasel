import { describe, expect, it } from 'vitest';
import type { UnitScope } from '@weasel-js/quantity';
import type { PrefLeaf, PrefNumber, PrefObject } from './schema';
import { prefLeafInScopes, scopedPrefUnit } from './scopedUnit';
import { prefUnitAccepts, resolvePrefUnit } from './unit';

const INCHES: UnitScope = { system: { base: 'in', units: { in: 1, ft: 12 } } };
const MM: UnitScope = { system: { base: 'mm', units: { mm: 1, cm: 10 } }, scale: 1 / 25.4 };
const CM: UnitScope = { system: { base: 'cm', units: { cm: 1 } }, scale: 10 };

const X: PrefNumber = { kind: 'number', name: 'X', description: 'x', default: 0, measure: 'length' };

describe('scopedPrefUnit', () => {
  it('shows a world value in the innermost scope\'s base unit', () => {
    const unit = resolvePrefUnit(scopedPrefUnit([INCHES, MM]));
    expect(unit.suffix).toBe('mm');
    expect(unit.toDisplay(1)).toBeCloseTo(25.4, 9);
    expect(unit.fromDisplay(25.4)).toBeCloseTo(1, 9);
  });

  it('runs through every scope between', () => {
    // 1cm in the inner scope is 10mm, which is 10 / 25.4 in.
    const unit = resolvePrefUnit(scopedPrefUnit([INCHES, MM, CM]));
    expect(unit.suffix).toBe('cm');
    expect(unit.fromDisplay(1)).toBeCloseTo(10 / 25.4, 9);
  });

  it('takes every unit of the innermost system as typed text', () => {
    expect(prefUnitAccepts(scopedPrefUnit([INCHES, MM]))).toEqual({ mm: 1, cm: 10 });
  });

  it('is the root unit itself under the root alone', () => {
    expect(scopedPrefUnit([INCHES])).toMatchObject({ suffix: 'in', scale: 1 });
  });

  it('shows another unit of the system when asked', () => {
    const unit = resolvePrefUnit(scopedPrefUnit([INCHES, MM], { display: 'cm' }));
    expect(unit.toDisplay(1)).toBeCloseTo(2.54, 9);
  });
});

describe('prefLeafInScopes', () => {
  it('gives a length the unit of the scopes it is shown in', () => {
    const leaf = prefLeafInScopes(X, [INCHES, MM]) as PrefNumber;
    expect(leaf.unit).toEqual(scopedPrefUnit([INCHES, MM]));
  });

  it('keeps a leaf\'s own unit, and leaves a number that is no length alone', () => {
    const own: PrefNumber = { ...X, unit: { scale: 2 } };
    expect(prefLeafInScopes(own, [INCHES, MM])).toBe(own);
    const plain: PrefNumber = { kind: 'number', name: 'N', description: 'n', default: 0 };
    expect(prefLeafInScopes(plain, [INCHES, MM])).toBe(plain);
  });

  it('changes nothing with no scopes', () => {
    expect(prefLeafInScopes(X, undefined)).toBe(X);
  });

  it('reaches the lengths inside an object leaf', () => {
    const stroke: PrefObject = {
      kind: 'object', name: 'Stroke', description: 's', default: {},
      children: { width: { ...X, name: 'Width' }, more: { name: '', members: { inset: { ...X, name: 'Inset' } } } },
    };
    const out = prefLeafInScopes(stroke, [INCHES, MM]) as PrefObject;
    expect((out.children.width as PrefNumber).unit).toEqual(scopedPrefUnit([INCHES, MM]));
    const more = out.children.more as { members: Record<string, PrefLeaf> };
    expect((more.members.inset as PrefNumber).unit).toEqual(scopedPrefUnit([INCHES, MM]));
  });
});
