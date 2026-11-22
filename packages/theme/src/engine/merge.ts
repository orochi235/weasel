import { setOwn, getOwn } from '@weasel-js/registry';
import { type AxisDefs, isByAxis, mergeAxes } from '../axes.ts';
import type { ThemeDefinition } from '../definition.ts';
import { alwaysDeclaredSteps, declaredSteps, type StepScope } from './steps.ts';

/** Finds a definition by name, for resolving `extends`. */
export type Lookup = (name: string) => ThemeDefinition | undefined;

const LAYERS = ['seeds', 'ramps', 'scales', 'semantics', 'components', 'pins'] as const;

/** Tokens `def` produces itself at every selection (its ramp and scale steps, semantics, and components), which it derives rather than inherits pinned. */
function ownTokens(def: ThemeDefinition, scope: StepScope): Set<string> {
  const names = new Set<string>([...Object.keys(def.semantics ?? {}), ...Object.keys(def.components ?? {})]);
  for (const layer of [def.ramps, def.scales]) {
    for (const [name, entry] of Object.entries(layer ?? {})) for (const step of alwaysDeclaredSteps(entry, scope)) names.add(`${name}-${step}`);
  }
  return names;
}

/** A child's by-axis pin with the axis values it leaves out taken from the parent's pin of the same name. */
function fillFromParent(child: unknown, parent: unknown, axes: AxisDefs): unknown {
  if (!isByAxis(child) || parent === undefined) return child;
  const values = Object.keys(getOwn(axes, child.by)?.values ?? {});
  const out: Record<string, unknown> = { ...child };
  for (const v of values) {
    const inherited = isByAxis(parent) && parent.by === child.by ? getOwn(parent, v) : parent;
    if (Object.hasOwn(out, v)) setOwn(out, v, fillFromParent(out[v], inherited, axes));
    else if (inherited !== undefined) setOwn(out, v, inherited);
  }
  return out;
}

/** A definition with its `extends` chain folded in. */
export interface MergedChain {
  readonly def: ThemeDefinition;
  /** Per layer, the inherited ramp or scale steps a descendant's entry in another layer replaces, which derive leaves unproduced. */
  readonly replaced: { readonly ramps: ReadonlySet<string>; readonly scales: ReadonlySet<string> };
}

const STEP_LAYERS = ['ramps', 'scales'] as const;

/** Names each step layer of `def` can produce, at any selection. */
function stepTokens(def: ThemeDefinition, scope: StepScope, layer: (typeof STEP_LAYERS)[number]): Set<string> {
  const names = new Set<string>();
  for (const [name, entry] of Object.entries(def[layer] ?? {})) for (const step of declaredSteps(entry, scope)) names.add(`${name}-${step}`);
  return names;
}

/** The definition with its whole `extends` chain folded in, child entries winning. */
export function mergeChain(def: ThemeDefinition, lookup?: Lookup, seen?: ReadonlySet<string>): ThemeDefinition {
  return foldChain(def, lookup, seen).def;
}

/** {@link mergeChain}, with the inherited steps a child replaces from another layer; a child's entry wins in any layer. */
export function foldChain(def: ThemeDefinition, lookup?: Lookup, seen: ReadonlySet<string> = new Set()): MergedChain {
  if (seen.has(def.name)) throw new Error(`extends cycle at theme "${def.name}"`);
  if (!def.extends) return { def, replaced: { ramps: new Set(), scales: new Set() } };
  const parentDef = lookup?.(def.extends);
  if (!parentDef) throw new Error(`Theme "${def.name}" extends "${def.extends}", which is not defined`);
  const { def: parent, replaced: above } = foldChain(parentDef, lookup, new Set([...seen, def.name]));
  const out: Record<string, unknown> = { ...def };
  for (const layer of LAYERS) out[layer] = { ...(parent[layer] ?? {}), ...(def[layer] ?? {}) };
  const axes = mergeAxes(parent.axes ?? {}, def.axes ?? {});
  const scope: StepScope = { axes, seeds: out.seeds as ThemeDefinition['seeds'] };
  const shadowed = ownTokens(def, scope);
  for (const layer of ['semantics', 'components'] as const) {
    const mine = def[layer] ?? {};
    out[layer] = Object.fromEntries(Object.entries(out[layer] as object).filter(([n]) => Object.hasOwn(mine, n) || !shadowed.has(n)));
  }
  const childNames = (layer: (typeof STEP_LAYERS)[number]) => {
    const names = new Set([...Object.keys(def.semantics ?? {}), ...Object.keys(def.components ?? {})]);
    for (const other of STEP_LAYERS) if (other !== layer) for (const n of stepTokens(def, scope, other)) names.add(n);
    return names;
  };
  const replaced = { ramps: new Set<string>(), scales: new Set<string>() };
  for (const layer of STEP_LAYERS) {
    const own = stepTokens(def, scope, layer);
    for (const n of above[layer]) if (!own.has(n)) replaced[layer].add(n);
    const inherited = Object.fromEntries(Object.entries(parent[layer] ?? {}).filter(([n]) => !Object.hasOwn(def[layer] ?? {}, n)));
    const theirs = stepTokens({ name: parent.name, [layer]: inherited }, scope, layer);
    for (const n of childNames(layer)) if (theirs.has(n) && !own.has(n)) replaced[layer].add(n);
  }
  const inherited = Object.entries(parent.pins ?? {}).filter(([name]) => !shadowed.has(name));
  const parentPins: Record<string, unknown> = parent.pins ?? {};
  const parentPin = (name: string) => (shadowed.has(name) ? undefined : getOwn(parentPins, name));
  const own = Object.entries(def.pins ?? {}).map(([name, v]) => [name, fillFromParent(v, parentPin(name), axes)]);
  out.pins = { ...Object.fromEntries(inherited), ...Object.fromEntries(own) };
  out.axes = axes;
  out.tints = def.tints ?? parent.tints;
  if (out.tints === undefined) delete out.tints;
  return { def: out as unknown as ThemeDefinition, replaced };
}
