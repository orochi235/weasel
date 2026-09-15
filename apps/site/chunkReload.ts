/** A dynamic import whose chunk failed to load, in the words Chromium, Firefox, WebKit and Vite's preload helper use. */
const CHUNK_LOAD_ERRORS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
];

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_LOAD_ERRORS.some((pattern) => pattern.test(message));
}

export interface ReloadStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'weasel-demos:chunk-reload';

/** How long after one reload for a missing chunk another is refused. */
export const RELOAD_WINDOW_MS = 30_000;

/**
 * Whether a missing chunk should reload the page. A tab opened before a deploy asks for chunk names that no longer
 * exist, and one reload fetches the current ones; a chunk still missing after that shows its error instead of looping.
 */
export function reloadOnce(store: ReloadStore | undefined, now: number): boolean {
  if (!store) return false;
  try {
    const last = Number(store.getItem(KEY));
    if (last > 0 && now - last < RELOAD_WINDOW_MS) return false;
    store.setItem(KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

/** The tab's session storage; undefined where storage is refused. */
export function sessionStore(): ReloadStore | undefined {
  try {
    return window.sessionStorage ?? undefined;
  } catch {
    return undefined;
  }
}
