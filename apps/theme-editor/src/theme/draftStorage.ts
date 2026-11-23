import type { ThemeDefinition } from '@weasel-js/theme';
import { isUnreadableKey, readStored, writeSession } from '@weasel-js/editor';
import { localStorageAdapter, readLocal, writeLocal } from '@weasel-js/storage';
import { clearSavedHistory, type LabHistoryStore, localHistoryStore } from '../historyStorage';

export interface StoredDraft {
  readonly definition: ThemeDefinition;
  /** The file's hash when the draft began, so a save over a file that moved on since answers with a conflict. */
  readonly baseHash: string | null;
}

const DRAFT_PREFIX = 'weasel.theme-editor.draft.';
const draftKey = (name: string) => `${DRAFT_PREFIX}${name}`;
const LAST_KEY = 'weasel.theme-editor.theme';
// Neither is under DRAFT_PREFIX, which `draftNames` reads as the drafts.
const HISTORY_PREFIX = 'weasel.theme-editor.draft-history.';
const historyKey = (name: string) => `${HISTORY_PREFIX}${name}`;
/** The themes with a saved undo history, most recently saved first. */
const HISTORY_ORDER_KEY = 'weasel.theme-editor.draft-histories';
/** How many themes keep an undo history across a reload. Each may take a million characters, against a quota near
 *  five million that the drafts and the palette lab's history share. */
export const KEPT_HISTORIES = 2;

function historyOrder(): string[] {
  const order = readLocal(HISTORY_ORDER_KEY);
  if (Array.isArray(order)) return order.filter((n): n is string => typeof n === 'string');
  // Histories saved before the order was kept are found once, by their keys.
  try {
    return localStorageAdapter.listSync(HISTORY_PREFIX).map(([key]) => key.slice(HISTORY_PREFIX.length));
  } catch {
    return [];
  }
}

/** Keep only the histories of `keep`'s themes, in its order. */
function keepHistories(keep: readonly string[]): void {
  for (const name of historyOrder()) if (!keep.includes(name)) clearSavedHistory(historyKey(name));
  writeLocal(HISTORY_ORDER_KEY, keep.length > 0 ? keep : undefined);
}

/** Where theme `name`'s undo history is kept, beside its draft. Saving it forgets the histories of all but the
 *  {@link KEPT_HISTORIES} themes saved most recently, and of every other theme when the browser refuses it for room. */
export function draftHistory(name: string): LabHistoryStore<ThemeDefinition> {
  const store = localHistoryStore<ThemeDefinition>(historyKey(name));
  return {
    ...store,
    save: (saved) => {
      keepHistories([name, ...historyOrder().filter((n) => n !== name)].slice(0, KEPT_HISTORIES));
      if (writeLocal(historyKey(name), saved)) return;
      keepHistories([name]);
      writeLocal(historyKey(name), saved);
    },
  };
}

/** Forget theme `name`'s undo history, as discarding its draft does. */
export function clearDraftHistory(name: string): void {
  clearSavedHistory(historyKey(name));
  const order = historyOrder();
  if (order.includes(name)) keepHistories(order.filter((n) => n !== name));
}

/** Forget the undo history of every theme not in `themes`, as one whose file was deleted. */
export function pruneDraftHistories(themes: readonly string[]): void {
  const order = historyOrder();
  if (order.some((n) => !themes.includes(n))) keepHistories(order.filter((n) => themes.includes(n)));
}

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
    return localStorageAdapter
      .listSync(DRAFT_PREFIX)
      .flatMap(([key]) => (isUnreadableKey(key) ? [] : [key.slice(DRAFT_PREFIX.length)]));
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
  const name = readLocal(LAST_KEY);
  return typeof name === 'string' ? name : null;
}

export function persistLastTheme(name: string): void {
  writeLocal(LAST_KEY, name);
}
