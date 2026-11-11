/**
 * Saving the CSS variable panel's edits into a theme definition, on random themes: the axis selection a trial's
 * globals give agrees with the one the theme engine settles on, and a token edit saved for one selection derives as
 * the edited value there, leaves the token as it was at every selection that differs on an axis it varies on, and
 * leaves every other token alone everywhere. Token and axis value names include `Object.prototype` members.
 */
import type { AxisDefs, Selection, ThemeDefinition } from '@weasel-js/theme';
import { axisDependencies, derive } from '@weasel-js/theme/engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROTO_KEYS, runs, tally, timeoutFor } from '../../pbt.fixture';
import { selectionFor } from './saveScales';
import { applyTokenEdits, canSave } from './saveTokens';

const RUNS = 200;

const AXES = ['mode', 'density'] as const;
const VALUES = ['dark', 'light', 'constructor', 'toString', 'a-b'] as const;
const TOKENS = ['a', 'b', 'c', 'size', ...PROTO_KEYS] as const;

const axisDefs: fc.Arbitrary<AxisDefs> = fc
  .uniqueArray(fc.constantFrom(...AXES), { maxLength: 2 })
  .chain((names) =>
    fc.tuple(...names.map(() => fc.uniqueArray(fc.constantFrom(...VALUES), { minLength: 1, maxLength: 3 }))).map((lists) =>
      Object.fromEntries(names.map((name, i) => [name, { default: lists[i]![0]!, values: Object.fromEntries(lists[i]!.map((v) => [v, {}])) }])),
    ),
  );

const literal = fc.constantFrom('#111111', '#222222', '1px', '2px');

/** A value, a by-axis branch over some of an axis's values, or a reference to an earlier token. */
function varying(axes: AxisDefs, before: readonly string[]): fc.Arbitrary<unknown> {
  // A reference to `__proto__` dangles, which the engine throws on.
  const earlier = before.filter((t) => t !== '__proto__');
  const leaf = earlier.length > 0 ? fc.oneof(literal, fc.constantFrom(...earlier).map((t) => `{${t}}`)) : literal;
  const names = Object.keys(axes);
  if (names.length === 0) return leaf;
  return fc.oneof(
    leaf,
    fc.constantFrom(...names).chain((axis) =>
      fc.subarray(Object.keys(axes[axis]!.values)).chain((values) =>
        fc.tuple(...values.map(() => leaf)).map((leaves) => ({ by: axis, ...Object.fromEntries(values.map((v, i) => [v, leaves[i]])) })),
      ),
    ),
  );
}

const typed = (v: unknown): unknown => (typeof v === 'string' && !v.startsWith('{') && v.startsWith('#') ? { value: v, type: 'color' } : v);

/** A theme whose tokens each sit in components or pins, referencing only tokens before them, so it never cycles. */
const theme: fc.Arbitrary<ThemeDefinition> = axisDefs.chain((axes) =>
  fc.uniqueArray(fc.constantFrom(...TOKENS), { maxLength: 5 }).chain((names) =>
    fc
      .tuple(...names.map((_, i) => fc.tuple(fc.constantFrom('components', 'pins'), varying(axes, names.slice(0, i)))))
      .map((rows) => {
        const components: Record<string, unknown> = {};
        const pins: Record<string, unknown> = {};
        rows.forEach(([layer, value], i) => {
          Object.defineProperty(layer === 'components' ? components : pins, names[i]!, { value: typed(value), enumerable: true, writable: true, configurable: true });
        });
        return { name: 't', axes, components, pins } as ThemeDefinition;
      }),
  ),
);

/** Every full selection of `axes`. */
function selections(axes: AxisDefs): Selection[] {
  return Object.entries(axes).reduce<Selection[]>(
    (acc, [axis, def]) => acc.flatMap((s) => Object.keys(def.values).map((v) => ({ ...s, [axis]: v }))),
    [{}],
  );
}

const valueOf = (def: ThemeDefinition, s: Selection, token: string): unknown =>
  Object.hasOwn(derive(def, s).tokens, token) ? derive(def, s).tokens[token]!.value : undefined;

describe('selectionFor', () => {
  it('picks the axis value a global names only where the axis offers it as its own, as the engine does', () => {
    const seen = tally();
    fc.assert(
      fc.property(axisDefs, fc.dictionary(fc.constantFrom(...AXES, 'zoom'), fc.oneof(fc.constantFrom(...VALUES, 'auto', 'hasOwnProperty'), fc.boolean())), (axes, globals) => {
        const got = selectionFor(axes, globals);
        for (const [axis, def] of Object.entries(axes)) {
          const g = globals[axis];
          if (g === undefined) expect(got[axis]).toBe(def.default);
          else if (typeof g === 'string' && Object.hasOwn(def.values, g)) {
            expect(got[axis]).toBe(g);
            seen.count('named');
          } else {
            expect(Object.hasOwn(got, axis)).toBe(false);
            seen.count('left out');
          }
        }
        expect(Object.keys(got).every((axis) => Object.hasOwn(axes, axis))).toBe(true);
      }),
      runs(RUNS),
    );
    seen.atLeast('named', 10);
    seen.atLeast('left out', 10);
  });
});

describe('applyTokenEdits', () => {
  it('derives the edited value at its selection, and changes nothing else anywhere', () => {
    const seen = tally();
    fc.assert(
      fc.property(
        theme.chain((t) => fc.tuple(fc.constant(t), fc.constantFrom(...TOKENS, 'nowhere'), fc.constantFrom(...selections(t.axes ?? {})), literal)),
        ([t, token, at, value]) => {
          const before = JSON.stringify(t);
          const result = applyTokenEdits(t, { [token]: value }, at);
          expect(JSON.stringify(t)).toBe(before);
          expect(canSave(t, token, at)).toBe(result.ok);
          // The engine refuses a token named `__proto__`, so a save has nowhere to put one.
          const defined = token !== '__proto__' && (Object.hasOwn(t.components ?? {}, token) || Object.hasOwn(t.pins ?? {}, token));
          if (!defined) {
            expect(result.ok).toBe(false);
            seen.count('refused');
            return;
          }
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          const next = result.definition;
          expect(valueOf(next, at, token)).toEqual(value);
          // The axes its own entry varies on: a branch written in place may be a literal under one that varies more.
          const deps = axisDependencies(t)[token]?.own ?? [];
          for (const s of selections(t.axes ?? {})) {
            for (const other of Object.keys(derive(t, s).tokens)) {
              if (other !== token) expect(valueOf(next, s, other)).toEqual(valueOf(t, s, other));
            }
            if (deps.some((axis) => s[axis] !== at[axis])) {
              expect(valueOf(next, s, token)).toEqual(valueOf(t, s, token));
              seen.count('other branch kept');
            }
          }
          // A token written out in components is saved there, not pinned over.
          if (Object.hasOwn(t.components ?? {}, token) && !Object.hasOwn(t.pins ?? {}, token) && typeof t.components![token] === 'string' && !String(t.components![token]).startsWith('{')) {
            expect(Object.hasOwn(next.pins ?? {}, token)).toBe(false);
            seen.count('written in place');
          }
          seen.count('saved');
        },
      ),
      runs(RUNS),
    );
    seen.atLeast('refused', 10);
    seen.atLeast('saved', 40);
    seen.atLeast('other branch kept', 5);
    seen.atLeast('written in place', 3);
  }, timeoutFor(RUNS, 20));
});
