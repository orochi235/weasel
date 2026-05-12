import type { ActionFn, RouteTable, RouteEntry, ModifierRoute } from './types';
import type { HitResult } from './hitResult';
import type { ToolModifiers } from '../types';
import { mods, type ModifierKey } from './modifiers';

/** Result of a successful `resolveRoute` lookup: the resolved `ActionFn`
 *  plus the route-table key that matched after precedence resolution.
 *  Consumers (currently only `defineTool`) use `matchedKey` for debug
 *  reflection — answering "why did this route fire?" by surfacing the
 *  exact post-precedence key. */
export interface RouteMatch<TScratch> {
  action: ActionFn<TScratch>;
  matchedKey: string;
}

/** Resolve a route entry to an `ActionFn` (or undefined) given the current
 *  hit-test result and modifier snapshot. Implements the four-level
 *  target precedence (exact → subkind-wildcard → base-kind → universal)
 *  and the modifier sub-table exact-match + 'default' fallback. Returns
 *  the matched route-table key alongside the action so callers can attach
 *  it to debug-overlay reflection. */
export function resolveRoute<TScratch>(
  table: RouteTable<TScratch>,
  hit: HitResult,
  modifiers: ToolModifiers,
): RouteMatch<TScratch> | undefined {
  const candidateKeys = buildCandidateKeys(hit);
  for (const key of candidateKeys) {
    const entry = table[key];
    if (entry == null) continue;
    const resolved = resolveEntry(entry, modifiers);
    if (resolved) return { action: resolved, matchedKey: key };
  }
  return undefined;
}

/** Produce the ordered list of route-table keys to try for `hit`. */
function buildCandidateKeys(hit: HitResult): string[] {
  if (hit.category === 'empty') return ['empty'];
  const kind = hit.kind;
  const colon = kind.indexOf(':');
  if (colon < 0) {
    // No subkind — try exact then universal.
    return [kind, '*'];
  }
  const baseKind = kind.substring(0, colon);
  const subKind = kind.substring(colon + 1);
  // Order: exact → subkind-wildcard → base-kind → universal.
  return [kind, `*:${subKind}`, baseKind, '*'];
}

/** Resolve a RouteEntry (function or sub-table) using modifiers. */
function resolveEntry<TScratch>(
  entry: RouteEntry<TScratch>,
  modifiers: ToolModifiers,
): ActionFn<TScratch> | undefined {
  if (typeof entry === 'function') return entry;
  const subTable = entry as ModifierRoute<TScratch>;
  const wanted = modifiersToKey(modifiers);
  return subTable[wanted] ?? subTable.default;
}

/** Translate the runtime ToolModifiers snapshot to the canonical
 *  ModifierKey for sub-table lookup. */
function modifiersToKey(modifiers: ToolModifiers): ModifierKey {
  const active: Array<'mod' | 'shift' | 'alt'> = [];
  // 'mod' is the platform-natural primary modifier:
  // Cmd on Mac (meta), Ctrl elsewhere.
  if (modifiers.meta || modifiers.ctrl) active.push('mod');
  if (modifiers.shift) active.push('shift');
  if (modifiers.alt) active.push('alt');
  return mods(...active);
}
