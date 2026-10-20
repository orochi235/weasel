/** Where each group sits along the main chain. */
import { groupContents } from './groupEdit';
import type { EffectPipeline } from './types';

/** The chain indices a group's stages span, both ends included. */
export interface GroupRun {
  first: number;
  last: number;
}

/**
 * For each group with a stage on `chain`, counting the stages of the groups
 * inside it, the run of chain indices those stages fill; `null` where a
 * stage outside the group sits between two of them.
 */
export function groupRuns(pipeline: EffectPipeline, chain: readonly string[]): Map<string, GroupRun | null> {
  const at = new Map(chain.map((id, i) => [id, i]));
  const doc = { pipeline, places: {} };
  const runs = new Map<string, GroupRun | null>();
  for (const g of pipeline.groups ?? []) {
    const on = [...groupContents(doc, g.id).stages].flatMap((s) => at.get(s) ?? []);
    if (on.length === 0) continue;
    const first = Math.min(...on);
    const last = Math.max(...on);
    runs.set(g.id, last - first + 1 === on.length ? { first, last } : null);
  }
  return runs;
}
