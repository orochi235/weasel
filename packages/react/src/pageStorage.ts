/** The page's `localStorage`, or undefined where there is none, or where the browser refuses it: with site data
 *  blocked, reading `localStorage` itself throws, before any method is called. */
export function pageLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}
