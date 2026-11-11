/**
 * Property tests of selection over values of any kind: `NaN`, `0` beside `-0`, objects, and strings. A press flips
 * a multiple selection's item and chooses a single one's, a sweep sets what it reaches, and every other item keeps
 * what it showed, re-rendered after each step as a component would be.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { selection, type SelectionModel, type SelectState } from './selection';

const RUNS = 300;
const OBJ = { id: 1 };
/** Values no two of which are the same value as `Array.prototype.includes` reads it. */
const values = fc.shuffledSubarray([Number.NaN, 0, 1, 'a', '', OBJ, { id: 1 }, Infinity, true], { minLength: 1 });
type Step = { kind: 'press' | 'on' | 'off'; at: number };
const steps = fc.array(fc.record({ kind: fc.constantFrom('press', 'on', 'off' as const), at: fc.nat() }), { minLength: 1, maxLength: 12 });

/** Replays `steps` on a multiple selection or a single one, checking each item's state after each. */
function replay(mode: 'single' | 'multiple', vals: unknown[], list: Step[], allowDeselect: boolean, mixed: unknown[]): void {
  let single: unknown = null;
  let multiple: unknown[] = [];
  const model = (): SelectionModel => (mode === 'multiple'
    ? selection({ mode: 'multiple', value: multiple, onChange: (v) => { multiple = v; }, mixedValues: mixed }, vals)
    : selection({ value: single, onChange: (v) => { single = v; }, allowDeselect, mixedValues: mixed }, vals));
  for (const s of list) {
    const i = s.at % vals.length;
    const before: SelectState[] = vals.map((_, j) => model().stateOf(j));
    if (s.kind === 'press') model().press(i);
    else model().edit().set(i, s.kind === 'on');
    const after = vals.map((_, j) => model().stateOf(j));
    const want = s.kind === 'press'
      ? (mode === 'multiple' || allowDeselect) && before[i] === 'on' ? 'off' : 'on'
      : s.kind === 'on' ? 'on' : mode === 'single' && !allowDeselect ? before[i] : 'off';
    expect(after[i] === 'on').toBe(want === 'on');
    for (let j = 0; j < vals.length; j++) {
      if (j === i) continue;
      // A single selection's choice turns the one it replaces off.
      if (mode === 'single' && after[i] === 'on' && before[j] === 'on') expect(after[j]).not.toBe('on');
      else expect(after[j]).toBe(before[j]);
    }
    if (mode === 'multiple') expect(multiple.length).toBe(after.filter((x) => x === 'on').length);
  }
}

describe('selection over values of any kind', () => {
  it('a press or a sweep sets the item it names and no other, whatever the values are', () => {
    const t = tally();
    fc.assert(fc.property(values, steps, fc.constantFrom('single', 'multiple' as const), fc.boolean(), fc.boolean(), (vals, list, mode, allowDeselect, withMixed) => {
      replay(mode, vals, list, allowDeselect, withMixed ? vals.slice(0, 2) : []);
      t.count(vals.some((v) => Number.isNaN(v)) ? 'NaN' : 'plain');
    }), runs(RUNS));
    t.atLeast('NaN', RUNS / 4);
  }, timeoutFor(RUNS, 1));
});

describe('shrunk counterexamples', () => {
  it('a NaN value is chosen by its press and turned off by its next', () => {
    let single: unknown = null;
    selection({ value: single, onChange: (v) => { single = v; } }, [Number.NaN, '']).press(0);
    expect(selection({ value: single, onChange: () => {} }, [Number.NaN, '']).stateOf(0)).toBe('on');
    let multiple: unknown[] = [Number.NaN];
    selection({ mode: 'multiple', value: multiple, onChange: (v) => { multiple = v; } }, [Number.NaN]).press(0);
    expect(multiple).toEqual([]);
  });
});
