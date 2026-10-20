/** One local-storage entry: its key and the JSON text it holds. */
export type SessionEntry = readonly [key: string, json: string];

/**
 * The entry under `key` read through `parse`, or `fallback()` when there is none, when storage
 * cannot be reached, or when `parse` throws on what is there.
 */
export function readStored<T>(key: string, parse: (raw: string) => T, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(raw) : fallback();
  } catch {
    return fallback();
  }
}

/**
 * Write a document and the entries that depend on it, such as its undo stacks, best-effort.
 * A dependent that fails to save after its document did is removed along with the other
 * dependents, because an older undo stack would replay against the wrong document. When the
 * document itself fails, the previous document and its dependents stay as they are. Answers
 * whether the document was saved.
 */
export function writeSession(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  primary: SessionEntry,
  dependents: readonly SessionEntry[] = [],
): boolean {
  try {
    storage.setItem(primary[0], primary[1]);
  } catch {
    return false;
  }
  try {
    for (const [key, json] of dependents) storage.setItem(key, json);
  } catch {
    for (const [key] of dependents) {
      try { storage.removeItem(key); } catch { /* best-effort */ }
    }
  }
  return true;
}
