import { describe, expect, it } from 'vitest';
import type { PrefCondition, PrefGroup, PrefLeaf, PrefList, PrefTest } from '@weasel-js/prefs';
import { rowCondition, type TestRow } from './conditionGroups';
import { conditionLeaves, type ConditionLeaf } from './conditionLeaves';
import { clauseChoices, clausesOf, comparisonsFor, openBound, printOperators, rowAt, withBound, withComparison, withoutClause, withValue, type Comparison } from './conditionRows';

const flag: PrefLeaf = { kind: 'boolean', name: 'On', description: '', default: false };
const count: PrefLeaf = { kind: 'number', name: 'Count', description: '', default: 0 };
const title = { kind: 'string', name: 'Title', description: '', default: '' } as PrefLeaf;
const mode = { kind: 'enum', name: 'Mode', description: '', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } as PrefLeaf;

const row = (test: PrefTest, negated = false): TestRow => ({ test, negated });
/** The condition a row on `at` comes to, started fresh or moved from the test `was`. */
const at = (leaf: ConditionLeaf, was?: PrefTest): PrefCondition => rowCondition(rowAt(leaf, was && row(was)));
/** The condition `test` comes to once its clause `i` is made `next`. */
const compared = (test: PrefTest, leaf: PrefLeaf, next: Comparison, i = 0): PrefCondition => rowCondition(withComparison(row(test), leaf, next, i));

describe('a list and a map', () => {
  const stops = { kind: 'list', name: 'Stops', description: '', default: [], item: count } as PrefLeaf;
  const weights = { kind: 'map', name: 'Weights', description: '', default: {}, item: count } as PrefLeaf;

  it('are offered, each as set or not set', () => {
    const root: PrefGroup = { name: 'Root', children: { stops, weights } };
    expect(conditionLeaves(root).map((l) => l.path)).toEqual(['stops', 'weights']);
    for (const leaf of [stops, weights]) {
      expect(comparisonsFor(leaf)).toEqual(['set', 'unset']);
      expect(at({ path: 'at', leaf })).toEqual({ path: 'at' });
      expect(clausesOf(row({ path: 'at' }), leaf)).toEqual(['set']);
    }
  });
});

describe('the comparisons a leaf\'s kind offers', () => {
  it('offers on and off for a boolean, its options for an enum, the orderings for a number, and set or not for the rest', () => {
    expect(comparisonsFor(flag)).toEqual(['on', 'off']);
    expect(comparisonsFor(mode)).toEqual(['is', 'isNot', 'in', 'notIn']);
    expect(comparisonsFor(count)).toEqual(['above', 'atLeast', 'below', 'atMost', 'is', 'isNot']);
    expect(comparisonsFor(title)).toEqual(['set', 'unset']);
  });

  it('reads a test as one comparison for each operator it holds, or as none where the leaf\'s kind offers no such test', () => {
    expect(clausesOf(row({ path: 'on' }), flag)).toEqual(['on']);
    expect(clausesOf(row({ path: 'on', is: false }), flag)).toEqual(['off']);
    expect(clausesOf(row({ path: 'mode', in: ['a'] }), mode)).toEqual(['in']);
    expect(clausesOf(row({ path: 'count', atMost: 3 }), count)).toEqual(['atMost']);
    expect(clausesOf(row({ path: 'count', atLeast: 1, below: 10 }), count)).toEqual(['atLeast', 'below']);
    expect(clausesOf(row({ path: 'title', is: 'x' }), title)).toBeUndefined();
    expect(clausesOf(row({ path: 'title' }), title)).toEqual(['set']);
    expect(clausesOf(row({ path: 'mode' }), mode)).toBeUndefined();
  });

  it('reads the not of is one of and of is set as comparisons, and any other not as none', () => {
    expect(clausesOf(row({ path: 'mode', in: ['a'] }, true), mode)).toEqual(['notIn']);
    expect(clausesOf(row({ path: 'title' }, true), title)).toEqual(['unset']);
    expect(clausesOf(row({ path: 'mode', is: 'a' }, true), mode)).toBeUndefined();
    expect(clausesOf(row({ path: 'on' }, true), flag)).toBeUndefined();
    expect(clausesOf(row({ path: 'count', atLeast: 1, below: 10 }, true), count)).toBeUndefined();
  });

  it('keeps the value compared against where the next comparison takes one like it', () => {
    expect(compared({ path: 'mode', is: 'b' }, mode, 'isNot')).toEqual({ path: 'mode', isNot: 'b' });
    expect(compared({ path: 'mode', is: 'b' }, mode, 'in')).toEqual({ path: 'mode', in: ['b'] });
    expect(compared({ path: 'mode', in: ['b', 'a'] }, mode, 'is')).toEqual({ path: 'mode', is: 'b' });
    expect(compared({ path: 'count', above: 4 }, count, 'atMost')).toEqual({ path: 'count', atMost: 4 });
    expect(compared({ path: 'on' }, flag, 'off')).toEqual({ path: 'on', is: false });
  });

  it('writes none of and not set as the not of a test, and drops the not for any other comparison', () => {
    expect(compared({ path: 'mode', in: ['b'] }, mode, 'notIn')).toEqual({ not: { path: 'mode', in: ['b'] } });
    expect(compared({ path: 'title' }, title, 'unset')).toEqual({ not: { path: 'title' } });
    expect(rowCondition(withComparison(row({ path: 'mode', in: ['b'] }, true), mode, 'is'))).toEqual({ path: 'mode', is: 'b' });
    expect(rowCondition(withComparison(row({ path: 'title' }, true), title, 'set'))).toEqual({ path: 'title' });
    expect(rowCondition(withValue(row({ path: 'mode', in: ['b'] }, true), 'notIn', ['a', 'b']))).toEqual({ not: { path: 'mode', in: ['a', 'b'] } });
  });

  it('starts a row on a leaf at its kind\'s first comparison, and keeps one moved to a leaf that takes it', () => {
    expect(at({ path: 'on', leaf: flag })).toEqual({ path: 'on', is: true });
    expect(at({ path: 'mode', leaf: mode })).toEqual({ path: 'mode', is: 'a' });
    expect(at({ path: 'count', leaf: count })).toEqual({ path: 'count', above: 0 });
    expect(at({ path: 'title', leaf: title })).toEqual({ path: 'title' });
    expect(at({ path: 'count2', leaf: count }, { path: 'count', atMost: 3 })).toEqual({ path: 'count2', atMost: 3 });
    expect(at({ path: 'mode', leaf: mode }, { path: 'count', atMost: 3 })).toEqual({ path: 'mode', is: 'a' });
    expect(at({ path: 'mode', leaf: mode }, { path: 'other', is: 'zzz' })).toEqual({ path: 'mode', is: 'a' });
  });
});

