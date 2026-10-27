import type { MenuController, MenuEntry, MenuTextEntry } from '@weasel-js/menu';

/** A text row being typed into in a HUD menu: which row, and what has been typed so far. */
export interface HudTextEdit {
  entry: MenuTextEntry;
  draft: string;
}

/** What one key does to an edit: the edit it leaves, null once Enter or Escape ends it, and on Enter the text to
 *  write. A character is added at the end and Backspace takes the last one off; any other key is held and ignored. */
export function editKey(edit: HudTextEdit, key: string): { edit: HudTextEdit | null; commit?: string } {
  if (key === 'Enter') return { edit: null, commit: edit.draft };
  if (key === 'Escape') return { edit: null };
  if (key === 'Backspace') return { edit: { ...edit, draft: Array.from(edit.draft).slice(0, -1).join('') } };
  if (Array.from(key).length === 1) return { edit: { ...edit, draft: edit.draft + key } };
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
      edit = { entry: e, draft: c.textValue(e) ?? '' };
      changed();
    },
    /** End the edit keeping what was typed, as a blur does, unless it is `e`'s. */
    leave(e?: MenuEntry) { if (edit && edit.entry !== e) end(edit.draft); },
    /** Feed a key to the edit; false when nothing is being typed. */
    key(key: string): boolean {
      if (!edit) return false;
      const next = editKey(edit, key);
      if (next.edit) { edit = next.edit; changed(); } else end(next.commit);
      return true;
    },
  };
}
