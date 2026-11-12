/**
 * Property tests of a highlight the list no longer holds: a list that shrank under it, or an index that names no
 * item. The arrows, Home and End, typeahead, row keys, and grid keys land on an item that is there or on nothing,
 * read only items that are there, and step from such a highlight as from none.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { rovingGridTarget, tileRows } from './grid';
import { rovingKey, rowKey, stepStop, type ListShape } from './list';
import { items, runs, tally, timeoutFor, type Item } from './pbt.fixture';
import { typeaheadMatch } from './typeahead';

const RUNS = 400;
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'a', 'b', ' ', 'Enter'];

/** An index past either end, or not a whole number, beside ones in range. */
const stale = (n: number): fc.Arbitrary<number> => fc.oneof(
  fc.integer({ min: n, max: n + 5 }),
  fc.integer({ min: -5, max: -1 }),
  fc.constantFrom(0.5, 1.5, Number.NaN, Infinity, -Infinity),
);

/** A shape whose readers throw on an item that is not there. */
const strict = (wrap: boolean): ListShape<Item> & { label(item: Item): string } => ({
  canStop: (item) => {
    if (item === undefined) throw new Error('read an item that is not there');
    return item.stop;
  },
  label: (item) => {
    if (item === undefined) throw new Error('read an item that is not there');
    return item.label;
  },
  wrap,
  orientation: 'both',
});

const inList = (list: readonly Item[], at: number | null): boolean => at === null || (Number.isInteger(at) && list[at]?.stop === true);

describe('a highlight the list no longer holds', () => {
  it('stepStop and rovingKey step from it as from no highlight, onto a stop that is there', () => {
    const t = tally();
    fc.assert(fc.property(items.chain((list) => fc.tuple(fc.constant(list), stale(list.length))), fc.constantFrom(1, -1 as const), fc.boolean(), ([list, from], dir, wrap) => {
      const shape = strict(wrap);
      const got = stepStop(list, from, dir as 1 | -1, shape);
      expect(inList(list, got)).toBe(true);
      expect(got).toBe(stepStop(list, null, dir as 1 | -1, shape));
      for (const key of KEYS) {
        const r = rovingKey(list, from, key, shape);
        if (r.handled) expect(inList(list, r.at)).toBe(true);
      }
      t.count(got === null ? 'none' : 'landed');
    }), runs(RUNS));
    t.atLeast('landed', RUNS / 3);
  }, timeoutFor(RUNS, 1));

  it('typeahead searches from it as from no highlight', () => {
    fc.assert(fc.property(items.chain((list) => fc.tuple(fc.constant(list), stale(list.length))), fc.constantFrom('a', 'b', 'ap', 'é', 'İ'), ([list, from], query) => {
      const shape = strict(true);
      const got = typeaheadMatch(list, from, query, shape);
      expect(inList(list, got)).toBe(true);
      expect(got).toBe(typeaheadMatch(list, null, query, shape));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('rowKey moves from it only onto rows that are there', () => {
    fc.assert(fc.property(items.chain((list) => fc.tuple(fc.constant(list), stale(list.length))), fc.constantFrom(...KEYS), fc.boolean(), ([list, at], key, shift) => {
      const shape = { ...strict(true), orientation: 'vertical' as const, typeahead: true, activate: true, selectAll: true };
      const got = rowKey(list, at, { key, shiftKey: shift }, shape);
      if (got?.kind === 'move') expect(inList(list, got.at)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('a grid key from an item that is not there lands on an enabled one or nowhere', () => {
    fc.assert(fc.property(
      fc.array(fc.boolean(), { maxLength: 12 }).chain((enabled) => fc.tuple(fc.constant(enabled), stale(enabled.length), fc.integer({ min: 1, max: 5 }))),
      fc.constantFrom(...KEYS),
      ([enabled, current, columns], key) => {
        const got = rovingGridTarget(current, key, enabled, tileRows(enabled.length, columns));
        expect(got === null || (Number.isInteger(got) && enabled[got] === true)).toBe(true);
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('shrunk counterexamples', () => {
  it('stepping back from past the end of a list that shrank to nothing reads no item', () => {
    expect(stepStop([], -1, 1, strict(false))).toBeNull();
    expect(stepStop([{ label: 'a', stop: true }, { label: 'b', stop: true }], 5, -1, strict(false))).toBe(1);
  });

  it('typeahead and the arrows from an index between two items search from the start', () => {
    const list: Item[] = [{ label: 'ab', stop: true }, { label: 'a', stop: true }];
    expect(typeaheadMatch(list, 0.5, 'a', strict(true))).toBe(0);
    expect(rovingKey(list, 0.5, 'ArrowUp', strict(true))).toEqual({ handled: true, at: 1 });
  });
});
