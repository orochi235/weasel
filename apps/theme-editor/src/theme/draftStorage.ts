import type { ThemeDefinition } from '@weasel-js/theme';

export interface StoredDraft {
  readonly definition: ThemeDefinition;
  /** The file's hash when the draft began, so a save over a file that moved on since answers with a conflict. */
  readonly baseHash: string | null;
}

const draftKey = (name: string) => `weasel.theme-editor.draft.${name}`;
const LAST_KEY = 'weasel.theme-editor.theme';

export function parseDraft(raw: string | null, name: string): StoredDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { definition, baseHash } = parsed as { definition?: unknown; baseHash?: unknown };
  if (typeof definition !== 'object' || definition === null || (definition as { name?: unknown }).name !== name) return null;
  if (typeof baseHash !== 'string' && baseHash !== null) return null;
  return { definition: definition as ThemeDefinition, baseHash };
}

export function loadDraft(name: string): StoredDraft | null {
  try {
    return parseDraft(localStorage.getItem(draftKey(name)), name);
  } catch {
    // No storage at all: a private window, or jsdom.
    return null;
  }
}

export function persistDraft(draft: StoredDraft): void {
  try {
    localStorage.setItem(draftKey(draft.definition.name), JSON.stringify(draft));
  } catch {
    // Private windows and full quotas both land here.
  }
}

export function clearDraft(name: string): void {
  try {
    localStorage.removeItem(draftKey(name));
  } catch {
    // As above.
  }
}

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
  } catch {
    // As above.
  }
}
