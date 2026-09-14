import { mergeAxes } from '../axes';
import type { ThemeDefinition } from '../definition';
import { declaredSteps } from './steps';

export type Lookup = (name: string) => ThemeDefinition | undefined;

const LAYERS = ['seeds', 'ramps', 'scales', 'semantics', 'components', 'pins'] as const;

/** Steps of the ramps and scales `def` declares itself, which it generates rather than inherits pinned. */
function ownSteps(def: ThemeDefinition): Set<string> {
  const names = new Set<string>();
  for (const layer of [def.ramps, def.scales]) {
    for (const [name, entry] of Object.entries(layer ?? {})) for (const step of declaredSteps(entry)) names.add(`${name}-${step}`);
  }
  return names;
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
  out.pins = { ...Object.fromEntries(inherited), ...(def.pins ?? {}) };
  out.axes = mergeAxes(parent.axes ?? {}, def.axes ?? {});
  return out as unknown as ThemeDefinition;
}
