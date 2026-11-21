import { isOlderRelease } from '@shared/releaseMajor';

/** The front page: what an empty hash shows. */
export const FRONT_ID = '';
export const GET_STARTED_ID = '__get_started';
export const WHATS_NEW_ID = '__whats_new';
export const RELEASES_ID = '__releases';
/** Every release before `CURRENT_MAJOR`, kept off the Releases page so opening it fetches none of them. */
export const OLDER_RELEASES_ID = '__older_releases';
export const FEATURES_ID = '__features';
/** Whichever demo the sidebar lists first; a link can name it without loading the registry. */
export const DEMOS_ID = '__demos';

const PAGE_IDS = new Set([GET_STARTED_ID, FEATURES_ID, WHATS_NEW_ID, RELEASES_ID, OLDER_RELEASES_ID]);

/**
 * The page a URL hash names: a built-in page, a demo or a package page — which
 * `isPage` answers for — or, for an empty hash and for one that names nothing,
 * the front page.
 */
export function routeOf(hash: string, isPage: (id: string) => boolean): string {
  const id = hash.replace(/^#/, '');
  return PAGE_IDS.has(id) || isPage(id) ? id : FRONT_ID;
}

/** Whether `id` is one of the two release history pages. */
export function isReleasesPage(id: string): boolean {
  return id === RELEASES_ID || id === OLDER_RELEASES_ID;
}

/** The query param naming a version to open and scroll to, e.g. `?v=1.9.4#__releases`. */
export const VERSION_PARAM = 'v';

/**
 * The page to show for route `id` under query string `search`: a release history page whose
 * `?v=` names a version kept on the other one is swapped for it, so an old link still lands.
 */
export function releasesRouteFor(id: string, search: string): string {
  if (!isReleasesPage(id)) return id;
  const version = new URLSearchParams(search).get(VERSION_PARAM);
  if (!version) return id;
  return isOlderRelease(version) ? OLDER_RELEASES_ID : RELEASES_ID;
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
