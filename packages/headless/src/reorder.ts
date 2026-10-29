/**
 * Moving items within an ordered list. A destination is a gap, counted before anything is taken out: 0 before the
 * first item, `length` after the last, and `i` between `items[i - 1]` and `items[i]` — the gap a UI marks while it
 * carries something. The items moved are named by their indices, so a selection of several moves in one go.
 */

const sortedSet = (at: readonly number[]): number[] => [...new Set(at)].sort((a, b) => a - b);

/** `items` with the items at indices `at` taken out and put back, in their order, in gap `to`. */
export function moveItems<T>(items: readonly T[], at: readonly number[], to: number): T[] {
  const taken = new Set(at);
  const moved = sortedSet(at).flatMap((i) => (i >= 0 && i < items.length ? [items[i]!] : []));
  const out = items.filter((_, i) => !taken.has(i));
  out.splice(movedIndex(at, to), 0, ...moved);
  return out;
}

/** The index the first of the items at `at` holds once {@link moveItems} has put them in gap `to`. */
export function movedIndex(at: readonly number[], to: number): number {
  return to - sortedSet(at).filter((i) => i < to).length;
}

/** Whether putting the items at `at` in gap `to` leaves them where they are: a contiguous run dropped in a gap at
 *  either of its ends or inside it. False for no items. */
export function isNoopDrop(at: readonly number[], to: number): boolean {
  const s = sortedSet(at);
  if (s.length === 0) return false;
  const first = s[0]!;
  const last = s[s.length - 1]!;
  return last - first + 1 === s.length && to >= first && to <= last + 1;
}

/** The gap a one-place move sends the items at `at` to: before the item ahead of the first (`by` -1), or after the
 *  item past the last (`by` 1). Null where that runs off either end of a list `length` long, or for no items. */
export function nudgeGap(at: readonly number[], by: -1 | 1, length: number): number | null {
  const s = sortedSet(at);
  if (s.length === 0) return null;
  const to = by < 0 ? s[0]! - 1 : s[s.length - 1]! + 2;
  return to < 0 || to > length ? null : to;
}

/**
 * The gap a point `p` along a line of items falls in, where each item splits at its middle: how many of the
 * middles `mids`, given in item order, `p` has reached. A line whose middles run backward, as a right-to-left row
 * does along x, counts the other way. For items that sit side by side — rows, tabs, chips.
 */
export function gapByMidpoint(mids: readonly number[], p: number): number {
  const backward = mids.length > 1 && mids[mids.length - 1]! < mids[0]!;
  return mids.filter((m) => (backward ? m >= p : m <= p)).length;
}

/** Which of the gaps at positions `gaps` along a line is nearest `p`, as an index into `gaps`; -1 for none. For
 *  gaps drawn at places of their own, between items set apart however the layout put them: picking the nearest
 *  keeps the gap chosen the one whose mark is drawn closest. */
export function nearestGap(gaps: readonly number[], p: number): number {
  let best = -1;
  for (let k = 0; k < gaps.length; k++) if (best < 0 || Math.abs(gaps[k]! - p) < Math.abs(gaps[best]! - p)) best = k;
  return best;
}

/** The keys and modifiers a nudge chord reads off a keystroke. */
export interface NudgeKey {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Alt with neither Ctrl nor Cmd held: the chord that moves an item instead of moving focus. */
export function isNudgeChord(e: NudgeKey): boolean {
  return e.altKey && !e.ctrlKey && !e.metaKey;
}

/** Which way the nudge chord moves an item: `-1` for Alt+`back`, `1` for Alt+`on`, `null` for any other key.
 *  The keys are Up and Down unless named. */
export function nudgeOf(e: NudgeKey, back = 'ArrowUp', on = 'ArrowDown'): -1 | 1 | null {
  if (!isNudgeChord(e)) return null;
  if (e.key === back) return -1;
  return e.key === on ? 1 : null;
}
