/** One local-storage entry: its key and the JSON text it holds. */
export type SessionEntry = readonly [key: string, json: string];

/**
 * The entry under `key` read through `parse`, or `fallback()` when there is none, when storage
 * cannot be reached, or when `parse` throws on what is there. An entry `parse` throws on is copied
 * to `<key>:unreadable` first, with a `console.error`, since the next save writes over `key`: like a
 * failed {@link writeSession}, a failed read does not cost the stored document.
 */
export function readStored<T>(key: string, parse: (raw: string) => T, fallback: () => T): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback();
  }
  if (!raw) return fallback();
  try {
    return parse(raw);
  } catch (err) {
    keepUnreadable(key, raw, err);
    return fallback();
  }
}

function keepUnreadable(key: string, raw: string, err: unknown): void {
  const aside = `${key}:unreadable`;
  try {
    if (localStorage.getItem(aside) === raw) return;
    localStorage.setItem(aside, raw);
    console.error(`weasel: the entry under "${key}" could not be read; it is kept under "${aside}"`, err);
  } catch {
    console.error(`weasel: the entry under "${key}" could not be read, and could not be kept aside`, err);
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
