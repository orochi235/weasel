import type { Contribution } from './types';

/**
 * Concatenate contribution bundles into one registry, preserving order —
 * entry order decides which of two same-specificity bindings in one scope
 * tier wins, so it is part of the result, not an accident of it.
 *
 * Throws on a duplicate id or dep name rather than dropping one: a feature
 * silently losing its bindings, or reading another feature's dep, is the
 * failure this registry exists to make loud.
 */
export function mergeContributions<T extends Contribution<unknown>>(
  ...bundles: readonly (readonly T[])[]
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const depOwner = new Map<string, string>();
  for (const bundle of bundles) {
    for (const entry of bundle) {
      if (seen.has(entry.id)) {
        throw new Error(
          `mergeContributions: duplicate contribution id "${entry.id}". `
          + `Two bundles registered the same id; rename one or merge them by hand.`,
        );
      }
      seen.add(entry.id);
      for (const dep of Object.keys(entry.deps ?? {})) {
        const owner = depOwner.get(dep);
        if (owner !== undefined) {
          throw new Error(
            `mergeContributions: dep "${dep}" is provided by both "${owner}" and "${entry.id}". `
            + `One registry answers each dep name; drop one source.`,
          );
        }
        depOwner.set(dep, entry.id);
      }
      out.push(entry);
    }
  }
  return out;
}
