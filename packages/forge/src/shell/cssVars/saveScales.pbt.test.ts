/**
 * Saving the CSS variable panel's scale edits into a theme definition, on random themes whose scale params are
 * literals, per-axis branches, and `{seeds.name}` references: a saved edit derives at its selection as the scale
 * written out plainly would, saving it again changes nothing, the definition handed in is left alone, and a scale
 * that shares no seed with an edited one derives as before everywhere.
 */
import type { AxisDefs, Selection, ThemeDefinition } from '@weasel-js/theme';
import { derive } from '@weasel-js/theme/engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { applyScaleEdits, type ScaleEdit } from './saveScales';

const RUNS = 200;
const STEPS = ['1', '2', '3'];
const SEEDS = ['u', 'v', 'constructor'] as const;
const SCALES = ['space', 'size', 'toString'] as const;

const axisDefs: fc.Arbitrary<AxisDefs> = fc
  .uniqueArray(fc.constantFrom('mode', 'density'), { maxLength: 2 })
  .chain((names) =>
    fc.tuple(...names.map(() => fc.uniqueArray(fc.constantFrom('dark', 'light', 'valueOf'), { minLength: 1, maxLength: 3 }))).map((lists) =>
      Object.fromEntries(names.map((name, i) => [name, { default: lists[i]![0]!, values: Object.fromEntries(lists[i]!.map((v) => [v, {}])) }])),
    ),
  );

const num = fc.integer({ min: 1, max: 9 });

/** A value as itself, or branched over every value of one axis. */
function branched<T>(axes: AxisDefs, leaf: fc.Arbitrary<T>): fc.Arbitrary<unknown> {
  const names = Object.keys(axes);
  if (names.length === 0) return leaf;
  return fc.oneof(
    leaf,
    fc.constantFrom(...names).chain((axis) => {
      const values = Object.keys(axes[axis]!.values);
      return fc.tuple(...values.map(() => leaf)).map((leaves) => ({ by: axis, ...Object.fromEntries(values.map((v, i) => [v, leaves[i]])) }));
    }),
  );
}

interface Generated {
  readonly def: ThemeDefinition;
  /** Per scale, the seeds its params name. */
  readonly seedsOf: ReadonlyMap<string, ReadonlySet<string>>;
}

const theme: fc.Arbitrary<Generated> = axisDefs.chain((axes) => {
  const param = fc.oneof(num, fc.constantFrom(...SEEDS).map((s) => `{seeds.${s}}`));
  const scaleDef = fc.record({
    base: branched(axes, param),
    rule: fc.oneof(
      branched(axes, param).map((step) => ({ step })),
      branched(axes, fc.constantFrom(1, 2)).map((ratio) => ({ ratio })),
      branched(axes, fc.tuple(param, param, param)).map((factors) => ({ factors })),
    ),
  });
  return fc.record({
    seeds: fc.tuple(...SEEDS.map(() => branched(axes, num))),
    scales: fc.uniqueArray(fc.constantFrom(...SCALES), { minLength: 1, maxLength: 3 }).chain((names) => fc.tuple(...names.map(() => scaleDef)).map((defs) => ({ names, defs }))),
  }).map(({ seeds, scales }) => {
    const seedsOf = new Map<string, Set<string>>();
    const scaleRecord: Record<string, unknown> = {};
    scales.names.forEach((name, i) => {
      const { base, rule } = scales.defs[i]!;
      seedsOf.set(name, new Set([...JSON.stringify([base, rule]).matchAll(/\{seeds\.([^}]+)\}/g)].map((m) => m[1]!)));
      Object.defineProperty(scaleRecord, name, { value: { steps: STEPS, base, ...rule }, enumerable: true, writable: true, configurable: true });
    });
    const seedRecord: Record<string, unknown> = {};
    SEEDS.forEach((s, i) => Object.defineProperty(seedRecord, s, { value: seeds[i], enumerable: true, writable: true, configurable: true }));
    return { def: { name: 't', axes, seeds: seedRecord, scales: scaleRecord } as ThemeDefinition, seedsOf };
  });
});

const edit: fc.Arbitrary<ScaleEdit> = fc.record({
  base: num,
  rule: fc.oneof(
    num.map((step) => ({ kind: 'step' as const, step })),
    fc.constantFrom(1, 2).map((ratio) => ({ kind: 'ratio' as const, ratio })),
    fc.tuple(num, num, num).map((factors) => ({ kind: 'factors' as const, factors })),
  ),
});

function selections(axes: AxisDefs): Selection[] {
  return Object.entries(axes).reduce<Selection[]>(
    (acc, [axis, def]) => acc.flatMap((s) => Object.keys(def.values).map((v) => ({ ...s, [axis]: v }))),
    [{}],
  );
}

const stepsOf = (def: ThemeDefinition, name: string, s: Selection): unknown[] =>
  STEPS.map((step) => {
    const tokens = derive(def, s).tokens;
    return Object.hasOwn(tokens, `${name}-${step}`) ? tokens[`${name}-${step}`]!.value : undefined;
  });

const plain = (e: ScaleEdit) => ({
  steps: STEPS,
  base: e.base,
  ...(e.rule.kind === 'step' ? { step: e.rule.step } : e.rule.kind === 'ratio' ? { ratio: e.rule.ratio } : { factors: [...e.rule.factors] }),
});

describe('applyScaleEdits', () => {
  it('derives a saved scale as written out plainly, saves idempotently, and leaves scales on other seeds alone', () => {
    const seen = tally();
    fc.assert(
      fc.property(
        theme.chain((g) =>
          fc.tuple(fc.constant(g), fc.dictionary(fc.oneof({ weight: 6, arbitrary: fc.constantFrom(...g.seedsOf.keys()) }, { weight: 1, arbitrary: fc.constantFrom(...SCALES, 'nowhere') }), edit, { minKeys: 1, maxKeys: 2 }), fc.constantFrom(...selections(g.def.axes ?? {}))),
        ),
        ([{ def, seedsOf }, edits, at]) => {
          const before = JSON.stringify(def);
          const result = applyScaleEdits(def, edits, at);
          expect(JSON.stringify(def)).toBe(before);
          if (Object.keys(edits).some((name) => !seedsOf.has(name))) {
            expect(result.ok).toBe(false);
            seen.count('no such scale');
            return;
          }
          if (!result.ok) {
            seen.count('refused');
            return;
          }
          const next = result.definition;
          for (const [name, e] of Object.entries(edits)) {
            const flat = { ...def, scales: { [name]: plain(e) } } as ThemeDefinition;
            expect(stepsOf(next, name, at)).toEqual(stepsOf(flat, name, at));
          }
          const again = applyScaleEdits(next, edits, at);
          expect(again.ok && JSON.stringify(again.definition)).toBe(JSON.stringify(next));
          const touched = new Set(Object.keys(edits).flatMap((name) => [...seedsOf.get(name)!]));
          for (const [name, seeds] of seedsOf) {
            if (Object.hasOwn(edits, name) || [...seeds].some((s) => touched.has(s))) continue;
            for (const s of selections(def.axes ?? {})) expect(stepsOf(next, name, s)).toEqual(stepsOf(def, name, s));
            seen.count('untouched scale kept');
          }
          seen.count('saved');
        },
      ),
      runs(RUNS),
    );
    seen.atLeast('no such scale', 10);
    seen.atLeast('refused', 10);
    seen.atLeast('saved', 40);
    seen.atLeast('untouched scale kept', 10);
  }, timeoutFor(RUNS, 30));
});
