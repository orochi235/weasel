/**
 * Property tests of selection over ids of any kind: `NaN`, `0` beside `-0`, strings named like `Object.prototype`
 * members, and objects. Presses of every intent, ranges by an order holding them, and a store's writes, against
 * models that read two ids as one exactly when a `Set` does. Every press checks the ids, the anchor, and that a
 * press changing nothing hands back the state itself; every write checks what the store holds and who heard.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { rangeOf, select, type SelectIntent, type Selection } from './select';
import { createSelectionStore } from './store';
import { holderOf, outermost } from './tree';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const OBJ = { id: 'obj' };
const POOL: readonly unknown[] = [NaN, 0, -0, 1, '__proto__', 'constructor', '', OBJ, { id: 'obj' }];
const id = fc.constantFrom(...POOL);
/** One id as a `Set` holds it. */
const same = (a: unknown, b: unknown) => new Set([a]).has(b);
const sameIds = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => same(x, b[i]));

/** The selection a press makes, worked out from membership. */
function model(order: readonly unknown[], s: Selection<unknown>, at: unknown, intent: SelectIntent): Selection<unknown> {
  if (intent === 'toggle') {
    return { ids: s.ids.some((x) => same(x, at)) ? s.ids.filter((x) => !same(x, at)) : [...s.ids, at], anchor: at };
  }
  if (intent === 'range' && s.anchor !== null) {
    const i = order.findIndex((x) => same(x, s.anchor)), j = order.findIndex((x) => same(x, at));
    if (i >= 0 && j >= 0) return { ids: order.slice(Math.min(i, j), Math.max(i, j) + 1), anchor: s.anchor };
  }
  return { ids: [at], anchor: at };
}

describe('select over ids of any kind', () => {
  it('toggles, ranges, and replaces as membership says, and hands back the state when nothing changes', () => {
    const t = tally();
    const order = fc.uniqueArray(id, { minLength: 1, comparator: (a, b) => same(a, b) });
    const presses = fc.array(fc.tuple(id, fc.constantFrom<SelectIntent>('replace', 'toggle', 'toggle', 'range', 'single')), { maxLength: 30 });
    fc.assert(fc.property(order, presses, (ord, ps) => {
      let s: Selection<unknown> = { ids: [], anchor: null };
      for (const [at, intent] of ps) {
        const want = model(ord, s, at, intent);
        const got = select(s, at, intent, { order: ord });
        expect(sameIds(got.ids, want.ids) && same(got.anchor, want.anchor)).toBe(true);
        const unchanged = sameIds(got.ids, s.ids) && same(got.anchor, s.anchor);
        if (unchanged) expect(got).toBe(s);
        t.count(intent === 'toggle' && s.ids.some((x) => same(x, at)) ? 'toggle off' : unchanged ? 'unchanged' : 'changed');
        if (typeof at === 'number' && Number.isNaN(at)) t.count('NaN');
        s = got;
      }
    }), runs(RUNS));
    for (const what of ['toggle off', 'unchanged', 'changed', 'NaN']) t.atLeast(what, RUNS / 10);
  }, timeoutFor(RUNS, 2));

  it('ranges from either end over an order holding them, as a Set finds them', () => {
    fc.assert(fc.property(fc.uniqueArray(id, { minLength: 1, comparator: (a, b) => same(a, b) }), id, id, (ord, from, to) => {
      const i = ord.findIndex((x) => same(x, from)), j = ord.findIndex((x) => same(x, to));
      const want = i < 0 || j < 0 ? [] : ord.slice(Math.min(i, j), Math.max(i, j) + 1);
      expect(sameIds(rangeOf(ord, from, to), want)).toBe(true);
      expect(sameIds(rangeOf(ord, to, from), want)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('createSelectionStore over ids of any kind', () => {
  it('holds each id once, and tells its listener exactly when the ids change', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.array(id, { maxLength: 4 }), { minLength: 1, maxLength: 12 }), (writes) => {
      const store = createSelectionStore<unknown>();
      let heard = 0;
      store.subscribe(() => { heard++; });
      let held: readonly unknown[] = [];
      let want = 0;
      for (const [i, fresh] of writes.entries()) {
        // Every other write often repeats the one before, spelled with -0 for 0.
        const w = i % 2 === 1 ? writes[i - 1]!.map((x) => (x === 0 ? -0 : x)) : fresh;
        const next = [...new Set(w)];
        const before = store.getSelection();
        if (!sameIds(next, held)) { want++; held = next; }
        store.setSelection(w);
        expect(sameIds(store.getSelection(), held)).toBe(true);
        expect(heard).toBe(want);
        if (heard === want && sameIds(before, held) && before.length > 0) {
          expect(store.getSelection()).toBe(before);
          t.count('kept');
        }
      }
    }), runs(RUNS));
    t.atLeast('kept', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});

describe('tree selection over ids of any kind', () => {
  it('finds the holder and the outermost ids as a Set reads ids, and outermost is idempotent', () => {
    // A chain: each id's parent is the one before it in the pool.
    const parentOf = (x: unknown) => { const i = POOL.findIndex((y) => same(y, x)); return i > 0 ? POOL[i - 1] : null; };
    fc.assert(fc.property(fc.array(id, { maxLength: 5 }), id, (ids, at) => {
      const set = new Set(ids);
      let want: unknown = null;
      for (let i = POOL.findIndex((y) => same(y, at)); i >= 0; i--) if (set.has(POOL[i])) { want = POOL[i]; break; }
      expect(same(holderOf(set, at, parentOf), want)).toBe(true);
      const top = outermost(ids, parentOf);
      expect(outermost(top, parentOf)).toBe(top);
      for (const x of ids) expect(top.some((y) => same(holderOf(new Set(top), x, parentOf), y))).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
