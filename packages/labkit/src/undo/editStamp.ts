let last = 0;

/**
 * When an undoable edit was recorded, for ordering edits across histories:
 * `Date.now()`, nudged past the stamp before it so two edits in one
 * millisecond still order. It compares with a weasel `History`'s own
 * timestamps, which are `Date.now()`, to the millisecond.
 */
export function editStamp(): number {
  last = Math.max(Date.now(), last + 0.001);
  return last;
}

/** The stamp `editStamp` last handed out: unchanged while no history anywhere
 *  has recorded an edit since. */
export function lastEditStamp(): number {
  return last;
}
