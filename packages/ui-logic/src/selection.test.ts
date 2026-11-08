import { describe, expect, it } from 'vitest';
import { selection, selectionKeys, selectionOfEach, sweepFrom, type OwnSelection } from './selection';

const VALUES = ['a', 'b', 'c'] as const;

describe('selection — single', () => {
  it('chooses on a press, and clears the chosen one only with allowDeselect', () => {
    const seen: (string | null)[] = [];
    const m = selection<string>({ value: 'a', onChange: (v) => seen.push(v) }, VALUES);
    m.press(1);
    m.press(0);
    expect(seen).toEqual(['b']);
    selection<string>({ value: 'a', allowDeselect: true, onChange: (v) => seen.push(v) }, VALUES).press(0);
    expect(seen).toEqual(['b', null]);
  });

  it('draws mixed values the value does not hold', () => {
    const m = selection<string>({ value: 'a', mixedValues: ['a', 'b'], onChange: () => {} }, VALUES);
    expect(VALUES.map((_, i) => m.stateOf(i))).toEqual(['on', 'mixed', 'off']);
  });

  it('chooses as the arrows land, unless it does not follow focus', () => {
    const seen: (string | null)[] = [];
    const follows = selectionKeys(selection<string>({ value: 'b', onChange: (v) => seen.push(v) }, VALUES), 3);
    expect(follows.tabStop).toBe(1);
    follows.landed?.(2);
    expect(seen).toEqual(['c']);
    const still = selectionKeys(selection<string>({ value: 'b', followsFocus: false, onChange: (v) => seen.push(v) }, VALUES), 3);
    expect(still.landed).toBeUndefined();
    still.activate?.(0);
    expect(seen).toEqual(['c', 'a']);
  });
});

describe('selection — multiple', () => {
  it('flips a press, a mixed one turning on', () => {
    const seen: string[][] = [];
    const m = selection<string>({ mode: 'multiple', value: ['a'], mixedValues: ['b'], onChange: (v) => seen.push(v) }, VALUES);
    m.press(0);
    m.press(1);
    expect(seen).toEqual([[], ['a', 'b']]);
  });

  it('runs an edit from its own copy, so changes faster than a re-render all land, and reverts it', () => {
    const seen: string[][] = [];
    const edit = selection<string>({ mode: 'multiple', value: ['c'], onChange: (v) => seen.push(v) }, VALUES).edit();
    edit.set(0, true);
    edit.set(1, true);
    edit.set(1, true);
    edit.revert();
    expect(seen).toEqual([['c', 'a'], ['c', 'a', 'b'], ['c']]);
  });

  it('leaves the arrows to focus, Space and Enter pressing', () => {
    const keys = selectionKeys(selection<string>({ mode: 'multiple', value: [], onChange: () => {} }, VALUES), 3, (i) => i !== 2);
    expect(keys.tabStop).toBeUndefined();
    expect(keys.landed).toBeUndefined();
    expect(keys.activate).toBeDefined();
  });
});

describe('selectionOfEach', () => {
  it('calls only the items an edit changes, and puts each back on revert', () => {
    const calls: string[] = [];
    const items: OwnSelection[] = VALUES.map((v, i) => ({ selected: i === 1, onChange: (on) => calls.push(`${v}:${on}`) }));
    const m = selectionOfEach(items);
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
    const fromMixed = sweepFrom(selection<string>(spec(['c']), VALUES), 1);
    fromMixed.reach(1);
    fromMixed.reach(0);
    const fromOn = sweepFrom(selection<string>(spec(['a', 'c']), VALUES), 0);
    fromOn.reach(0);
    fromOn.reach(2);
    fromOn.revert();
    expect(seen).toEqual([['c', 'b'], ['c', 'b', 'a'], ['c'], [], ['a', 'c']]);
  });
});
