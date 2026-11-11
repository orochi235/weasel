/**
 * Whether a stored mark still describes the picture the current config
 * produces. A target names the config keys its positions depend on; labkit
 * snapshots and compares them without knowing what any of them mean.
 */

import { deepEqual } from '@weasel-js/registry';
import { hasConfigPath, setOwn, valueAtPath } from '../config/path';

/** The values of `keys` in `config`, each a dotted path, for storing beside a new mark. Keys the
 *  config does not carry are omitted rather than stored as undefined, so the
 *  snapshot says what was known rather than what was asked. */
export function seenFrom(config: unknown, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (hasConfigPath(config, k)) setOwn(out, k, valueAtPath(config, k));
  }
  return out;
}

/**
 * Whether the picture moved under the mark.
 *
 * Only keys present in `seen` are compared. A mark filed before its target
 * declared a new dependency must not go stale retroactively: nothing can know
 * what that key was at the time, and guessing would grey out every old mark
 * the first time a target grows a key.
 */
export function isStale(
  seen: Readonly<Record<string, unknown>> | undefined,
  config: unknown,
  keys: readonly string[],
): boolean {
  if (!seen || keys.length === 0) return false;
  if (config === null || typeof config !== 'object') return false;
  for (const k of keys) {
    if (!Object.hasOwn(seen, k)) continue;
    if (!deepEqual(seen[k], valueAtPath(config, k))) return true;
  }
  return false;
}
