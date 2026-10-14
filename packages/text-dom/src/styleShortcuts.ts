import type { StyleToggle } from './textEditTypes';

/**
 * The shortcut each styling answers to. Strikethrough takes Cmd+Shift+X
 * (Docs' binding) and MUST require shift: bare Cmd+X is cut, and swallowing
 * it here would break cutting text mid-edit. Superscript takes Word's
 * Cmd+Shift+=; subscript takes Cmd+Shift+- rather than Word's Cmd+-, because
 * the unshifted pair is browser zoom, which a page cannot cancel.
 *
 * Matching is on the *unshifted* character: a US layout reports Cmd+Shift+=
 * as `'+'` and Cmd+Shift+- as `'_'`.
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

/** The styling `e` toggles, or null when it isn't a styling shortcut. */
export function toggleForKey(e: KeyboardEvent): StyleToggle | null {
  if (!e.metaKey && !e.ctrlKey) return null;
  const raw = e.key.toLowerCase();
  const key = UNSHIFT[raw] ?? raw;
  return STYLE_SHORTCUTS.find((s) => s.key === key && s.shift === e.shiftKey)?.toggle ?? null;
}
