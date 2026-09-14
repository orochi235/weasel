import { mergeAxes } from '../axes';
import type { ThemeDefinition } from '../definition';

export type Lookup = (name: string) => ThemeDefinition | undefined;

const LAYERS = ['seeds', 'ramps', 'scales', 'semantics', 'components', 'pins'] as const;

/** The definition with its whole `extends` chain folded in, child entries winning. */
export function mergeChain(def: ThemeDefinition, lookup?: Lookup, seen: ReadonlySet<string> = new Set()): ThemeDefinition {
  if (seen.has(def.name)) throw new Error(`extends cycle at theme "${def.name}"`);
  if (!def.extends) return def;
  const parentDef = lookup?.(def.extends);
  if (!parentDef) throw new Error(`Theme "${def.name}" extends "${def.extends}", which is not defined`);
  const parent = mergeChain(parentDef, lookup, new Set([...seen, def.name]));
  const out: Record<string, unknown> = { ...def };
  for (const layer of LAYERS) out[layer] = { ...(parent[layer] ?? {}), ...(def[layer] ?? {}) };
  out.axes = mergeAxes(parent.axes ?? {}, def.axes ?? {});
  return out as unknown as ThemeDefinition;
}
