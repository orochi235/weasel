/**
 * fast-check arbitraries shared by labkit's property tests: config trees and paths drawn from small key pools so
 * collisions happen, keys every object inherits among them, and whole schemas described as data beside the builder
 * nodes they make, so a test can say what the schema holds without reading it back through the code under test.
 * Test-only: nothing in the package imports it.
 */
import type { PrefCondition } from '@weasel-js/prefs';
import fc from 'fast-check';
import { f } from './config/builder';
import type { ConfigEntry, ConfigPredicate, ConfigShape } from './config/types';

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
    count(what) {
      seen.set(what, (seen.get(what) ?? 0) + 1);
    },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n)
        throw new Error(
          `${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`,
        );
    },
  };
}

/** Keys a config or a schema may hold, the ones every object inherits among them. No dots: a dot divides a path. */
export const KEYS = [
  'a',
  'b',
  'grid',
  'x-y',
  'n_2',
  '__proto__',
  'constructor',
  'toString',
] as const;
export const key = fc.constantFrom(...KEYS);

/** A record built from entries as own properties, whatever their keys: an object literal would run `__proto__`'s setter. */
export function own<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of entries)
    Object.defineProperty(out, k, {
      value: v,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  return out;
}

/** A leaf value a config holds: never a plain record, which a walk would descend into. */
export const leafValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.boolean(),
  fc.integer({ min: -9, max: 9 }),
  fc.string({ maxLength: 4 }),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 3 }),
);

/** A config tree: records keyed from {@link KEYS} down to leaf values. */
export const configTree: fc.Arbitrary<unknown> = fc.letrec<{ tree: unknown }>((tie) => ({
  tree: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    leafValue,
    fc
      .uniqueArray(fc.tuple(key, tie('tree')), { selector: ([k]) => k, maxLength: 4 })
      .map((entries) => own(entries)),
  ),
})).tree;

/** A dotted path of one to four segments. */
export const path = fc.array(key, { minLength: 1, maxLength: 4 }).map((s) => s.join('.'));

/** A condition a node shows or enables under: on one of the flag leaves `s0`…`s3`, as data or as a function. */
export interface CondSpec {
  form: 'data' | 'fn';
  flag: (typeof FLAGS)[number];
  want: boolean;
}

export const FLAGS = ['s0', 's1', 's2', 's3'] as const;

const cond: fc.Arbitrary<CondSpec> = fc.record({
  form: fc.constantFrom('data' as const, 'fn' as const),
  flag: fc.constantFrom(...FLAGS),
  want: fc.boolean(),
});

/** What `cond` asks of `config`. */
export const holds = (c: CondSpec, config: Record<string, unknown>): boolean =>
  config[c.flag] === c.want;

/** `cond` as a builder takes it. A function is made once per spec, so a schema built twice hands over the same one. */
const asCondition = (() => {
  const made = new WeakMap<CondSpec, ConfigPredicate>();
  return (c: CondSpec): PrefCondition | ConfigPredicate => {
    if (c.form === 'data') return { path: c.flag, is: c.want };
    let fn = made.get(c);
    if (!fn) {
      fn = (config) => holds(c, config);
      made.set(c, fn);
    }
    return fn;
  };
})();

/** What every node of a schema may say beside its value. */
interface Said {
  label?: string;
  section?: { label: string; collapsed?: boolean };
  show?: CondSpec;
  enable?: CondSpec;
}

export type LeafSpec = Said & {
  kind: 'boolean' | 'number' | 'string' | 'color' | 'enum' | 'list';
  default: unknown;
  options?: readonly string[];
  range?: readonly [number, number];
  hidden?: boolean;
};

export type GroupSpec = Said & {
  kind: 'group';
  children: [string, NodeSpec][];
  resettable?: boolean;
};

export type NodeSpec = LeafSpec | GroupSpec;

// No '': `.section('')` reads back through `f.prefs` as no section at all, which is open in `docs/unruled.md`.
const SECTIONS = ['Grid', 'grid', 'Camera', 'A b'] as const;

const said: fc.Arbitrary<Said> = fc.record(
  {
    label: fc.constantFrom('Size', 'Ünïcode', ''),
    section: fc.record(
      { label: fc.constantFrom(...SECTIONS), collapsed: fc.boolean() },
      { requiredKeys: ['label'] },
    ),
    show: cond,
    enable: cond,
  },
  { requiredKeys: [] },
);

const color = fc
  .tuple(fc.integer({ min: 0, max: 0xffffff }))
  .map(([n]) => `#${n.toString(16).padStart(6, '0')}`);

