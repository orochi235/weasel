/**
 * fast-check arbitraries shared by theme's property tests: themes over small pools of token names, axis
 * values, and literal values, so references hit, miss, and loop. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { mergeAxes, type AxisDef, type AxisDefs, type Varying } from './axes';
import type { RawToken } from './dtcg/types';
import { themeAxes } from './resolveTheme';
import type { Theme } from './theme';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** How often each path ran, so a property that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

/** Token names, a few named like `Object.prototype` members. */
export const TOKEN_NAMES = ['fg', 'bg', 'gap', 'accent', 'edge', 'x-1', 'constructor', 'toString'] as const;
export const tokenName = fc.constantFrom(...TOKEN_NAMES);

/** Literal values of each type, none of which reads as a reference. */
const LITERALS: Readonly<Record<string, readonly (string | number | readonly string[])[]>> = {
  color: ['#ff0000', '#00ff0080', 'rgb(1, 2, 3)', 'transparent', 'oklch(0.5 0.1 200)', 'currentColor'],
  dimension: ['4px', '0', '1.5rem', '-2px', 'calc(1px + 2px)'],
  number: [0, 1.5, -3, '2'],
  fontFamily: [['Inter', 'sans-serif'], ['Open Sans', 'system-ui']],
  unknown: ['url(a.png)', 'none', ''],
};
export const TYPES = Object.keys(LITERALS);

/** A raw token: a literal of its type or a reference to a pool name, a color sometimes at an alpha. */
export const rawToken: fc.Arbitrary<RawToken> = fc.constantFrom(...TYPES).chain((type) =>
  fc.record({
    type: fc.constant(type),
    value: fc.oneof(
      { weight: 3, arbitrary: fc.constantFrom(...LITERALS[type]!) },
      { weight: 2, arbitrary: tokenName.map((n) => `{${n}}`) },
    ),
    alpha: type === 'color' ? fc.option(fc.constantFrom(0, 0.5, 1, 0.125), { nil: undefined }) : fc.constant(undefined),
    description: fc.option(fc.constantFrom('a note', 'b'), { nil: undefined }),
  }, { requiredKeys: ['type', 'value'] }) as fc.Arbitrary<RawToken>,
);

/** The axes a theme can declare: mode and density, each with a default among its values. */
const AXIS_POOL: Readonly<Record<string, readonly string[]>> = {
  mode: ['dark', 'light', 'dim'],
  density: ['compact', 'comfortable', 'roomy'],
};

export const axisDef = (values: readonly string[]): fc.Arbitrary<AxisDef> =>
  fc.subarray([...values], { minLength: 1 }).chain((vs) =>
    fc.record({
      default: fc.constantFrom(...vs),
      values: fc.constant(Object.fromEntries(vs.map((v) => [v, v === 'dark' ? { scheme: 'dark' as const } : v === 'light' ? { scheme: 'light' as const } : {}]))),
    }),
  );

export const axisDefs: fc.Arbitrary<AxisDefs> = fc
  .subarray(Object.keys(AXIS_POOL))
  .chain((names) => fc.tuple(...names.map((n) => axisDef(AXIS_POOL[n]!))).map((defs) => Object.fromEntries(names.map((n, i) => [n, defs[i]!]))));

/** A value varying by some of `axes`, nested at most `depth` deep, each `by` naming some (or none) of its axis' values. */
export function varying<T>(leaf: fc.Arbitrary<T>, axes: AxisDefs, depth = 2): fc.Arbitrary<Varying<T>> {
  const names = Object.keys(axes);
  if (depth === 0 || names.length === 0) return leaf;
  return fc.oneof(
    { weight: 2, arbitrary: leaf },
    {
      weight: 2,
      arbitrary: fc.constantFrom(...names).chain((axis) => {
        const rest = Object.fromEntries(Object.entries(axes).filter(([n]) => n !== axis));
        return fc.subarray(Object.keys(axes[axis]!.values)).chain((vs) =>
          fc.tuple(...vs.map(() => varying(leaf, rest, depth - 1))).map((xs) => ({ by: axis, ...Object.fromEntries(vs.map((v, i) => [v, xs[i]])) }) as Varying<T>),
        );
      }),
    },
  );
}

/** A theme over `axes`, extending `parent`. */
export function themeOver(axes: AxisDefs, parent: Theme | null, name = 't'): fc.Arbitrary<Theme> {
  const all = parent ? mergeAxes(themeAxes(parent), axes) : axes;
  return fc.dictionary(tokenName, varying(rawToken, all), { maxKeys: 6 }).map((tokens) => ({ name, extends: parent, axes, tokens }));
}

/** A root theme, or a root and a child whose axes add to or restate the root's. */
export const chainTheme: fc.Arbitrary<Theme> = fc.tuple(axisDefs, axisDefs, fc.boolean()).chain(([rootAxes, kidAxes, two]) =>
  themeOver(rootAxes, null, 'root').chain((root) => (two ? themeOver(kidAxes, root, 'kid') : fc.constant(root))),
);

/** `fn()`'s value, or its error's message prefixed with `throws:`. */
export function outcome<T>(fn: () => T): T | string {
  try {
    return fn();
  } catch (e) {
    return `throws:${(e as Error).message}`;
  }
}
