import type { MenuController, MenuEntry, MenuTextEntry } from '@weasel-js/menu';

/** A text row being typed into in a HUD menu: which row, what has been typed so far, and the caret and the other
 *  end of the selection, as code-point offsets into `draft`. `anchor` equals `caret` when nothing is selected. */
export interface HudTextEdit {
  entry: MenuTextEntry;
  draft: string;
  caret: number;
  anchor: number;
}

/** The modifiers a key arrives with: `shift` extends the selection, `mod` (Ctrl or Cmd) selects all on `a` and moves
 *  to an end on an arrow, and `alt` moves an arrow by a word. */
export interface EditMods { shift?: boolean; mod?: boolean; alt?: boolean }

const WORD = /[\p{L}\p{N}\p{M}_]/u;

/** The start of the word before `from` (dir -1) or the end of the word after it (dir 1), skipping what lies between. */
export function wordStop(chars: readonly string[], from: number, dir: -1 | 1): number {
  const at = (i: number) => WORD.test(chars[dir < 0 ? i - 1 : i] ?? '');
  const inside = (i: number) => (dir < 0 ? i > 0 : i < chars.length);
  let i = from;
  while (inside(i) && !at(i)) i += dir;
  while (inside(i) && at(i)) i += dir;
  return i;
}

/** An edit of `entry` holding `draft`, with the caret at its end. */
export function startEdit(entry: MenuTextEntry, draft: string): HudTextEdit {
  const n = Array.from(draft).length;
  return { entry, draft, caret: n, anchor: n };
}

/** The selection's two ends, in order. */
export function selectionOf(edit: HudTextEdit): [number, number] {
  return edit.caret < edit.anchor ? [edit.caret, edit.anchor] : [edit.anchor, edit.caret];
}

/** `edit` with `[from, to)` replaced by `text` and the caret after it. */
function splice(edit: HudTextEdit, from: number, to: number, text: string): HudTextEdit {
  const chars = Array.from(edit.draft);
  const caret = from + Array.from(text).length;
  return { ...edit, draft: [...chars.slice(0, from), text, ...chars.slice(to)].join(''), caret, anchor: caret };
}

/** `edit` with the caret at `to`, dragging the selection's far end along unless `extend`. */
function moveTo(edit: HudTextEdit, to: number, extend: boolean): HudTextEdit {
  const n = Array.from(edit.draft).length;
  const caret = Math.max(0, Math.min(n, to));
  return { ...edit, caret, anchor: extend ? edit.anchor : caret };
}

/** Where an arrow, Home or End puts the caret, or undefined for any other key. */
function moveFor(edit: HudTextEdit, key: string, mods: EditMods): number | undefined {
  const n = Array.from(edit.draft).length;
  const [from, to] = selectionOf(edit);
  if (key === 'Home' || (key === 'ArrowLeft' && mods.mod)) return 0;
  if (key === 'End' || (key === 'ArrowRight' && mods.mod)) return n;
  if (mods.alt && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    const dir = key === 'ArrowLeft' ? -1 : 1;
    const start = mods.shift ? edit.caret : dir < 0 ? from : to;
    return wordStop(Array.from(edit.draft), start, dir);
  }
  // An arrow with no Shift collapses a selection to its side before it moves anything.
  if (key === 'ArrowLeft') return !mods.shift && from !== to ? from : edit.caret - 1;
  if (key === 'ArrowRight') return !mods.shift && from !== to ? to : edit.caret + 1;
  return undefined;
}

/** What one key does to an edit: the edit it leaves, null once Enter or Escape ends it, and on Enter the text to
 *  write. A character replaces the selection, Backspace and Delete take it or the character either side of the
 *  caret, and the arrows, Home and End move the caret; any other key is held and ignored. */
export function editKey(edit: HudTextEdit, key: string, mods: EditMods = {}): { edit: HudTextEdit | null; commit?: string } {
  if (key === 'Enter') return { edit: null, commit: edit.draft };
  if (key === 'Escape') return { edit: null };
  const to = moveFor(edit, key, mods);
  if (to !== undefined) return { edit: moveTo(edit, to, mods.shift === true) };
  if (mods.mod) {
    return { edit: key.toLowerCase() === 'a' ? { ...edit, anchor: 0, caret: Array.from(edit.draft).length } : edit };
  }
  const [from, end] = selectionOf(edit);
  if (key === 'Backspace') return { edit: from !== end ? splice(edit, from, end, '') : from > 0 ? splice(edit, from - 1, from, '') : edit };
  if (key === 'Delete') return { edit: splice(edit, from, from !== end ? end : end + 1, '') };
  if (Array.from(key).length === 1) return { edit: splice(edit, from, end, key) };
  return { edit };
}

/** The text row a HUD menu is typing into, kept by the widget since it has no field: what is typed, written through
 *  `c` on Enter. `changed` hears every change to what is drawn. */
export function createTextEditor(c: Pick<MenuController, 'textValue' | 'setText'>, changed: () => void) {
  let edit: HudTextEdit | null = null;
  const end = (commit?: string) => {
    const was = edit;
    edit = null;
    if (was && commit !== undefined) c.setText(was.entry, commit);
    changed();
  };
  return {
    current: () => edit,
    /** Start typing into `e` when it is a text row that is not disabled, and not the row already typed into. */
    start(e: MenuEntry | undefined) {
      if (e?.kind !== 'text' || e.disabled || edit?.entry === e) return;
      edit = startEdit(e, c.textValue(e) ?? '');
      changed();
    },
    /** When `e` is the row being typed into, put the caret at the offset `at` finds in what is typed; `at` gives
     *  undefined to leave the caret be. */
    place(e: MenuEntry | undefined, at: (draft: string) => number | undefined) {
      const to = edit && edit.entry === e ? at(edit.draft) : undefined;
      if (!edit || to === undefined) return;
      edit = moveTo(edit, to, false);
      changed();
    },
    /** End the edit keeping what was typed, as a blur does, unless it is `e`'s. */
    leave(e?: MenuEntry) { if (edit && edit.entry !== e) end(edit.draft); },
    /** Feed a key to the edit; false when nothing is being typed. */
    key(key: string, mods: EditMods = {}): boolean {
      if (!edit) return false;
      const next = editKey(edit, key, mods);
      if (next.edit) { edit = next.edit; changed(); } else end(next.commit);
      return true;
    },
  };
}
