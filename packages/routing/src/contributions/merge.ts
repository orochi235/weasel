import type { Contribution } from './types';

/**
 * Concatenate contribution bundles into one registry, preserving order —
 * entry order decides which of two same-specificity bindings in one scope
 * tier wins, so it is part of the result, not an accident of it.
 *
 * Throws on a duplicate id rather than dropping one: a feature silently
 * losing its bindings is the failure this registry exists to make loud.
 */
export function mergeContributions(...bundles: readonly Contribution[][]): Contribution[] {
  const out: Contribution[] = [];
  const seen = new Set<string>();
  for (const bundle of bundles) {
    for (const entry of bundle) {
      if (seen.has(entry.id)) {
        throw new Error(
          `mergeContributions: duplicate contribution id "${entry.id}". `
          + `Two bundles registered the same id; rename one or merge them by hand.`,
        );
      }
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}
