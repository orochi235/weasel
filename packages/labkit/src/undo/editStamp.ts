let last = 0;

/**
 * When an undoable edit was recorded, for ordering edits across histories:
 * `Date.now()`, nudged past the stamp before it so two edits in one
 * millisecond still order. It compares with a weasel `History`'s own
 * timestamps, which are `Date.now()`, to the millisecond.
 */
export function editStamp(): number {
  // Past 2^43 ms a thousandth rounds away; a restored stamp can stand there.
  last = Math.max(Date.now(), last + Math.max(0.001, Math.abs(last) * Number.EPSILON));
  return last;
}

/** The stamp `editStamp` last handed out: unchanged while no history anywhere
 *  has recorded an edit since. */
export function lastEditStamp(): number {
  return last;
}

/** Hand out stamps past `stamp` from now on: one a restored history already holds. */
export function seedEditStamp(stamp: number): void {
  if (Number.isFinite(stamp)) last = Math.max(last, stamp);
}
