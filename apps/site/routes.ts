/** The front page: what an empty hash shows. */
export const FRONT_ID = '';
export const GET_STARTED_ID = '__get_started';
export const WHATS_NEW_ID = '__whats_new';
export const RELEASES_ID = '__releases';
export const FEATURES_ID = '__features';
/** Whichever demo the sidebar lists first; a link can name it without loading the registry. */
export const DEMOS_ID = '__demos';

const PAGE_IDS = new Set([GET_STARTED_ID, FEATURES_ID, WHATS_NEW_ID, RELEASES_ID]);

/**
 * The page a URL hash names: a built-in page, a demo or a package page — which
 * `isPage` answers for — or, for an empty hash and for one that names nothing,
 * the front page.
 */
export function routeOf(hash: string, isPage: (id: string) => boolean): string {
  const id = hash.replace(/^#/, '');
  return PAGE_IDS.has(id) || isPage(id) ? id : FRONT_ID;
}

/** True when the URL has no hash, which is the front page's address. */
export function atFront(): boolean {
  return window.location.hash.replace(/^#/, '') === FRONT_ID;
}

/**
 * Go to the front page. It has no hash of its own, so the hash is dropped, not rewritten. A link
 * the reader followed pushes a history entry; a hash that named nothing is replaced.
 */
export function goFront(how: 'push' | 'replace'): void {
  const { pathname, search } = window.location;
  if (how === 'push') window.history.pushState(null, '', pathname + search);
  else window.history.replaceState(null, '', pathname + search);
  // Neither fires an event, and the app's root switches pages on this one.
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
