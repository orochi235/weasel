import type { ToolDef } from '../types';
import type { ModifierKey } from '../modifiers';
import type { RoutePhase, RouteGesture } from './route-resolved';
import { buildActionRegistry, type RegistryEntry } from './registry';

/** Two or more tools declare the same exact (phase, gesture, target,
 *  modifiers) tuple — the dispatcher's slot precedence picks one
 *  arbitrarily (well, deterministically by slot order, but the author
 *  probably didn't intend the duplication). */
export interface Conflict {
  phase: RoutePhase;
  gesture: RouteGesture;
  target: string;
  modifiers: ModifierKey;
  /** All tool ids that registered the same tuple. At least 2 by
   *  construction. Order matches the input tools[] order. */
  toolIds: string[];
}

/** Detect exact-tuple overlaps across a tool registration set.
 *
 *  Intentionally NOT flagged:
 *  - Wildcard vs. specific (e.g., `click['*']` + `click['rect']`) — that's
 *    the cascading-fallback pattern; the lookup engine resolves cleanly.
 *  - Different modifier sub-keys on the same target — they fire on
 *    different inputs.
 *  - Ambient stacking where a tool returns `pass`/`none()` from its
 *    ActionFn to intentionally let another ambient tool run. We'd need
 *    to evaluate the ActionFn to detect intent; consumers can suppress
 *    known-intentional compositions in their UI layer.
 */
export function findConflicts(
  tools: readonly ToolDef<unknown>[],
): Conflict[] {
  const entries = buildActionRegistry(tools);
  const groups = new Map<string, RegistryEntry[]>();
  for (const entry of entries) {
    const key = `${entry.phase}|${entry.gesture}|${entry.target}|${entry.modifiers}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  const conflicts: Conflict[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    // Multiple registrations from the same tool can't share a key (Object
    // literals dedupe), so bucket.length >= 2 implies >= 2 distinct toolIds.
    const first = bucket[0];
    conflicts.push({
      phase: first.phase,
      gesture: first.gesture,
      target: first.target,
      modifiers: first.modifiers,
      toolIds: bucket.map((e) => e.toolId),
    });
  }
  return conflicts;
}
