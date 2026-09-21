import { type AxisDefs, isByAxis, mergeAxes } from '../axes';
import type { ThemeDefinition } from '../definition';
import { alwaysDeclaredSteps } from './steps';

export type Lookup = (name: string) => ThemeDefinition | undefined;

const LAYERS = ['seeds', 'ramps', 'scales', 'semantics', 'components', 'pins'] as const;

/** Steps of the ramps and scales `def` declares itself at every selection, which it generates rather than inherits pinned. */
function ownSteps(def: ThemeDefinition): Set<string> {
  const names = new Set<string>();
  for (const layer of [def.ramps, def.scales]) {
    for (const [name, entry] of Object.entries(layer ?? {})) for (const step of alwaysDeclaredSteps(entry)) names.add(`${name}-${step}`);
  }
  return names;
}

/** A child's by-axis pin with the axis values it leaves out taken from the parent's pin of the same name. */
function fillFromParent(child: unknown, parent: unknown, axes: AxisDefs): unknown {
  if (!isByAxis(child) || parent === undefined) return child;
  const values = Object.keys(axes[child.by]?.values ?? {});
  const out: Record<string, unknown> = { ...child };
  for (const v of values) {
    if (v in out) continue;
    out[v] = isByAxis(parent) && parent.by === child.by ? parent[v] : parent;
    if (out[v] === undefined) delete out[v];
  }
  return out;
}

/** The definition with its whole `extends` chain folded in, child entries winning. */
export function mergeChain(def: ThemeDefinition, lookup?: Lookup, seen: ReadonlySet<string> = new Set()): ThemeDefinition {
  if (seen.has(def.name)) throw new Error(`extends cycle at theme "${def.name}"`);
  if (!def.extends) return def;
  const parentDef = lookup?.(def.extends);
  if (!parentDef) throw new Error(`Theme "${def.name}" extends "${def.extends}", which is not defined`);
  const parent = mergeChain(parentDef, lookup, new Set([...seen, def.name]));
  const out: Record<string, unknown> = { ...def };
  for (const layer of LAYERS) out[layer] = { ...(parent[layer] ?? {}), ...(def[layer] ?? {}) };
  const shadowed = ownSteps(def);
  const inherited = Object.entries(parent.pins ?? {}).filter(([name]) => !shadowed.has(name));
  const axes = mergeAxes(parent.axes ?? {}, def.axes ?? {});
  const parentPins: Record<string, unknown> = parent.pins ?? {};
  const own = Object.entries(def.pins ?? {}).map(([name, v]) => [name, fillFromParent(v, parentPins[name], axes)]);
  out.pins = { ...Object.fromEntries(inherited), ...Object.fromEntries(own) };
  out.axes = axes;
  return out as unknown as ThemeDefinition;
}
