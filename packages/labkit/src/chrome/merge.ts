import type { TrialContribution } from './types';

/**
 * Concatenate contribution bundles into one list, preserving order — order
 * decides how a region lays its contributions out, so it is part of the
 * result, not an accident of it.
 *
 * Throws on a duplicate id rather than dropping one: a contribution silently
 * losing to a later bundle is the failure a registry exists to prevent.
 */
export function mergeContributions(
  ...bundles: readonly TrialContribution[][]
): TrialContribution[] {
  const out: TrialContribution[] = [];
  const seen = new Set<string>();
  for (const bundle of bundles) {
    for (const entry of bundle) {
      if (seen.has(entry.id)) {
        throw new Error(
          `[labkit] mergeContributions: duplicate contribution id "${entry.id}". ` +
            'Two bundles registered the same id; rename one, or suppress the ' +
            'built-in before adding yours.',
        );
      }
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

/**
 * Drop contributions by id. Throws when an id is not present: a typo that
 * silently suppresses nothing is the same class of bug as a duplicate id
 * silently winning.
 */
export function suppressContributions(
  bundle: readonly TrialContribution[],
  ids: readonly string[],
): TrialContribution[] {
  const present = new Set(bundle.map((c) => c.id));
  for (const id of ids) {
    if (!present.has(id)) {
      throw new Error(
        `[labkit] cannot suppress "${id}": no contribution with that id. ` +
          `Present ids: ${[...present].join(', ')}`,
      );
    }
  }
  const drop = new Set(ids);
  return bundle.filter((c) => !drop.has(c.id));
}
