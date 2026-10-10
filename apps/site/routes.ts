/** The front page: what an empty hash shows. */
export const FRONT_ID = '';
export const GET_STARTED_ID = '__get_started';
export const WHATS_NEW_ID = '__whats_new';
export const RELEASES_ID = '__releases';
/** Whichever demo the sidebar lists first; a link can name it without loading the registry. */
export const DEMOS_ID = '__demos';

const PAGE_IDS = new Set([GET_STARTED_ID, WHATS_NEW_ID, RELEASES_ID]);

/**
 * The page a URL hash names: a built-in page, a demo, or — for an empty hash
 * and for one that names nothing — the front page.
 */
export function routeOf(hash: string, isDemo: (id: string) => boolean): string {
  const id = hash.replace(/^#/, '');
  return PAGE_IDS.has(id) || isDemo(id) ? id : FRONT_ID;
}

/** True when the URL has no hash, which is the front page's address. */
export function atFront(): boolean {
  return window.location.hash.replace(/^#/, '') === FRONT_ID;
}

/** Go to the front page. It has no hash of its own, so the hash is dropped, not rewritten. */
export function goFront(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', pathname + search);
  // `replaceState` fires no event, and the app's root switches pages on this one.
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
