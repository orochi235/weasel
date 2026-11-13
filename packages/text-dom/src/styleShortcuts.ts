import { matchKeyEvent, textOwnsChord } from '@weasel-js/gestures';
import type { StyleToggle } from './textEditTypes';

/**
 * The shortcut each styling answers to. Strikethrough takes Cmd+Shift+X
 * (Docs' binding) and MUST require shift: bare Cmd+X is cut, and swallowing
 * it here would break cutting text mid-edit. Superscript takes Word's
 * Cmd+Shift+=; subscript takes Cmd+Shift+- rather than Word's Cmd+-, because
 * the unshifted pair is browser zoom, which a page cannot cancel.
 *
 * Matching is on the *unshifted* character: a US layout reports Cmd+Shift+=
 * as `'+'` and Cmd+Shift+- as `'_'`. A non-Latin layout's letter is read by
 * the key it sits on, so Cmd+и on a Russian layout is Cmd+B.
 *
 * Underline has to be intercepted, not merely supported. Left alone, the
 * browser runs its own `formatUnderline` and `domToRuns`' `<u>` flattening
 * makes that *look* like it worked while bypassing `patchForToggle`
 * entirely — no toggle-off, no pending style for a collapsed caret.
 */
const STYLE_SHORTCUTS: ReadonlyArray<{ key: string; shift: boolean; toggle: StyleToggle }> = [
  { key: 'b', shift: false, toggle: 'bold' },
  { key: 'i', shift: false, toggle: 'italic' },
  { key: 'u', shift: false, toggle: 'underline' },
  { key: 'x', shift: true, toggle: 'strikethrough' },
  { key: '=', shift: true, toggle: 'super' },
  { key: '-', shift: true, toggle: 'sub' },
];

/** The characters shift produces from the keys the table names. */
const UNSHIFT: Readonly<Record<string, string>> = { '+': '=', _: '-' };

/** The styling `e` toggles, or null when it isn't a styling shortcut. A Mac's
 *  Ctrl chords are its text editing ({@link textOwnsChord}), so there only Cmd styles. */
export function toggleForKey(e: KeyboardEvent, apple?: boolean): StyleToggle | null {
  if ((!e.metaKey && !e.ctrlKey) || textOwnsChord(e, apple)) return null;
  const unshifted = UNSHIFT[e.key];
  const named = (key: string): boolean => unshifted === key || matchKeyEvent(e, key);
  return STYLE_SHORTCUTS.find((s) => s.shift === e.shiftKey && named(s.key))?.toggle ?? null;
}
