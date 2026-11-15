import type { ThemeDefinition } from '@weasel-js/theme';
import { isUnreadableKey, readStored, writeSession } from '@weasel-js/editor';
import { clearSavedHistory, type LabHistoryStore, localHistoryStore } from '../historyStorage';

export interface StoredDraft {
  readonly definition: ThemeDefinition;
  /** The file's hash when the draft began, so a save over a file that moved on since answers with a conflict. */
  readonly baseHash: string | null;
}

const DRAFT_PREFIX = 'weasel.theme-editor.draft.';
const draftKey = (name: string) => `${DRAFT_PREFIX}${name}`;
const LAST_KEY = 'weasel.theme-editor.theme';
// Not under DRAFT_PREFIX, which `draftNames` reads as the drafts.
const historyKey = (name: string) => `weasel.theme-editor.draft-history.${name}`;

/** Where theme `name`'s undo history is kept, beside its draft. */
export const draftHistory = (name: string): LabHistoryStore<ThemeDefinition> =>
  localHistoryStore(historyKey(name));

/** Forget theme `name`'s undo history, as discarding its draft does. */
export const clearDraftHistory = (name: string): void => clearSavedHistory(historyKey(name));

export function parseDraft(raw: string | null, name: string): StoredDraft | null {
  if (!raw) return null;
  try {
    return draftOf(JSON.parse(raw), name);
  } catch {
    return null;
  }
}

/** The draft of theme `name` that `parsed`, a stored draft as `JSON.parse` reads it, holds, or null for none. */
function draftOf(parsed: unknown, name: string): StoredDraft | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { definition, baseHash } = parsed as { definition?: unknown; baseHash?: unknown };
  if (typeof definition !== 'object' || definition === null || (definition as { name?: unknown }).name !== name) return null;
  if (typeof baseHash !== 'string' && baseHash !== null) return null;
  return { definition: definition as ThemeDefinition, baseHash };
}

/** Theme `name`'s draft, or null for none. One that cannot be read is kept aside (`readStored`), since the next edit
 *  saves over it. */
export function loadDraft(name: string): StoredDraft | null {
  return readStored(draftKey(name), (value) => {
    const draft = draftOf(value, name);
    if (draft === null) throw new Error(`not a draft of theme "${name}"`);
    return draft;
  }, () => null);
}

/** Every theme with a draft in storage, so a new theme not yet saved survives a reload. */
export function draftNames(): string[] {
  try {
    const names: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX) && !isUnreadableKey(key)) names.push(key.slice(DRAFT_PREFIX.length));
    }
    return names;
  } catch {
    return [];
  }
}

/** Store `draft`; resolves whether the browser took it, which a private window or a full quota refuses, as it
 *  refuses to write over a draft `loadDraft` could not read until that one is kept aside. */
export const persistDraft = (draft: StoredDraft): Promise<boolean> =>
  writeSession([draftKey(draft.definition.name), draft]);

/** Remove theme `name`'s draft; resolves whether it went, under the same refusals as {@link persistDraft}. */
export const clearDraft = (name: string): Promise<boolean> => writeSession([draftKey(name), undefined]);

export function loadLastTheme(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function persistLastTheme(name: string): void {
  try {
    localStorage.setItem(LAST_KEY, name);
  } catch {}
}
