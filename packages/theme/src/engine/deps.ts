import { isByAxis } from '../axes';
import type { SemanticRule, ThemeDefinition } from '../definition';
import { mergeChain, type Lookup } from './merge';
import { declaredSteps } from './steps';

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

/** The axes that decide which steps a ramp entry declares: `by`s wrapping the entry, and anything in its `steps`. */
function scanSteps(entry: unknown, into: Node): void {
  if (isByAxis(entry)) {
    into.axes.add(entry.by);
    for (const [k, x] of Object.entries(entry)) if (k !== 'by') scanSteps(x, into);
  } else if (typeof entry === 'object' && entry !== null) {
    scan((entry as { steps?: unknown }).steps, into);
  }
}

/** Node key for a ramp's step list. `derive` rejects a token name containing a dot, so it never collides with one. */
const stepsKey = (ramp: string) => `ramps.${ramp}`;

/** The non-`by` values under a possibly nested `by` object. */
function leaves(v: unknown): unknown[] {
  return isByAxis(v) ? Object.entries(v).filter(([k]) => k !== 'by').flatMap(([, x]) => leaves(x)) : [v];
}

export function axisDependencies(definition: ThemeDefinition, lookup?: Lookup): Record<string, AxisDependency> {
  const def = mergeChain(definition, lookup);
  const nodes = new Map<string, Node>();

  /** Step token → the ramps that declare it. */
  const stepRamps = new Map<string, Set<string>>();
  for (const [name, ramp] of Object.entries(def.ramps ?? {})) {
    const shape = node();
    scanSteps(ramp, shape);
    nodes.set(stepsKey(name), shape);
    const n = node();
    scan(ramp, n);
    for (const step of declaredSteps(ramp)) {
      nodes.set(`${name}-${step}`, n);
      stepRamps.set(`${name}-${step}`, (stepRamps.get(`${name}-${step}`) ?? new Set()).add(name));
    }
  }
  for (const [name, s] of Object.entries(def.scales ?? {})) {
    const n = node();
    scan(s, n);
    for (const step of declaredSteps(s)) nodes.set(`${name}-${step}`, n);
  }

  /** Every ramp a token could sit on: its own, or the ones its semantic rule leaves or pins lead to. */
  const rampsOf = (name: string, seen = new Set<string>()): Set<string> => {
    const out = new Set<string>(stepRamps.get(name));
    if (seen.has(name)) return out;
    seen.add(name);
    const add = (from: string) => {
      for (const r of rampsOf(from, seen)) out.add(r);
    };
    const rule = def.semantics?.[name];
    for (const leaf of rule === undefined ? [] : leaves(rule)) {
      if (typeof leaf !== 'object' || leaf === null) continue;
      const l = leaf as SemanticRule;
      if ('ramp' in l) out.add(l.ramp);
      else if ('from' in l) add(l.from);
      else if ('ref' in l) add(l.ref);
    }
    const pin = def.pins?.[name];
    if (pin !== undefined) {
      const n = node();
      scan(pin, n);
      for (const e of n.edges) add(e);
    }
    return out;
  };
  for (const [name, rule] of Object.entries(def.semantics ?? {})) {
    const n = node();
    scan(rule, n);
    for (const leaf of leaves(rule) as SemanticRule[]) {
      if ('ref' in leaf) n.edges.add(leaf.ref);
      if ('from' in leaf) {
        n.edges.add(leaf.from);
        for (const r of rampsOf(leaf.from)) {
          n.edges.add(stepsKey(r));
          // darker and lighter read which end of the ramp is darker.
          if (leaf.dir !== 'away') for (const s of declaredSteps(def.ramps?.[r])) n.edges.add(`${r}-${s}`);
        }
      }
      if ('step' in leaf) {
        n.edges.add(stepsKey(leaf.ramp));
        for (const s of leaves(leaf.step)) n.edges.add(`${leaf.ramp}-${String(s)}`);
      }
      if ('contrast' in leaf) {
        n.edges.add(stepsKey(leaf.ramp));
        for (const a of leaf.contrast.against) n.edges.add(a);
        for (const s of declaredSteps(def.ramps?.[leaf.ramp])) n.edges.add(`${leaf.ramp}-${s}`);
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
  for (const name of nodes.keys()) if (!name.includes('.')) result[name] = { own: sorted(ownSets.get(name)!), all: sorted(all.get(name)!) };
  return result;
}
