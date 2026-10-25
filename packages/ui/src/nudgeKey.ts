interface KeyLike {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Alt with neither Ctrl nor Cmd held: the chord that moves an item instead of moving focus. */
export function isNudgeChord(e: KeyLike): boolean {
  return e.altKey && !e.ctrlKey && !e.metaKey;
}

/**
 * Which way the nudge chord moves an item: `-1` for Alt+`back`, `1` for Alt+`on`, `null` for any other key.
 * The keys are Up and Down unless named.
 */
export function nudgeOf(e: KeyLike, back = 'ArrowUp', on = 'ArrowDown'): -1 | 1 | null {
  if (!isNudgeChord(e)) return null;
  if (e.key === back) return -1;
  return e.key === on ? 1 : null;
}
