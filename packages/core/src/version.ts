/**
 * The kit version a build was compiled from, so an app can report what it is
 * running. Substituted at build time — by `tsup.config.ts` for the published
 * package, and by `scripts/vite-build-info.ts` for anything in this repo that
 * bundles core's source through the workspace aliases.
 *
 * Apps pair this with their own compile timestamp; the kit deliberately does
 * not carry one, since a published package's build date says nothing about
 * when the app embedding it was built.
 */

declare const __WEASEL_CORE_VERSION__: string | undefined;

/**
 * Semver of `@weasel-js/core` as of the build.
 *
 * Falls back to `'0.0.0-unknown'` when core's source is imported by a bundler
 * that hasn't been given the define — honest about not knowing rather than
 * throwing, since nothing about version reporting should be able to break a
 * consumer's build.
 */
export const VERSION: string =
  typeof __WEASEL_CORE_VERSION__ === 'string' ? __WEASEL_CORE_VERSION__ : '0.0.0-unknown';
