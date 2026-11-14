import { describe, expect, it } from 'vitest';
import type { PrefCondition } from '@weasel-js/prefs';
import { groupCondition, groupOf, nestedQuantifier, rootCondition, rootGroup, rowCondition, testRowOf } from './conditionGroups';

const on = { path: 'on' };
const off: PrefCondition = { not: on };

describe('a condition as a group of rows', () => {
  it('reads an all and an any as their parts, and the not of each as none of and not all of them', () => {
    expect(groupOf({ all: [on, off] })).toEqual({ quantifier: 'all', parts: [on, off] });
    expect(groupOf({ any: [on, off] })).toEqual({ quantifier: 'any', parts: [on, off] });
    expect(groupOf({ not: { any: [on, off] } })).toEqual({ quantifier: 'none', parts: [on, off] });
    expect(groupOf({ not: { all: [on, off] } })).toEqual({ quantifier: 'notAll', parts: [on, off] });
  });

  it('reads a not of a not as neither', () => {
    expect(groupOf({ not: { not: { any: [on] } } })).toEqual({ quantifier: 'any', parts: [on] });
    expect(testRowOf({ not: { not: on } })).toEqual({ test: on, negated: false });
  });

  it('reads the not of a test as none of that one test', () => {
    expect(groupOf(off)).toEqual({ quantifier: 'none', parts: [on] });
  });

  it('writes each quantifier back as the condition it read', () => {
    for (const condition of [{ all: [on, off] }, { any: [on] }, { not: { any: [on, off] } }, { not: { all: [] } }] as PrefCondition[]) {
      expect(groupCondition(groupOf(condition))).toEqual(condition);
    }
  });

  it('reads a test and the not of one as a row, and a combinator as none', () => {
    expect(testRowOf(on)).toEqual({ test: on, negated: false });
    expect(testRowOf(off)).toEqual({ test: on, negated: true });
    expect(testRowOf({ all: [on] })).toBeUndefined();
    expect(rowCondition({ test: on, negated: true })).toEqual(off);
    expect(rowCondition({ test: on, negated: false })).toBe(on);
  });

  it('starts a group added inside another at the quantifier the outer one is not', () => {
    expect(nestedQuantifier('all')).toBe('any');
    expect(nestedQuantifier('notAll')).toBe('any');
    expect(nestedQuantifier('any')).toBe('all');
    expect(nestedQuantifier('none')).toBe('all');
  });
});

describe('a whole condition as its root group', () => {
  it('reads no condition as no rows, a test or the not of one as one row, and a combinator as its parts', () => {
    expect(rootGroup(undefined)).toEqual({ quantifier: 'all', parts: [] });
    expect(rootGroup(on).parts[0]).toBe(on);
    expect(rootGroup(off)).toEqual({ quantifier: 'all', parts: [off] });
    expect(rootGroup({ any: [on, off] })).toEqual({ quantifier: 'any', parts: [on, off] });
    expect(rootGroup({ not: { any: [on, off] } })).toEqual({ quantifier: 'none', parts: [on, off] });
  });

  it('writes no rows as no condition, one row under all as itself, and anything else under its quantifier', () => {
    expect(rootCondition({ quantifier: 'all', parts: [] })).toBeUndefined();
    expect(rootCondition({ quantifier: 'none', parts: [] })).toBeUndefined();
    expect(rootCondition({ quantifier: 'all', parts: [on] })).toBe(on);
    expect(rootCondition({ quantifier: 'any', parts: [on] })).toEqual({ any: [on] });
    expect(rootCondition({ quantifier: 'none', parts: [on] })).toEqual({ not: { any: [on] } });
    expect(rootCondition({ quantifier: 'all', parts: [on, on] })).toEqual({ all: [on, on] });
  });
});
