/** What a lab saved under `key` in local storage, or null when nothing was, it does not parse, or storage is off. */
export function readSaved<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Saves `value` under `key`; a lab with storage off or full keeps working for the visit. */
export function writeSaved(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: nothing to keep */
  }
}
