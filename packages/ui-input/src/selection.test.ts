import { describe, expect, it } from 'vitest';
import { createSelectionModel, selectionKeys, createEachSelectionModel, soloFrom, soloSweepFrom, sweepFrom, type OwnSelection } from './selection';

const VALUES = ['a', 'b', 'c'] as const;

describe('selection — single', () => {
  it('chooses on a press, and clears the chosen one only with allowDeselect', () => {
    const seen: (string | null)[] = [];
    const m = createSelectionModel<string>({ value: 'a', onChange: (v) => seen.push(v) }, VALUES);
    m.press(1);
    m.press(0);
    expect(seen).toEqual(['b']);
    createSelectionModel<string>({ value: 'a', allowDeselect: true, onChange: (v) => seen.push(v) }, VALUES).press(0);
    expect(seen).toEqual(['b', null]);
  });

  it('draws mixed values the value does not hold', () => {
    const m = createSelectionModel<string>({ value: 'a', mixedValues: ['a', 'b'], onChange: () => {} }, VALUES);
    expect(VALUES.map((_, i) => m.stateOf(i))).toEqual(['on', 'mixed', 'off']);
  });

  it('chooses as the arrows land, unless it does not follow focus', () => {
    const seen: (string | null)[] = [];
    const follows = selectionKeys(createSelectionModel<string>({ value: 'b', onChange: (v) => seen.push(v) }, VALUES), 3);
    expect(follows.tabStop).toBe(1);
    follows.landed?.(2);
    expect(seen).toEqual(['c']);
    const still = selectionKeys(createSelectionModel<string>({ value: 'b', followsFocus: false, onChange: (v) => seen.push(v) }, VALUES), 3);
    expect(still.landed).toBeUndefined();
    still.activate?.(0);
    expect(seen).toEqual(['c', 'a']);
  });
});

describe('selection — multiple', () => {
  it('flips a press, a mixed one turning on', () => {
    const seen: string[][] = [];
    const m = createSelectionModel<string>({ mode: 'multiple', value: ['a'], mixedValues: ['b'], onChange: (v) => seen.push(v) }, VALUES);
    m.press(0);
    m.press(1);
    expect(seen).toEqual([[], ['a', 'b']]);
  });

  it('runs an edit from its own copy, so changes faster than a re-render all land, and reverts it', () => {
    const seen: string[][] = [];
    const edit = createSelectionModel<string>({ mode: 'multiple', value: ['c'], onChange: (v) => seen.push(v) }, VALUES).edit();
    edit.set(0, true);
    edit.set(1, true);
    edit.set(1, true);
    edit.revert();
    expect(seen).toEqual([['c', 'a'], ['c', 'a', 'b'], ['c']]);
  });

  it('leaves the arrows to focus, Space and Enter pressing', () => {
    const keys = selectionKeys(createSelectionModel<string>({ mode: 'multiple', value: [], onChange: () => {} }, VALUES), 3, (i) => i !== 2);
    expect(keys.tabStop).toBeUndefined();
    expect(keys.landed).toBeUndefined();
    expect(keys.activate).toBeDefined();
  });
});

describe('createEachSelectionModel', () => {
  it('calls only the items an edit changes, and puts each back on revert', () => {
    const calls: string[] = [];
    const items: OwnSelection[] = VALUES.map((v, i) => ({ selected: i === 1, onChange: (on) => calls.push(`${v}:${on}`) }));
    const m = createEachSelectionModel(items);
    expect(VALUES.map((_, i) => m.stateOf(i))).toEqual(['off', 'on', 'off']);
    const edit = m.edit();
    edit.set(0, true);
    edit.set(1, true);
    edit.set(2, true);
    edit.set(2, false);
    edit.revert();
    expect(calls).toEqual(['a:true', 'c:true', 'c:false', 'a:false']);
  });
});

