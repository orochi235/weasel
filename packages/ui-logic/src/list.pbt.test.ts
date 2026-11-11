/**
 * Property tests of list navigation: `stepStop`, `rovingKey`, and `rowKey` against a plain model of the stops,
 * typeahead against "the first match after the highlight", and `treeKey` on trees drawn as their shown rows.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { firstStop, rovingKey, rowKey, stepStop, type ListShape } from './list';
import { at, items, runs, tally, timeoutFor, type Item } from './pbt.fixture';
import { treeKey, type TreeShape } from './tree';
import { isOneChar, typeaheadMatch, typeaheadStep, type TypeaheadBuffer } from './typeahead';

const RUNS = 300;
const shapeOf = (wrap: boolean): ListShape<Item> => ({ canStop: (i) => i.stop, wrap });

/** Where one step goes, read off the list of stops. */
function modelStep(list: readonly Item[], from: number | null, dir: 1 | -1, wrap: boolean): number | null {
  const stops = list.flatMap((it, i) => (it.stop ? [i] : []));
  if (stops.length === 0) return null;
  if (from === null) return dir === 1 ? stops[0]! : stops.at(-1)!;
  const ahead = dir === 1 ? stops.filter((s) => s > from) : stops.filter((s) => s < from).reverse();
  if (ahead.length > 0) return ahead[0]!;
  if (wrap) return dir === 1 ? stops[0]! : stops.at(-1)!;
  return list[from]!.stop ? from : null;
}

