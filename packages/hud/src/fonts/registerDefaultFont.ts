import { registerFont } from '@weasel-js/font';

// Vite/esbuild URL imports — these resolve to the bundled asset paths at build time.
// In dev, they resolve to dev-server URLs the renderer can fetch.
import metricsUrl from './inter.json?url';
import atlasUrl from './inter.png?url';

/** Family name the bundled HUD font registers under. Widgets that name no
 *  family draw with it. */
export const DEFAULT_FONT_FAMILY = 'weasel-hud-default';

/** Register the bundled Inter atlas under `DEFAULT_FONT_FAMILY`. `attachHud`
 *  calls this; calling it again is a no-op. */
export async function registerDefaultFont(): Promise<void> {
  await registerFont(DEFAULT_FONT_FAMILY, {}, metricsUrl, atlasUrl);
}
