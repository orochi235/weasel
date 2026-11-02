// Which leaves a schema lets a value be split by, and what is wrong with a
// `scopes` that names something else: what a store warns of.

import type { PrefGroup } from './groups';
import { prefHoldsValue, prefLeaves } from './helpers';
import { overrideOptions } from './scope';
import { prefOverridesOf, scopeSelectorsOf } from './scopeSpec';
import { scopeSelectors } from './scope';
import type { PrefEnum, PrefLeaf } from './schema';

/** One thing wrong with a pref's scopes, or with what the schema admits. */
export interface PrefSplitProblem {
  code: 'valueless' | 'no-leaf' | 'not-enum' | 'encoded' | 'clearable' | 'split' | 'twice' | 'default' | 'per' | 'admits';
  /** The path of the pref whose `scopes` it is; `''` for the schema. */
  at: string;
  /** The selector the problem is with, where it is with one. */
  path?: string;
  problem: string;
}

const refusal = (leaf: PrefLeaf | undefined): [PrefSplitProblem['code'], string] | undefined => {
  if (!leaf) return ['no-leaf', 'names no leaf'];
  if (leaf.kind !== 'enum') return ['not-enum', `names a ${leaf.kind} leaf, and only an enum has options to split by`];
  const selector = leaf as PrefEnum;
  if (selector.encoding) return ['encoded', 'names an enum with an encoding, whose stored value is not its option'];
  if (selector.clearable) return ['clearable', 'names a clearable enum, which may hold none of its options'];
  if (scopeSelectorsOf(selector)?.length) return ['split', 'names a leaf that may itself be split'];
  return undefined;
};

/** The options of the leaf at each path some leaf of `leaves` may be split by, for the paths that can be. */
export function prefSelectors(leaves: ReadonlyMap<string, PrefLeaf>): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const leaf of leaves.values()) {
    for (const path of scopeSelectorsOf(leaf) ?? []) {
      const selector = leaves.get(path);
      if (out.has(path) || refusal(selector)) continue;
      out.set(path, (selector as PrefEnum).options.map((option) => option.value));
    }
  }
  return out;
}

/** The selectors `schema` admits: no pref of it, their options named by the app. */
export function admittedSelectors(schema: PrefGroup): Set<string> {
  return new Set(schema.admits ?? []);
}

const notAdmitted = (path: string, admitted: ReadonlySet<string>): string =>
  `selector "${path}" is not admitted by this schema (${admitted.size ? `it admits: ${[...admitted].join(', ')}` : 'it admits none'})`;

/** What is wrong with the `scopes` of the leaf at `at`. */
function perProblems(at: string, leaf: PrefLeaf, leaves: ReadonlyMap<string, PrefLeaf>, admitted: ReadonlySet<string>): PrefSplitProblem[] {
  const out: PrefSplitProblem[] = [];
  leaf.scopes!.forEach((per, i) => {
    const path = per.selector;
    if (leaf.scopes!.findIndex((other) => other.selector === path) !== i) {
      out.push({ code: 'twice', at, path, problem: `"${path}" is listed twice` });
      return;
    }
    if (!leaves.has(path)) {
      if (!admitted.has(path)) out.push({ code: 'no-leaf', at, path, problem: notAdmitted(path, admitted) });
      return;
    }
    const why = refusal(leaves.get(path));
    if (why) {
      out.push({ code: why[0], at, path, problem: `"${path}" ${why[1]}` });
      return;
    }
    const options = new Set((leaves.get(path) as PrefEnum).options.map((option) => option.value));
    const overrides = prefOverridesOf(leaf, path);
    for (const option of overrides ? overrideOptions(overrides) : []) {
      if (!options.has(option)) out.push({ code: 'per', at, path, problem: `its closed list names "${option}", which is no option of "${path}"` });
    }
  });
  return out;
}

/** Everything wrong with the `scopes` lists of `schema`'s prefs and with what it admits, in schema order. */
export function checkPrefSplits(schema: PrefGroup): PrefSplitProblem[] {
  const leaves = prefLeaves(schema);
  const admitted = admittedSelectors(schema);
  const out: PrefSplitProblem[] = [];
  for (const path of admitted) {
    if (leaves.has(path)) out.push({ code: 'admits', at: '', path, problem: `the schema admits "${path}", which is a pref` });
  }
  for (const [at, leaf] of leaves) {
    const axes = scopeSelectorsOf(leaf);
    for (const path of scopeSelectors(leaf.defaultScope)) {
      if (axes?.includes(path)) continue;
      out.push({ code: 'default', at, path, problem: `its defaultScope is split by "${path}", which its scopes do not name` });
    }
    if (!axes?.length) continue;
    if (!prefHoldsValue(leaf)) {
      out.push({ code: 'valueless', at, problem: `a ${leaf.kind} leaf holds no value to split` });
      continue;
    }
    out.push(...perProblems(at, leaf, leaves, admitted));
  }
  return out;
}
