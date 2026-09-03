/**
 * Whether a stored mark still describes the picture the current config
 * produces. A target names the config keys its positions depend on; labkit
 * snapshots and compares them without knowing what any of them mean.
 */

/** The values of `keys` in `config`, for storing beside a new mark. Keys the
 *  config does not carry are omitted rather than stored as undefined, so the
 *  snapshot says what was known rather than what was asked. */
export function seenFrom(
  config: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (config === null || typeof config !== 'object') return out;
  const src = config as Record<string, unknown>;
  for (const k of keys) {
    if (k in src) out[k] = src[k];
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
  const src = config as Record<string, unknown>;
  for (const k of keys) {
    if (!(k in seen)) continue;
    if (!Object.is(seen[k], src[k])) return true;
  }
  return false;
}
