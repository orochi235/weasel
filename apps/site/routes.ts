/** The front page: what an empty hash shows. */
export const FRONT_ID = '';
export const GET_STARTED_ID = '__get_started';
export const WHATS_NEW_ID = '__whats_new';
export const RELEASES_ID = '__releases';

const PAGE_IDS = new Set([GET_STARTED_ID, WHATS_NEW_ID, RELEASES_ID]);

/**
 * The page a URL hash names: a built-in page, a demo, or — for an empty hash
 * and for one that names nothing — the front page.
 */
export function routeOf(hash: string, isDemo: (id: string) => boolean): string {
  const id = hash.replace(/^#/, '');
  return PAGE_IDS.has(id) || isDemo(id) ? id : FRONT_ID;
}
