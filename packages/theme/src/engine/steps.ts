import { getOwn, setOwn } from '@weasel-js/registry';
import { enumerateAxisChoices, fullAxisChoice, isByAxis, pick, type AxisChoice, type AxisDefs, type Varying } from '../axes.ts';
import { isSafeTokenName, unsafeTokenName } from '../dtcg/types.ts';
import { settle } from './entries.ts';

/** What a ramp or scale entry's step names are read against: the axes it varies on and the seeds its `steps` can name. */
export interface StepScope {
  readonly axes?: AxisDefs;
  readonly seeds?: Readonly<Record<string, Varying<number | string>>>;
}

/** Why a settled `steps` value names no steps, or undefined when it does. */
export function stepsProblem(steps: unknown): string | undefined {
  if (!Array.isArray(steps) || !steps.every((s) => typeof s === 'string')) return 'expected a list of step names';
  if (steps.includes('by')) return '"by" is reserved and cannot name a step';
  const unsafe = steps.find((s) => !isSafeTokenName(s));
  if (unsafe !== undefined) return unsafeTokenName(unsafe);
  const repeated = steps.find((s, i) => steps.indexOf(s) !== i);
  if (repeated !== undefined) return `step "${repeated}" is named twice`;
  return undefined;
}

/** The axes the `by`s in `v` name, with the values they give, for reading an entry with no definition around it. */
function axesIn(v: unknown, into: Record<string, { default: string; values: Record<string, object> }> = {}): AxisDefs {
  if (Array.isArray(v)) for (const x of v) axesIn(x, into);
  else if (typeof v === 'object' && v !== null) {
    for (const [k, x] of Object.entries(v)) {
      if (k !== 'by') axesIn(x, into);
      if (k !== 'by' && isByAxis(v)) {
        const axis = getOwn(into, v.by) ?? { default: k, values: {} };
        setOwn(axis.values, k, {});
        setOwn(into, v.by, axis);
      }
    }
  }
  return into;
}

/** The step names `derive` gives an entry at a full selection, or undefined where it gives it none. */
function stepsAt(entry: unknown, sel: AxisChoice, scope: StepScope): string[] | undefined {
  const picked = pick(entry, sel);
  if (!picked.ok || typeof picked.value !== 'object' || picked.value === null) return undefined;
  const seeds: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(scope.seeds ?? {})) {
    const s = pick(v, sel);
    if (s.ok) setOwn(seeds, k, s.value);
  }
  const ctx = { sel, seeds, declaredSeeds: new Set(Object.keys(seeds)), issues: [] };
  const s = settle((picked.value as { steps?: unknown }).steps, '', ctx);
  return s.ok && stepsProblem(s.value) === undefined ? (s.value as string[]) : undefined;
}

/** Each selection's step names for an entry, empty where `derive` gives it none. */
function stepLists(entry: unknown, scope: StepScope | undefined): string[][] {
  const axes = scope ? (scope.axes ?? {}) : axesIn(entry);
  return enumerateAxisChoices(axes).map((sel) => stepsAt(entry, fullAxisChoice(axes, sel), scope ?? {}) ?? []);
}

/** Step names `derive` gives a ramp or scale entry at every selection. */
export function alwaysDeclaredSteps(entry: unknown, scope?: StepScope): string[] {
  const lists = stepLists(entry, scope);
  return lists.length === 0 ? [] : lists.reduce((kept, list) => kept.filter((s) => list.includes(s)));
}

/**
 * Every step name `derive` gives a ramp or scale entry at some selection, first seen first: `by` branches picked,
 * `{seeds.name}` items read, and a branch whose names `derive` rejects left out. With no `scope`, the axes are the
 * ones the entry's own `by`s name, and no seed resolves.
 */
export function declaredSteps(entry: unknown, scope?: StepScope): string[] {
  return [...new Set(stepLists(entry, scope).flat())];
}

/** Every string a ramp or scale entry lists in `steps` in any branch, valid or not: the names a failed entry may have meant. */
export function listedSteps(entry: unknown): string[] {
  const out = new Set<string>();
  const branches = (v: unknown, visit: (x: unknown) => void): void => {
    if (!isByAxis(v)) {
      visit(v);
      return;
    }
    for (const [k, x] of Object.entries(v)) if (k !== 'by') branches(x, visit);
  };
  branches(entry, (e) => {
    if (typeof e !== 'object' || e === null) return;
    branches((e as { steps?: unknown }).steps, (steps) => {
      if (Array.isArray(steps)) for (const s of steps) if (typeof s === 'string') out.add(s);
    });
  });
  return [...out];
}
