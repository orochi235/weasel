import ports from '../dev-ports.json' with { type: 'json' };

/**
 * The apps `fleet-dev` can serve. `path` is where the dev server serves the app, which is its vite config's
 * dev-time `base`: Vite answers anything outside it with a "did you mean" page, so a printed URL off it is dead.
 */
export const FLEET_DEV_APPS = {
  draw: { config: 'apps/draw/vite.config.ts', port: ports.draw, path: '/weasel/draw/' },
  forge: { config: 'apps/forge/vite.config.ts', port: ports.forge, path: '/' },
  site: { config: 'vite.config.ts', port: ports.site, path: '/weasel/' },
  chart: { config: 'apps/chart/vite.config.ts', port: ports.chart, path: '/weasel/chart/' },
  'theme-editor': { config: 'apps/theme-editor/vite.config.ts', port: ports.themeEditor, path: '/weasel/theme-editor/' },
  'ui-lab': { config: 'apps/ui-lab/vite.config.ts', port: ports.uiLab, path: '/weasel/ui-lab/' },
};
