import { registerFont } from '@weasel-js/core/renderer';

// Vite/esbuild URL imports — these resolve to the bundled asset paths at build time.
// In dev, they resolve to dev-server URLs the renderer can fetch.
import metricsUrl from './inter.json?url';
import atlasUrl from './inter.png?url';

export const DEFAULT_FONT_FAMILY = 'weasel-hud-default';

export async function registerDefaultFont(): Promise<void> {
  await registerFont(DEFAULT_FONT_FAMILY, {}, metricsUrl, atlasUrl);
}
