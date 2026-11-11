/**
 * Stateful property test of `select`: random presses of each intent on ids in and out of the order, some forced
 * single, with ranges walked by an order or by a surface's `between` (ids on a grid, the box two span), against a
 * model holding membership and the anchor. Every step checks the ids and their order, the anchor, and that a press
 * changing nothing hands back the state itself. Then `intentOf` against its policy, and `rangeOf` read both ways.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { intentOf, rangeOf, select, type SelectContext, type SelectIntent, type Selection, type SelectionExtendKey } from './select';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const OUTSIDE = 'z';
const COLS = 3;
const cell = (id: string) => { const i = IDS.indexOf(id); return { r: Math.floor(i / COLS), c: i % COLS }; };

interface World {
  order: readonly string[];
  forced: ReadonlySet<string>;
  grid: boolean;
}

const contextOf = (w: World): SelectContext<string> => ({
  ...(w.grid
    ? { between: (from: string, to: string) => {
      if (!IDS.includes(from) || !IDS.includes(to)) return [];
      const a = cell(from), b = cell(to);
      return IDS.filter((id) => {
        const p = cell(id);
        return p.r >= Math.min(a.r, b.r) && p.r <= Math.max(a.r, b.r) && p.c >= Math.min(a.c, b.c) && p.c <= Math.max(a.c, b.c);
      });
    } }
    : { order: w.order }),
  ...(w.forced.size > 0 ? { forceSingle: (id: string) => w.forced.has(id) } : {}),
});

/** What a range from `from` to `to` covers, by membership: the order's span, or the grid's box, less what is forced. */
function covered(w: World, from: string, to: string): Set<string> {
  const out = new Set<string>();
  if (w.grid) {
    if (!IDS.includes(from) || !IDS.includes(to)) return out;
    const a = cell(from), b = cell(to);
    for (const id of IDS) {
      const p = cell(id);
      if ((p.r - a.r) * (p.r - b.r) <= 0 && (p.c - a.c) * (p.c - b.c) <= 0) out.add(id);
    }
  } else {
    const i = w.order.indexOf(from), j = w.order.indexOf(to);
    if (i < 0 || j < 0) return out;
    for (let k = Math.min(i, j); k <= Math.max(i, j); k++) out.add(w.order[k]!);
  }
  for (const id of w.forced) out.delete(id);
  return out;
}

/** The ids a range covers, in the order a range lists them: the order's, or the grid's reading order. */
const listed = (w: World, ids: Set<string>) => (w.grid ? IDS : w.order).filter((id) => ids.has(id));

const t = tally();

/** The selection a press makes, worked out from membership. */
function model(w: World, s: Selection<string>, id: string, intent: SelectIntent): Selection<string> {
  if (w.forced.has(id) || intent === 'single' || intent === 'replace') return { ids: [id], anchor: id };
  if (intent === 'toggle') {
    const kept = s.ids.filter((x) => !w.forced.has(x));
    return { ids: kept.includes(id) ? kept.filter((x) => x !== id) : [...kept, id], anchor: id };
  }
  if (s.anchor !== null) {
    const span = covered(w, s.anchor, id);
    if (span.size > 0) return { ids: listed(w, span), anchor: s.anchor };
  }
  return { ids: [id], anchor: id };
}

const world = fc.record({
  order: fc.shuffledSubarray(IDS, { minLength: 3 }),
  forced: fc.subarray(IDS, { maxLength: 2 }).map((xs) => new Set(xs)),
  grid: fc.boolean(),
});
const press = fc.tuple(fc.oneof({ weight: 6, arbitrary: fc.constantFrom(...IDS) }, { weight: 1, arbitrary: fc.constant(OUTSIDE) }),
  fc.constantFrom<SelectIntent>('replace', 'toggle', 'toggle', 'range', 'range', 'single'));

describe('select, against a model', () => {
  it('presses of every intent leave the ids, their order, and the anchor the model says', () => {
    fc.assert(fc.property(world, fc.array(press, { minLength: 1, maxLength: 25 }), (w, presses) => {
      const ctx = contextOf(w);
      let s: Selection<string> = { ids: [], anchor: null };
      for (const [id, intent] of presses) {
        const want = model(w, s, id, intent);
        const got = select(s, id, intent, ctx);
        expect(got).toEqual(want);
        expect(new Set(got.ids).size).toBe(got.ids.length);
        const unchanged = want.anchor === s.anchor && want.ids.length === s.ids.length && want.ids.every((x, i) => x === s.ids[i]);
        if (intent !== 'toggle' || w.forced.has(id)) expect(got === s).toBe(unchanged);
        else expect(got).not.toBe(s);
        if (got.ids.length > 1) expect(got.ids.some((x) => w.forced.has(x))).toBe(false);
        t.count(intent === 'range' && got.anchor === s.anchor && s.anchor !== id && got.ids.length > 1 ? `ranged ${w.grid ? 'grid' : 'order'}` : intent);
        if (unchanged) t.count('unchanged');
        if (w.forced.has(id)) t.count('forced');
        s = got;
      }
    }), runs(RUNS));
    t.atLeast('ranged order', RUNS / 15);
    t.atLeast('ranged grid', RUNS / 6);
    t.atLeast('toggle', RUNS / 2);
    t.atLeast('unchanged', RUNS / 12);
    t.atLeast('forced', RUNS / 8);
  }, timeoutFor(RUNS, 5));
});

const KEYS: readonly SelectionExtendKey[] = ['shift', 'meta', 'ctrl'];

describe('intentOf', () => {
  it('ranges on the range key, then toggles on any toggle key, else replaces; single mode always replaces', () => {
    const t2 = tally();
    fc.assert(fc.property(
      fc.record({ shift: fc.boolean(), meta: fc.boolean(), ctrl: fc.boolean() }),
      fc.constantFrom<'single' | 'multi'>('single', 'multi', 'multi'),
      fc.option(fc.oneof(fc.constantFrom(...KEYS), fc.subarray([...KEYS])), { nil: undefined }),
      fc.option(fc.constantFrom(...KEYS), { nil: undefined }),
      (mods, mode, toggle, range) => {
        const toggles = toggle === undefined ? [] : typeof toggle === 'string' ? [toggle] : toggle;
        const want = mode === 'single' ? 'replace' : range !== undefined && mods[range] ? 'range'
          : toggles.some((k) => mods[k]) ? 'toggle' : 'replace';
        expect(intentOf(mods, { mode, ...(toggle !== undefined ? { toggle } : {}), ...(range !== undefined ? { range } : {}) })).toBe(want);
        t2.count(want);
      }), runs(RUNS));
    t2.atLeast('range', RUNS / 10);
    t2.atLeast('toggle', RUNS / 20);
  }, timeoutFor(RUNS, 1));
});

describe('rangeOf', () => {
  it('covers the same ids from either end, ends included, in order, less what is forced', () => {
    fc.assert(fc.property(world, fc.constantFrom(...IDS, OUTSIDE), fc.constantFrom(...IDS, OUTSIDE), (w, a, b) => {
      const forced = (id: string) => w.forced.has(id);
      const ab = rangeOf(w.order, a, b, forced);
      expect(rangeOf(w.order, b, a, forced)).toEqual(ab);
      expect(ab).toEqual(listed({ ...w, grid: false }, covered({ ...w, grid: false }, a, b)));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
