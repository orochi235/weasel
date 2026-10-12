import { describe, expect, it } from 'vitest';
import type { PrefCondition, PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { comparisonOf, comparisonsFor, conditionLeaves, conditionParts, joinCondition, printCondition, testOf, withComparison } from './conditionRows';

const flag: PrefLeaf = { kind: 'boolean', name: 'On', description: '', default: false };
const count: PrefLeaf = { kind: 'number', name: 'Count', description: '', default: 0 };
const title = { kind: 'string', name: 'Title', description: '', default: '' } as PrefLeaf;
const mode = { kind: 'enum', name: 'Mode', description: '', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } as PrefLeaf;

describe('a condition as rows', () => {
  it('reads no condition as no rows, one test as one row, and a combinator as its parts', () => {
    const on = { path: 'on' };
    const off: PrefCondition = { not: { path: 'on' } };
    expect(conditionParts(undefined)).toEqual({ mode: 'all', parts: [] });
    expect(conditionParts(on).parts[0]).toBe(on);
    expect(conditionParts(off)).toEqual({ mode: 'all', parts: [off] });
    expect(conditionParts({ any: [on, off] })).toEqual({ mode: 'any', parts: [on, off] });
  });

  it('writes no rows as no condition, one row as itself, and several under their combinator', () => {
    const on = { path: 'on' };
    expect(joinCondition('all', [])).toBeUndefined();
    expect(joinCondition('any', [])).toBeUndefined();
    expect(joinCondition('all', [on])).toBe(on);
    expect(joinCondition('any', [on])).toEqual({ any: [on] });
    expect(joinCondition('all', [on, on])).toEqual({ all: [on, on] });
  });

  it('prints a condition in words', () => {
    expect(printCondition({ all: [{ path: 'on' }, { not: { any: [{ path: 'mode', in: ['a', 'b'] }, { path: 'count', atLeast: 1, below: 10 }] } }] }))
      .toBe("on is set and not (mode is one of 'a', 'b' or count is at least 1 and is below 10)");
  });
});

describe('the leaves a condition may read', () => {
  it('lists each leaf holding a value by the path it is read at, a field of an object leaf among them', () => {
    const root: PrefGroup = { name: 'Root', children: {
      view: { name: 'View', children: {
        on: flag,
        rule: { kind: 'separator', name: '', description: '', default: undefined },
        stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: { width: count } } as PrefLeaf,
      } },
    } };
    expect(conditionLeaves(root).map((l) => l.path)).toEqual(['view.on', 'view.stroke', 'view.stroke.width']);
  });

  it('names a section root\'s leaf by its own key', () => {
    const node: PrefSection = { name: 'Properties', members: { pose: { name: 'Pose', members: { 'pose.x': count } }, 'data.on': flag } };
    expect(conditionLeaves(node).map((l) => l.path)).toEqual(['pose.x', 'data.on']);
  });
});

describe('a list and a map', () => {
  const stops = { kind: 'list', name: 'Stops', description: '', default: [], item: count } as PrefLeaf;
  const weights = { kind: 'map', name: 'Weights', description: '', default: {}, item: count } as PrefLeaf;

  it('are offered, each with is set as its one comparison', () => {
    const root: PrefGroup = { name: 'Root', children: { stops, weights } };
    expect(conditionLeaves(root).map((l) => l.path)).toEqual(['stops', 'weights']);
    for (const leaf of [stops, weights]) {
      expect(comparisonsFor(leaf)).toEqual(['set']);
      expect(testOf('at', leaf)).toEqual({ path: 'at' });
      expect(comparisonOf({ path: 'at' }, leaf)).toBe('set');
    }
  });
});

describe('the comparisons a leaf\'s kind offers', () => {
  it('offers on and off for a boolean, the three choices for an enum, the orderings for a number, and set for the rest', () => {
    expect(comparisonsFor(flag)).toEqual(['on', 'off']);
    expect(comparisonsFor(mode)).toEqual(['is', 'isNot', 'in']);
    expect(comparisonsFor(count)).toEqual(['above', 'atLeast', 'below', 'atMost', 'is', 'isNot']);
    expect(comparisonsFor(title)).toEqual(['set']);
  });

  it('reads a test as one of them, or as none where it is some other test', () => {
    expect(comparisonOf({ path: 'on' }, flag)).toBe('on');
    expect(comparisonOf({ path: 'on', is: false }, flag)).toBe('off');
    expect(comparisonOf({ path: 'mode', in: ['a'] }, mode)).toBe('in');
    expect(comparisonOf({ path: 'count', atMost: 3 }, count)).toBe('atMost');
    expect(comparisonOf({ path: 'count', atLeast: 1, below: 10 }, count)).toBeUndefined();
    expect(comparisonOf({ path: 'title', is: 'x' }, title)).toBeUndefined();
    expect(comparisonOf({ path: 'title' }, title)).toBe('set');
  });

  it('keeps the value compared against where the next comparison takes one like it', () => {
    expect(withComparison({ path: 'mode', is: 'b' }, mode, 'isNot')).toEqual({ path: 'mode', isNot: 'b' });
    expect(withComparison({ path: 'mode', is: 'b' }, mode, 'in')).toEqual({ path: 'mode', in: ['b'] });
    expect(withComparison({ path: 'mode', in: ['b', 'a'] }, mode, 'is')).toEqual({ path: 'mode', is: 'b' });
    expect(withComparison({ path: 'count', above: 4 }, count, 'atMost')).toEqual({ path: 'count', atMost: 4 });
    expect(withComparison({ path: 'on' }, flag, 'off')).toEqual({ path: 'on', is: false });
  });

  it('starts a test of a leaf at its kind\'s first comparison, and keeps one moved to a leaf that takes it', () => {
    expect(testOf('on', flag)).toEqual({ path: 'on', is: true });
    expect(testOf('mode', mode)).toEqual({ path: 'mode', is: 'a' });
    expect(testOf('count', count)).toEqual({ path: 'count', above: 0 });
    expect(testOf('title', title)).toEqual({ path: 'title' });
    expect(testOf('count2', count, { path: 'count', atMost: 3 })).toEqual({ path: 'count2', atMost: 3 });
    expect(testOf('mode', mode, { path: 'count', atMost: 3 })).toEqual({ path: 'mode', is: 'a' });
    expect(testOf('mode', mode, { path: 'other', is: 'zzz' })).toEqual({ path: 'mode', is: 'a' });
  });
});
