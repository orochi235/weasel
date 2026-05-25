import type { ChromeCtx, ChromeId, VisibilityRules } from './types';
import { always } from './conditions';
import { defaultVisibilityRules } from './defaults';

/**
 * Build the per-frame visibility check. Merges consumer rules on top
 * of the kit defaults, then closes over `ctx` so each chrome-id
 * lookup runs its rule against the current state.
 *
 * Predicates are O(1) and run once per chrome id per frame; no
 * memoization in v1 — profile before adding any.
 */
export function resolveVisibility(
  consumer: VisibilityRules | undefined,
  ctx: ChromeCtx,
): (id: ChromeId) => boolean {
  const merged: VisibilityRules = consumer
    ? { ...defaultVisibilityRules, ...consumer }
    : defaultVisibilityRules;
  return (id) => (merged[id] ?? always)(ctx);
}