describe('stepStop and rovingKey', () => {
  it('step to the next stop each way, wrapping or holding at an end, as the stops say', () => {
    const t = tally();
    fc.assert(fc.property(
      items.chain((list) => fc.tuple(fc.constant(list), at(list.length), fc.constantFrom<1 | -1>(1, -1), fc.boolean())),
      ([list, from, dir, wrap]) => {
        const got = stepStop(list, from, dir, shapeOf(wrap));
        expect(got).toBe(modelStep(list, from, dir, wrap));
        if (got !== null) expect(list[got]!.stop).toBe(true);
        t.count(got === null ? 'none' : got === from ? 'stay' : 'moved');
        if (from !== null && got !== null && (dir === 1 ? got < from : got > from)) t.count('wrapped');
      },
    ), runs(RUNS));
    t.atLeast('moved', RUNS / 3);
    t.atLeast('stay', 10);
    t.atLeast('none', 10);
    t.atLeast('wrapped', 10);
  });

  it('Home and End land on the first and last stop; arrows step along the orientation only', () => {
    const t = tally();
    const keys = ['Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'a', 'Enter'];
    fc.assert(fc.property(
      items.chain((list) => fc.tuple(fc.constant(list), at(list.length))),
      fc.constantFrom(...keys), fc.constantFrom('vertical', 'horizontal', 'both' as const), fc.constantFrom('ltr', 'rtl' as const),
      ([list, from], key, orientation, dir) => {
        const shape: ListShape<Item> = { canStop: (i) => i.stop, orientation, dir };
        const got = rovingKey(list, from, key, shape);
        if (key === 'Home') expect(got).toEqual({ handled: true, at: firstStop(list, shape) });
        else if (key === 'End') expect(got).toEqual({ handled: true, at: modelStep(list, null, -1, true) });
        else {
          const vertical = key === 'ArrowUp' || key === 'ArrowDown';
          const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
          const answers = (vertical && orientation !== 'horizontal') || (horizontal && orientation !== 'vertical');
          if (!answers) { expect(got).toEqual({ handled: false }); t.count('unhandled'); return; }
          const forward = key === 'ArrowDown' || key === (dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
          expect(got).toEqual({ handled: true, at: modelStep(list, from, forward ? 1 : -1, true) });
          t.count('arrow');
        }
      },
    ), runs(RUNS));
    t.atLeast('arrow', RUNS / 4);
    t.atLeast('unhandled', RUNS / 4);
  });

  it('rowKey moves where rovingKey does, extending with Shift, and takes Mod+A only on its own platform', () => {
    const t = tally();
    fc.assert(fc.property(
      items.filter((l) => l.length > 0).chain((list) => fc.tuple(fc.constant(list), fc.integer({ min: 0, max: list.length - 1 }))),
      fc.constantFrom('ArrowUp', 'ArrowDown', 'Home', 'End', 'a', 'A', 'Enter', ' ', 'x', 'Tab'),
      fc.record({ shiftKey: fc.boolean(), ctrlKey: fc.boolean(), metaKey: fc.boolean(), altKey: fc.boolean() }),
      fc.record({ selectAll: fc.boolean(), activate: fc.boolean(), typeahead: fc.boolean() }),
      fc.boolean(), fc.boolean(),
      ([list, from], key, mods, flags, searching, apple) => {
        const shape = { canStop: (i: Item) => i.stop, ...flags };
        const got = rowKey(list, from, { key, ...mods }, shape, searching, apple);
        const mod = apple ? mods.metaKey && !mods.ctrlKey : mods.ctrlKey && !mods.metaKey;
        if (flags.selectAll && key.toLowerCase() === 'a' && mod && !mods.altKey && !mods.shiftKey) {
          expect(got).toEqual({ kind: 'selectAll' });
          t.count('selectAll');
          return;
        }
        const step = rovingKey(list, from, key, shape);
        if (step.handled) { expect(got).toEqual({ kind: 'move', at: step.at, extend: mods.shiftKey }); t.count('move'); return; }
        if (key === ' ' && flags.typeahead && searching) { expect(got).toEqual({ kind: 'type', held: true }); return; }
        if (key === 'Enter' || key === ' ') { expect(got).toEqual(flags.activate ? { kind: 'activate' } : null); t.count('enter'); return; }
        const typed = flags.typeahead && isOneChar(key) && !mods.ctrlKey && !mods.metaKey && !mods.altKey;
        expect(got).toEqual(typed ? { kind: 'type', held: false } : null);
        t.count(typed ? 'type' : 'null');
      },
    ), runs(RUNS));
    for (const k of ['move', 'enter', 'null']) t.atLeast(k, 20);
    for (const k of ['selectAll', 'type']) t.atLeast(k, 2);
  });
});

const labelShape = { canStop: (i: Item) => i.stop, label: (i: Item) => i.label };
const matches = (it: Item, q: string): boolean => it.stop && it.label.toLowerCase().startsWith(q.toLowerCase());

describe('typeahead', () => {
  it('lands on the first match from the highlight, after it for one character', () => {
    const t = tally();
    fc.assert(fc.property(
      items.chain((list) => fc.tuple(fc.constant(list), at(list.length))),
      fc.constantFrom('a', 'A', 'ap', 'b', 'bl', 'é', 'É', 'c', 'z', '😀', 'İ', 'i'),
      ([list, from], query) => {
        const got = typeaheadMatch(list, from, query, labelShape);
        const n = list.length;
        const start = from === null ? 0 : isOneChar(query) ? from + 1 : from;
        const order = Array.from({ length: n }, (_, k) => (start + k) % n);
        expect(got).toBe(order.find((i) => matches(list[i]!, query)) ?? null);
        t.count(got === null ? 'miss' : got === from ? 'same' : 'hit');
      },
    ), runs(RUNS));
    t.atLeast('hit', RUNS / 4);
    t.atLeast('miss', 10);
    t.atLeast('same', 10);
  });

  it('a buffer grows inside the pause, starts over past it, and a repeated letter cycles', () => {
    const t = tally();
    fc.assert(fc.property(
      items,
      fc.array(fc.record({ key: fc.constantFrom('a', 'A', 'p', 'b', 'l', 'e', '😀'), wait: fc.constantFrom(0, 100, 499, 500, 900) }), { minLength: 1, maxLength: 8 }),
      (list, keys) => {
        let buffer: TypeaheadBuffer = { text: '', at: -Infinity };
        let from: number | null = null;
        let now = 1000;
        for (const { key, wait } of keys) {
          now += wait;
          const fresh = now - buffer.at >= 500;
          const prev = fresh ? '' : buffer.text;
          const cycling = prev !== '' && [...prev].every((c) => c.toLowerCase() === key.toLowerCase());
          const step = typeaheadStep(list, from, buffer, key, now, labelShape);
          const text = cycling ? key : prev + key;
          expect(step.buffer).toEqual({ text, at: now });
          expect(step.hit).toBe(typeaheadMatch(list, from, text, labelShape));
          t.count(cycling ? 'cycle' : fresh ? 'fresh' : 'grow');
          buffer = step.buffer;
          if (step.hit !== null) from = step.hit;
        }
      },
    ), runs(RUNS));
    for (const k of ['cycle', 'fresh', 'grow']) t.atLeast(k, RUNS / 5);
  });
});

/** A row of a tree as shown: its depth, and whether it is a branch, open, and can toggle. */
interface Row { id: number; depth: number; branch: boolean; open: boolean; toggles: boolean; parent: number | null }

/** The rows a random tree shows: each branch's children follow it only when it is open. */
const shownRows: fc.Arbitrary<Row[]> = fc.array(
  fc.record({ deeper: fc.integer({ min: -2, max: 1 }), branch: fc.boolean(), open: fc.boolean(), toggles: fc.oneof(fc.constant(true), fc.boolean()), kids: fc.boolean() }),
  { maxLength: 10 },
).map((spec) => {
  const rows: Row[] = [];
  for (const [id, s] of spec.entries()) {
    const prev = rows.at(-1);
    // A child row can follow only an open branch; otherwise the next row is a sibling or shallower.
    const canNest = prev !== undefined && prev.branch && prev.open && s.kids;
    const depth = prev === undefined ? 0 : canNest ? prev.depth + 1 : Math.max(0, Math.min(prev.depth, prev.depth + Math.min(0, s.deeper)));
    let parent: number | null = null;
    for (let j = rows.length - 1; j >= 0; j--) if (rows[j]!.depth === depth - 1) { parent = rows[j]!.id; break; }
    rows.push({ id, depth, branch: s.branch, open: s.branch && s.open, toggles: s.toggles, parent });
  }
  return rows;
});

describe('treeKey', () => {
  it('opens, closes, and walks the WAI-ARIA tree way, mirrored under rtl', () => {
    const t = tally();
    fc.assert(fc.property(
      shownRows.filter((r) => r.length > 0).chain((rows) => fc.tuple(fc.constant(rows), fc.integer({ min: 0, max: rows.length - 1 }))),
      fc.constantFrom('ArrowRight', 'ArrowLeft', 'ArrowUp'), fc.constantFrom('ltr', 'rtl' as const),
      ([rows, i], key, dir) => {
        const shape: TreeShape<Row> = {
          isBranch: (r) => r.branch, isOpen: (r) => r.open, isChildOf: (c, p) => c.parent === p.id, canToggle: (r) => r.toggles, dir,
        };
        const got = treeKey(rows, i, key, shape);
        const row = rows[i]!;
        const opens = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
        const closes = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        let want;
        if (key === opens) {
          if (!row.branch) want = { handled: false };
          else if (!row.open) want = row.toggles ? { handled: true, toggle: i } : { handled: true, at: null };
          else want = { handled: true, at: rows[i + 1]?.parent === row.id ? i + 1 : null };
        } else if (key === closes) {
          if (row.open && row.toggles) want = { handled: true, toggle: i };
          else {
            const p = rows.findIndex((r) => r.id === row.parent);
            want = p < 0 ? { handled: false } : { handled: true, at: p };
          }
        } else want = { handled: false };
        expect(got).toEqual(want);
        t.count('toggle' in want ? 'toggle' : 'at' in want ? (want.at === null ? 'held' : 'moved') : 'unhandled');
      },
    ), runs(RUNS));
    for (const k of ['toggle', 'moved', 'held', 'unhandled']) t.atLeast(k, 10);
  }, timeoutFor(RUNS, 2));
});

describe('shrunk counterexamples', () => {
  it('a letter whose lowercase is two code points still cycles from the highlight', () => {
    const list = [{ label: 'İnci', stop: true }, { label: 'İnci', stop: true }];
    expect(typeaheadMatch(list, 0, 'İ', labelShape)).toBe(1);
  });
});
