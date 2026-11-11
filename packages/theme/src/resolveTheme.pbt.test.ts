/**
 * Property tests of axes and resolution: full selections, enumeration, `mergeAxes` composing, `pick` against a
 * walk of the tree, and `resolveTheme` over an `extends` chain — an empty child changes nothing, a child's own
 * literal wins, and a resolved theme resolved again is itself.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { enumerateSelections, fullSelection, isByAxis, mergeAxes, pick, selectionKey, type AxisDefs, type Selection } from './axes';
import { serializeTokenValue } from './dtcg/value';
import { axisDefs, chainTheme, outcome, rawToken, runs, tally, timeoutFor, tokenName, varying } from './pbt.fixture';
import { resolveTheme, themeAxes } from './resolveTheme';
import type { Theme } from './theme';

const RUNS = 300;

/** A selection naming some axes of the pool, some with values no axis declares. */
const selection: fc.Arbitrary<Selection> = fc.dictionary(
  fc.constantFrom('mode', 'density', 'contrast'),
  fc.constantFrom('dark', 'light', 'dim', 'compact', 'roomy', 'comfortable', 'nope'),
  { maxKeys: 3 },
);

describe('axes', () => {
  it('a full selection names every axis at a value it declares, and is its own full selection', () => {
    fc.assert(fc.property(axisDefs, selection, (axes, sel) => {
      const full = fullSelection(axes, sel);
      expect(Object.keys(full)).toEqual(Object.keys(axes));
      for (const [a, v] of Object.entries(full)) {
        expect(Object.hasOwn(axes[a]!.values, v)).toBe(true);
        if (Object.hasOwn(axes[a]!.values, sel[a] ?? '')) expect(v).toBe(sel[a]);
      }
      expect(fullSelection(axes, full)).toEqual(full);
      expect(selectionKey(axes, sel)).toBe(selectionKey(axes, full));
    }), runs(RUNS));
  });

  it('enumerates each full selection once, as many as the product of the axes\' sizes', () => {
    fc.assert(fc.property(axisDefs, (axes) => {
      const all = enumerateSelections(axes);
      const size = Object.values(axes).reduce((n, d) => n * Object.keys(d.values).length, 1);
      expect(all).toHaveLength(size);
      expect(new Set(all.map((s) => selectionKey(axes, s))).size).toBe(size);
      for (const s of all) expect(fullSelection(axes, s)).toEqual(s);
    }), runs(RUNS));
  });

  it('mergeAxes composes: merging three in either grouping gives the same axes in the same order', () => {
    fc.assert(fc.property(axisDefs, axisDefs, axisDefs, (a, b, c) => {
      const left = mergeAxes(mergeAxes(a, b), c);
      const right = mergeAxes(a, mergeAxes(b, c));
      expect(left).toEqual(right);
      expect(Object.keys(left)).toEqual(Object.keys(right));
      for (const n of Object.keys(left)) expect(Object.keys(left[n]!.values)).toEqual(Object.keys(right[n]!.values));
      expect(mergeAxes(a, a)).toEqual(a);
      expect(mergeAxes({}, a)).toEqual(a);
    }), runs(RUNS));
  });

  it('pick follows the branch the selection names, and reports the axis it stopped at', () => {
    const t = tally();
    const fixed: AxisDefs = { mode: { default: 'dark', values: { dark: {}, light: {} } }, density: { default: 'compact', values: { compact: {}, roomy: {} } } };
    const sel2 = fc.record({ mode: fc.constantFrom('dark', 'light', 'by'), density: fc.constantFrom('compact', 'roomy', 'nope') }, { requiredKeys: ['density'] });
    fc.assert(fc.property(varying(fc.integer(), fixed, 2), sel2, (v, sel: Selection) => {
      let cur: unknown = v;
      while (isByAxis(cur) && Object.hasOwn(sel, cur.by) && sel[cur.by] !== 'by' && Object.hasOwn(cur, sel[cur.by]!)) cur = (cur as Record<string, unknown>)[sel[cur.by]!];
      const got = pick(v, sel);
      if (isByAxis(cur)) {
        t.count('stops');
        expect(got).toEqual({ ok: false, axis: cur.by, value: sel[cur.by] ?? '' });
      } else {
        t.count(isByAxis(v) ? 'walks' : 'plain');
        expect(got).toEqual({ ok: true, value: cur });
      }
    }), runs(1_000));
    t.atLeast('stops', 30);
    t.atLeast('walks', 30);
  });
});

/** Every full selection of `theme`'s axes, and one naming values nothing declares. */
const selectionsOf = (theme: Theme): Selection[] => [...enumerateSelections(themeAxes(theme)), { mode: 'nope', density: 'nope' }];

describe('resolveTheme', () => {
  it('a child that adds nothing resolves as the theme it extends', () => {
    fc.assert(fc.property(chainTheme, (theme) => {
      const child: Theme = { name: 'empty', extends: theme, axes: {}, tokens: {} };
      for (const sel of selectionsOf(theme)) expect(outcome(() => resolveTheme(child, sel))).toEqual(outcome(() => resolveTheme(theme, sel)));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 10));

  it('a child\'s own literal token is what the token resolves to, at every selection', () => {
    const t = tally();
    const literal = rawToken.filter((r) => typeof r.value !== 'string' || !r.value.startsWith('{'));
    fc.assert(fc.property(chainTheme, tokenName, literal, (theme, name, raw) => {
      const token = { ...raw, alpha: undefined };
      const child: Theme = { name: 'kid', extends: theme, axes: {}, tokens: { [name]: token } };
      for (const sel of selectionsOf(theme)) {
        const got = outcome(() => resolveTheme(child, sel));
        if (typeof got === 'string') continue;
        t.count('resolved');
        expect(got[`--wzl-${name}` as keyof typeof got]).toBe(serializeTokenValue(token.type, token.value));
      }
    }), runs(RUNS));
    t.atLeast('resolved', 200);
  }, timeoutFor(RUNS, 10));

  it('a resolved theme, written back as literals, resolves to itself', () => {
    const t = tally();
    fc.assert(fc.property(chainTheme, (theme) => {
      for (const sel of selectionsOf(theme)) {
        const once = outcome(() => resolveTheme(theme, sel));
        if (typeof once === 'string') continue;
        t.count('resolved');
        const tokens = Object.fromEntries(Object.entries(once).map(([k, v]) => [k.slice('--wzl-'.length), { type: 'unknown', value: v }]));
        expect(resolveTheme({ name: 'again', extends: null, axes: {}, tokens }, sel)).toEqual(once);
      }
    }), runs(RUNS));
    t.atLeast('resolved', 150);
  }, timeoutFor(RUNS, 10));

  it('a selection value no axis declares resolves as the axis default', () => {
    fc.assert(fc.property(chainTheme, selection, (theme, sel) => {
      expect(outcome(() => resolveTheme(theme, sel))).toEqual(outcome(() => resolveTheme(theme, fullSelection(themeAxes(theme), sel))));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 5));
});