const leafSpec: fc.Arbitrary<LeafSpec> = fc
  .tuple(
    fc.oneof(
      fc.record({ kind: fc.constant('boolean' as const), default: fc.boolean() }),
      fc.record(
        {
          kind: fc.constant('number' as const),
          default: fc.integer({ min: -50, max: 50 }),
          range: fc.constant([-100, 100] as const),
        },
        { requiredKeys: ['kind', 'default'] },
      ),
      fc.record({ kind: fc.constant('string' as const), default: fc.string({ maxLength: 4 }) }),
      fc.record({ kind: fc.constant('color' as const), default: color }),
      fc
        .uniqueArray(fc.constantFrom('x', 'y', 'z', 'w'), { minLength: 1, maxLength: 4 })
        .chain((options) =>
          fc.record({
            kind: fc.constant('enum' as const),
            options: fc.constant(options),
            default: fc.constantFrom(...options),
          }),
        ),
      fc.record({
        kind: fc.constant('list' as const),
        default: fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 3 }),
      }),
    ),
    said,
    fc.boolean(),
  )
  .map(([leaf, extra, hidden]) => ({ ...leaf, ...extra, ...(hidden ? { hidden } : {}) }));

/** A schema's top level: nodes under keys from {@link KEYS}, groups nesting up to three deep. */
export const shapeSpec: fc.Arbitrary<[string, NodeSpec][]> = fc.letrec<{
  node: NodeSpec;
  shape: [string, NodeSpec][];
}>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    leafSpec,
    fc.tuple(tie('shape'), said, fc.boolean()).map(
      ([children, extra, resettable]): GroupSpec => ({
        kind: 'group',
        children,
        ...extra,
        ...(resettable ? { resettable } : {}),
      }),
    ),
  ),
  shape: fc.uniqueArray(fc.tuple(key, tie('node')), {
    selector: ([k]) => k,
    minLength: 1,
    maxLength: 4,
  }),
})).shape;

function leafNode(spec: LeafSpec): ConfigEntry {
  switch (spec.kind) {
    case 'boolean':
      return f.boolean(spec.default as boolean);
    case 'number':
      return spec.range
        ? f.number(spec.default as number).range(...spec.range)
        : f.number(spec.default as number);
    case 'string':
      return f.string(spec.default as string);
    case 'color':
      return f.color(spec.default as string);
    case 'enum':
      return f.enum(spec.default as string, spec.options as string[]);
    case 'list':
      return f.value(spec.default as number[]);
  }
}

type Sayer = {
  label(name: string): Sayer;
  section(label: string, opts?: { collapsed?: boolean }): Sayer;
  showIf(when: PrefCondition | ConfigPredicate): Sayer;
  enableIf(when: PrefCondition | ConfigPredicate): Sayer;
};

function withSaid(node: Sayer, spec: Said): Sayer {
  let out = node;
  if (spec.label !== undefined) out = out.label(spec.label);
  if (spec.section)
    out = out.section(
      spec.section.label,
      spec.section.collapsed === undefined ? {} : { collapsed: spec.section.collapsed },
    );
  if (spec.show) out = out.showIf(asCondition(spec.show));
  if (spec.enable) out = out.enableIf(asCondition(spec.enable));
  return out;
}

/** The builder node `spec` describes. */
export function nodeOf(spec: NodeSpec): ConfigEntry {
  if (spec.kind === 'group') {
    let group = f.group(shapeOf(spec.children));
    if (spec.resettable) group = group.resettable();
    return withSaid(group as unknown as Sayer, spec) as unknown as ConfigEntry;
  }
  let leaf = leafNode(spec) as unknown as Sayer & { hidden(): Sayer };
  if (spec.hidden) leaf = leaf.hidden() as typeof leaf;
  return withSaid(leaf, spec) as unknown as ConfigEntry;
}

/** The config shape `entries` describe, keyed as own properties. */
export function shapeOf(entries: readonly [string, NodeSpec][]): ConfigShape {
  return own(entries.map(([k, spec]) => [k, nodeOf(spec)] as const)) as ConfigShape;
}

/** Every leaf under `entries` with its dotted path, the groups above it, and itself. */
export function leavesOf(
  entries: readonly [string, NodeSpec][],
  at = '',
  above: readonly GroupSpec[] = [],
): Array<{ path: string; leaf: LeafSpec; above: readonly GroupSpec[] }> {
  return entries.flatMap(([k, spec]) => {
    const p = at === '' ? k : `${at}.${k}`;
    return spec.kind === 'group'
      ? leavesOf(spec.children, p, [...above, spec])
      : [{ path: p, leaf: spec, above }];
  });
}

/** Every group under `entries` with its dotted path. */
export function groupsOf(
  entries: readonly [string, NodeSpec][],
  at = '',
): Array<{ path: string; group: GroupSpec }> {
  return entries.flatMap(([k, spec]) => {
    if (spec.kind !== 'group') return [];
    const p = at === '' ? k : `${at}.${k}`;
    return [{ path: p, group: spec }, ...groupsOf(spec.children, p)];
  });
}

/** The flag leaves the conditions read, at the top level where no generated key lands. */
export const flagShape = (): ConfigShape =>
  own(FLAGS.map((k) => [k, f.boolean(false)] as const)) as ConfigShape;