describe('a number\'s range', () => {
  const range: PrefTest = { path: 'count', atLeast: 1, below: 10 };

  it('offers the bound a row lacks, and none once both ends are bound or the row holds one number', () => {
    expect(openBound(count, ['atLeast'])).toBe('atMost');
    expect(openBound(count, ['below'])).toBe('atLeast');
    expect(openBound(count, ['atLeast', 'below'])).toBeUndefined();
    expect(openBound(count, ['is'])).toBeUndefined();
    expect(openBound(count, ['isNot'])).toBeUndefined();
    expect(openBound(mode, ['is'])).toBeUndefined();
  });

  it('adds a bound at the number the other holds, and takes one away again', () => {
    expect(withBound(row({ path: 'count', atLeast: 4 }), 'atMost').test).toEqual({ path: 'count', atLeast: 4, atMost: 4 });
    expect(withoutClause(row(range), 'below').test).toEqual({ path: 'count', atLeast: 1 });
  });

  it('changes one comparison and one value of the two, and leaves the other', () => {
    expect(compared(range, count, 'atMost', 1)).toEqual({ path: 'count', atLeast: 1, atMost: 10 });
    expect(compared(range, count, 'above', 0)).toEqual({ path: 'count', above: 1, below: 10 });
    expect(withValue(row(range), 'below', 64).test).toEqual({ path: 'count', atLeast: 1, below: 64 });
  });

  it('offers a comparison of a range the ones its other does not make', () => {
    expect(clauseChoices(count, ['atLeast', 'below'], 0)).toEqual(['above', 'atLeast', 'isNot']);
    expect(clauseChoices(count, ['atLeast', 'below'], 1)).toEqual(['below', 'atMost', 'isNot']);
    expect(clauseChoices(count, ['atLeast'], 0)).toEqual(comparisonsFor(count));
  });

  it('says a test with no leaf to draw it by in words', () => {
    expect(printOperators(range)).toBe('is at least 1 and is below 10');
    expect(printOperators({ path: 'mode', in: ['a', 'b'] })).toBe("is one of 'a', 'b'");
    expect(printOperators({ path: 'title' })).toBe('is set');
  });
});

describe('the entry a condition\'s node is drawn in', () => {
  const phase = { kind: 'object', name: 'Phase', description: '', default: {}, children: { mode, count } } as PrefLeaf;
  const phases = { kind: 'list', name: 'Phases', description: '', default: [], item: phase } as PrefList;
  const root: PrefGroup = { name: 'Root', children: { mode, phases } };

  it('starts, moves, and re-compares a row without losing where it reads from', () => {
    const [inEntry, entryCount, atRoot] = conditionLeaves(root, phases);
    expect(at(inEntry!)).toEqual({ from: 'item', path: 'mode', is: 'a' });
    expect(at(entryCount!, { path: 'other', atMost: 3 })).toEqual({ from: 'item', path: 'count', atMost: 3 });
    expect(at(atRoot!, { from: 'item', path: 'mode', is: 'b' })).toEqual({ path: 'mode', is: 'b' });
    expect(compared({ from: 'item', path: 'mode', is: 'b' }, mode, 'isNot')).toEqual({ from: 'item', path: 'mode', isNot: 'b' });
    expect(compared({ from: 'item', path: 'count', above: 1 }, count, 'atMost')).toEqual({ from: 'item', path: 'count', atMost: 1 });
  });
});
