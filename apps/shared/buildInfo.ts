/**
 * What an in-repo app's build is: the kit version it was compiled against and
 * when it was compiled. Surfaced in WeaselDraw's status bar and the demo
 * site's sidebar, so a screenshot or a bug report can be pinned to a release.
 *
 * Neither app has a version of its own — neither is a workspace, and neither
 * ships a package.json — so the kit's lockstep version is the identity that
 * matters. `VERSION` comes from `@weasel-js/core`; the timestamp is the
 * importing app's, injected by `scripts/vite-build-info.ts`.
 *
 * Lives under `apps/shared/` rather than in a package because
 * `__WEASEL_BUILD_DATE__` is whatever the *importing bundle's* config
 * injected. Published from a package, it would report the package's own build
 * date to every consumer, which is not the question anyone is asking.
 */

import { VERSION } from '@weasel-js/core';

declare const __WEASEL_BUILD_DATE__: string | undefined;

/**
 * ISO timestamp of the build, or `undefined` when the define is missing (a
 * bundler that skipped `weaselDefines`, or a jsdom test importing this module
 * directly).
 */
export const BUILD_DATE: string | undefined =
  typeof __WEASEL_BUILD_DATE__ === 'string' ? __WEASEL_BUILD_DATE__ : undefined;

export const BUILD_VERSION = VERSION;

/** `Jul 30` — short enough for a status bar, unambiguous within a year. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Status-bar text, e.g. `0.7.0 · Jul 30`.
 *
 * On a dev server the timestamp is when the server started, not when anything
 * was built, so it reads `· dev` instead of dressing that up as a build date.
 */
export function buildLabel(isProd = import.meta.env.PROD): string {
  if (!isProd) return `${BUILD_VERSION} · dev`;
  return BUILD_DATE ? `${BUILD_VERSION} · ${shortDate(BUILD_DATE)}` : BUILD_VERSION;
}

/** Hover text — full precision for the cases where the short form isn't enough. */
export function buildTitle(isProd = import.meta.env.PROD): string {
  const when = BUILD_DATE
    ? `${isProd ? 'built' : 'dev server started'} ${BUILD_DATE}`
    : 'build date unavailable';
  return `@weasel-js/core ${BUILD_VERSION} — ${when}`;
}
