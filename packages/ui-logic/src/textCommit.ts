/** How a text field's edit ends: `'commit'` writes what was typed, `'cancel'` drops it and puts back what was there. */
export type EditEnd = 'commit' | 'cancel';

/** What a field varies in how its edit ends: what Escape does (`'cancel'` by default), and whether the field holds
 *  more than one line, which leaves Shift+Enter to type a line break rather than commit. */
export interface EditEndShape {
  escape?: EditEnd;
  multiline?: boolean;
}

/** What may end an edit: a key, with whether Shift is held, or the field losing focus. A key {@link imeKey} claims is
 *  the caller's to hold back. */
export type EditCause = 'blur' | { key: string; shift?: boolean };

/** How `cause` ends a text field's edit, or null when it leaves the edit open. Enter and blur commit, Escape cancels
 *  unless `shape` says otherwise. */
export function editEnd(cause: EditCause, shape: EditEndShape = {}): EditEnd | null {
  if (cause === 'blur') return 'commit';
  if (cause.key === 'Enter') return shape.multiline && cause.shift ? null : 'commit';
  if (cause.key === 'Escape') return shape.escape ?? 'cancel';
  return null;
}

/** A keydown as the platform reports it, enough to tell whether an input method owns it. */
export interface KeySource {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
}

/** Whether a keydown belongs to an input method, which a field must leave alone: Enter there confirms a candidate and
 *  Escape dismisses them. Safari sends the Enter that ends a composition with `isComposing` already false, but with
 *  `keyCode` 229. */
export function imeKey(e: KeySource): boolean {
  return e.isComposing === true || e.keyCode === 229 || e.key === 'Process' || e.key === 'Dead';
}
