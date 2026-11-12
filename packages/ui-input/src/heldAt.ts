/** `at` when it names an item of a list `length` long, else null: a highlight left past the end of a list that
 *  shrank, or an index that names nothing, reads as no highlight. */
export function heldAt(length: number, at: number | null): number | null {
  return at !== null && Number.isInteger(at) && at >= 0 && at < length ? at : null;
}
