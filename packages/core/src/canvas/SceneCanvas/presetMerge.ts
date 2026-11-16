import { setOwn } from '@weasel-js/registry';

/** Whether preset `a` refines preset `b`, directly or through presets between them. */
export type RefinesRelation = (a: string, b: string) => boolean;

/** {@link RefinesRelation} over `direct`, each preset id's map to the ids it refines itself. */
export function refinesRelation(direct: ReadonlyMap<string, ReadonlySet<string>>): RefinesRelation {
  return (a, b) => {
    const seen = new Set<string>();
    const stack = [a];
    while (stack.length > 0) {
      const at = stack.pop()!;
      for (const next of direct.get(at) ?? []) {
        if (next === b) return true;
        if (!seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
    return false;
  };
}

/**
 * The values several presets give by key, one per key. Presets giving one key the same value agree; of two giving
 * it different values, the one refining the other wins, and two where neither refines the other throw.
 */
export function mergeByKey<V>(
  given: readonly { preset: string; values: Readonly<Record<string, V>> | undefined }[],
  refines: RefinesRelation,
  what: string,
): Record<string, V> {
  const out: Record<string, V> = {};
  const owner = new Map<string, string>();
  for (const { preset, values } of given) {
    for (const [key, value] of Object.entries(values ?? {})) {
      const held = owner.get(key);
      if (held !== undefined && out[key] !== value) {
        if (refines(held, preset)) continue;
        if (!refines(preset, held)) {
          throw new Error(`[SceneCanvas] presets "${held}" and "${preset}" both give ${what} "${key}", and neither refines the other. Leave one out, or have one name the other in \`refines\`.`);
        }
      }
      owner.set(key, preset);
      setOwn(out, key, value);
    }
  }
  return out;
}