describe('sweepFrom', () => {
  it('turns on what it reaches from an off or mixed press, and off from an on one', () => {
    const seen: string[][] = [];
    const spec = (value: string[]) => ({ mode: 'multiple' as const, value, mixedValues: ['b'], onChange: (v: string[]) => seen.push(v) });
    const fromMixed = sweepFrom(createSelectionModel<string>(spec(['c']), VALUES), 1);
    fromMixed.reach(1);
    fromMixed.reach(0);
    const fromOn = sweepFrom(createSelectionModel<string>(spec(['a', 'c']), VALUES), 0);
    fromOn.reach(0);
    fromOn.reach(2);
    fromOn.revert();
    expect(seen).toEqual([['c', 'b'], ['c', 'b', 'a'], ['c'], [], ['a', 'c']]);
  });
});

describe('soloFrom', () => {
  const FIVE = ['a', 'b', 'c', 'd', 'e'] as const;
  const multiple = (value: string[], seen: string[][], mixedValues: string[] = []) =>
    createSelectionModel<string>({ mode: 'multiple', value, mixedValues, onChange: (v) => seen.push(v) }, FIVE);

  it('turns the item on and every other one off, in one change, leaving an item `enabled` refuses alone', () => {
    const seen: string[][] = [];
    soloFrom(multiple(['a', 'c', 'e'], seen), 1, 5, (i) => i !== 2);
    expect(seen).toEqual([['c', 'b']]);
  });

  it('turns every item back on when the item is already the only one on, counting a mixed one as off', () => {
    const seen: string[][] = [];
    soloFrom(multiple(['b'], seen, ['d']), 1, 5);
    expect(seen).toEqual([['b', 'a', 'c', 'd', 'e']]);
    soloFrom(multiple(['b'], seen, ['d']), 3, 5);
    expect(seen.at(-1)).toEqual(['d']);
  });

  it('reports each owned item that changes', () => {
    const seen: [number, boolean][] = [];
    const items: OwnSelection[] = [true, true, false].map((selected, i) => ({ selected, onChange: (to) => seen.push([i, to]) }));
    soloFrom(createEachSelectionModel(items), 2, 3);
    expect(seen).toEqual([[0, false], [1, false], [2, true]]);
  });

  it('is a press in a single selection', () => {
    const seen: (string | null)[] = [];
    soloFrom(createSelectionModel<string>({ value: 'a', onChange: (v) => seen.push(v) }, FIVE), 3, 5);
    expect(seen).toEqual(['d']);
  });

  it('is what Space or Enter does with Alt held', () => {
    const seen: string[][] = [];
    const keys = selectionKeys(multiple(['a', 'b'], seen), 5);
    keys.activate?.(4, { alt: true });
    keys.activate?.(4);
    expect(seen).toEqual([['e'], ['a', 'b', 'e']]);
  });
});

describe('soloSweepFrom', () => {
  const FIVE = ['a', 'b', 'c', 'd', 'e'] as const;
  const multiple = (value: string[], seen: string[][]) =>
    createSelectionModel<string>({ mode: 'multiple', value, onChange: (v) => seen.push(v) }, FIVE);

  it('turns on what it has reached and every other item off, from the states at the press', () => {
    const seen: string[][] = [];
    const run = soloSweepFrom(multiple(['c', 'd'], seen), 0, 5, (i) => i !== 4);
    run.reach(0);
    run.reach(1);
    run.reach(0);
    expect(seen).toEqual([['a'], ['a', 'b']]);
  });

  it('turns every item back on from the only one on, until it reaches a second', () => {
    const seen: string[][] = [];
    const run = soloSweepFrom(multiple(['b'], seen), 1, 5);
    run.reach(1);
    expect(seen.at(-1)).toEqual(['b', 'a', 'c', 'd', 'e']);
    run.reach(2);
    expect(seen.at(-1)).toEqual(['b', 'c']);
  });

  it('puts back the states at the press', () => {
    const seen: string[][] = [];
    const run = soloSweepFrom(multiple(['c', 'd'], seen), 0, 5);
    run.reach(0);
    run.reach(3);
    run.revert();
    expect(seen.at(-1)).toEqual(['c', 'd']);
  });
});
