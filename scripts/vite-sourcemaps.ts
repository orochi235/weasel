import type { Plugin } from 'vite';

/**
 * Serves dev modules without sourcemaps unless `WEASEL_DEV_SOURCEMAPS=1`. Vite 8 inlines every
 * map as a base64 tail, which was 70% of the bytes a draw page load fetched, and its own
 * `dev.sourcemap` option is read by nothing. An empty `mappings` is the one value its pipeline
 * treats as "no map": it drops the chain and skips the fallback map it would otherwise invent.
 * Bundled dev mode is left alone: it writes one external `.map` that only devtools fetches.
 */
export function devSourcemaps(): Plugin {
  let strip = false;
  return {
    name: 'weasel:dev-sourcemaps',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      strip = !config.experimental.bundledDev && process.env.WEASEL_DEV_SOURCEMAPS !== '1';
    },
    // Vite keeps the loaded map for a module no transform changed, so the code has to change.
    transform: (code) => (strip ? { code: `${code}\n`, map: { mappings: '' } } : null),
  };
}
