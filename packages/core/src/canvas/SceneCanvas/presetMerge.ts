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
 * The values several presets give by key, one per key. Presets giving one key the same value agree. Of two giving it
 * different values, the one refining the other wins, and two where neither refines the other throw, even when a third
 * preset agreeing with one of them refines the other. `what` names the key in the error: a noun put before it, or
 * the whole phrase.
 */
export function mergeByKey<V>(
  given: readonly { preset: string; values: Readonly<Record<string, V>> | undefined }[],
  refines: RefinesRelation,
  what: string | ((key: string) => string),
): Record<string, V> {
  const givers = new Map<string, { preset: string; value: V }[]>();
  for (const { preset, values } of given) {
    for (const [key, value] of Object.entries(values ?? {})) {
      const prior = givers.get(key) ?? [];
      for (const g of prior) {
        if (g.value !== value && !refines(g.preset, preset) && !refines(preset, g.preset)) {
          throw new Error(`[SceneCanvas] presets "${g.preset}" and "${preset}" both ${typeof what === 'string' ? `give ${what} "${key}"` : what(key)}, and neither refines the other. Leave one out, or have one name the other in \`refines\`.`);
        }
      }
      givers.set(key, [...prior, { preset, value }]);
    }
  }
  const out: Record<string, V> = {};
  for (const [key, all] of givers) {
    const top = all.find((g) => !all.some((o) => o.value !== g.value && refines(o.preset, g.preset)))!;
    setOwn(out, key, top.value);
  }
  return out;
}
