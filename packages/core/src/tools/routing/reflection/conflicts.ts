import type { Tool } from '../../types';
import type { ParsedModifiers } from '../routeGrammar';
import { canonicalModifiers } from '../routeGrammar';
import { buildRouteRegistry, type RegistryEntry, type GestureName } from './registry';

/** Two or more tools declare the same exact (phase, gesture, arg, target,
 *  modifiers) tuple — the dispatcher's slot precedence picks one
 *  arbitrarily (well, deterministically by slot order, but the author
 *  probably didn't intend the duplication). */
export interface Conflict {
  phase: 'initial' | 'engaged';
  gesture: GestureName;
  arg: string | undefined;
  target: string | undefined;
  modifiers: ParsedModifiers;
  /** All tool ids that registered the same tuple. At least 2 by
   *  construction. Order matches the input tools[] order. */
  toolIds: string[];
}

/** Detect exact-tuple overlaps across a tool registration set.
 *
 *  Intentionally NOT flagged:
 *  - Broad vs. narrow targets (e.g. an untargeted `click` alongside
 *    `click` on `empty`) — the dispatcher's specificity ordering resolves
 *    those cleanly, and the broad one is usually the intended fallback.
 *  - Different modifier requirements on the same target — they fire on
 *    different inputs.
 *  - A binding whose action declines via `enabled()` so a lower-priority
 *    one can take the gesture. Detecting that intent would mean evaluating
 *    the action; consumers can suppress known-intentional compositions in
 *    their UI layer.
 *
 *  Note that two bindings sharing a tuple on the SAME tool are now possible
 *  (bindings are an array, where phase tables were objects with unique
 *  keys) — so a conflict may name one tool twice.
 */
export function findConflicts(
  tools: readonly Tool<unknown>[],
): Conflict[] {
  const entries = buildRouteRegistry(tools);
  const groups = new Map<string, RegistryEntry[]>();
  for (const entry of entries) {
    const key = `${entry.phase}|${entry.gesture}|${entry.arg ?? ''}|${entry.target ?? ''}|${canonicalModifiers(entry.modifiers)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  const conflicts: Conflict[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    const first = bucket[0];
    conflicts.push({
      phase: first.phase,
      gesture: first.gesture,
      arg: first.arg,
      target: first.target,
      modifiers: first.modifiers,
      toolIds: bucket.map((e) => e.toolId),
    });
  }
  return conflicts;
}
