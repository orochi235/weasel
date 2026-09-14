import { isByAxis } from '../axes';
import type { SemanticRule, ThemeDefinition } from '../definition';
import { mergeChain, type Lookup } from './merge';

export interface AxisDependency {
  /** Axes this token's own entry varies on. */
  readonly own: readonly string[];
  /** `own` plus everything reachable through references and rule inputs. */
  readonly all: readonly string[];
}

interface Node {
  readonly axes: Set<string>;
  readonly seeds: Set<string>;
  readonly edges: Set<string>;
}

const SEED_REF = /^\{seeds\.([\w-]+)\}$/;
const TOKEN_REF = /^\{([^}.]+)\}$/;

const node = (): Node => ({ axes: new Set(), seeds: new Set(), edges: new Set() });

/** Collect `by` axes, seed references and `{token}` references anywhere in a value. */
function scan(v: unknown, into: Node): void {
  if (typeof v === 'string') {
    const s = v.trim();
    const seed = SEED_REF.exec(s);
    if (seed) into.seeds.add(seed[1]);
    else {
      const ref = TOKEN_REF.exec(s);
      if (ref) into.edges.add(ref[1]);
    }
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) scan(x, into);
    return;
  }
  if (typeof v === 'object' && v !== null) {
    if (isByAxis(v)) into.axes.add(v.by);
    for (const [k, x] of Object.entries(v)) if (k !== 'by') scan(x, into);
  }
}

/** The non-`by` values under a possibly nested `by` object. */
function leaves(v: unknown): unknown[] {
  return isByAxis(v) ? Object.entries(v).filter(([k]) => k !== 'by').flatMap(([, x]) => leaves(x)) : [v];
}

/** Step names reachable through every branch of a possibly by-varying `steps` list. */
function stepNames(steps: unknown): string[] {
  const out = new Set<string>();
  for (const branch of leaves(steps)) {
    if (Array.isArray(branch)) for (const s of branch) if (typeof s === 'string') out.add(s);
  }
  return [...out];
}

export function axisDependencies(definition: ThemeDefinition, lookup?: Lookup): Record<string, AxisDependency> {
  const def = mergeChain(definition, lookup);
  const nodes = new Map<string, Node>();

  for (const [name, ramp] of Object.entries(def.ramps ?? {})) {
    const n = node();
    scan(ramp, n);
    for (const step of stepNames(ramp.steps)) nodes.set(`${name}-${step}`, n);
  }
  for (const [name, s] of Object.entries(def.scales ?? {})) {
    const n = node();
    scan(s, n);
    for (const step of stepNames(s.steps)) nodes.set(`${name}-${step}`, n);
  }
  for (const [name, rule] of Object.entries(def.semantics ?? {})) {
    const n = node();
    scan(rule, n);
    for (const leaf of leaves(rule) as SemanticRule[]) {
      if ('ref' in leaf) n.edges.add(leaf.ref);
      if ('from' in leaf) n.edges.add(leaf.from);
      if ('step' in leaf) for (const s of leaves(leaf.step)) n.edges.add(`${leaf.ramp}-${String(s)}`);
      if ('contrast' in leaf) {
        for (const a of leaf.contrast.against) n.edges.add(a);
        for (const s of stepNames(def.ramps?.[leaf.ramp]?.steps)) n.edges.add(`${leaf.ramp}-${s}`);
      }
    }
    nodes.set(name, n);
  }
  for (const layer of [def.components, def.pins]) {
    for (const [name, v] of Object.entries(layer ?? {})) {
      const n = node();
      scan(v, n);
      nodes.set(name, n);
    }
  }

  const order = Object.keys(def.axes ?? {});
  const sorted = (s: Set<string>) => order.filter((a) => s.has(a));
  const ownOf = (n: Node) => {
    const out = new Set(n.axes);
    for (const seed of n.seeds) {
      const s = node();
      scan(def.seeds?.[seed], s);
      for (const a of s.axes) out.add(a);
    }
    return out;
  };

  const ownSets = new Map<string, Set<string>>();
  for (const [name, n] of nodes) ownSets.set(name, ownOf(n));

  // `all[n] = own[n] ∪ ⋃ all[edge]`, iterated to a fixpoint instead of walked recursively —
  // a per-path `visiting` guard would memoize the empty answer for whichever cycle node it
  // revisits first. This converges because every step only adds axes, which are finite.
  const all = new Map<string, Set<string>>();
  for (const [name, own] of ownSets) all.set(name, new Set(own));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, n] of nodes) {
      const out = all.get(name)!;
      for (const e of n.edges) {
        const from = all.get(e);
        if (!from) continue;
        for (const a of from) if (!out.has(a)) { out.add(a); changed = true; }
      }
    }
  }

  const result: Record<string, AxisDependency> = {};
  for (const name of nodes.keys()) result[name] = { own: sorted(ownSets.get(name)!), all: sorted(all.get(name)!) };
  return result;
}
