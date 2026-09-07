import { registerFont } from '@weasel-js/font';

// Vite/esbuild URL imports — these resolve to the bundled asset paths at build time.
// In dev, they resolve to dev-server URLs the renderer can fetch.
import metricsUrl from './inter.json?url';
import atlasUrl from './inter.png?url';

/** Family name the bundled HUD font registers under. Widgets that name no
 *  family draw with it. */
export const DEFAULT_FONT_FAMILY = 'weasel-hud-default';

/** A bitmap face: the `registerFont` pair, as one value. */
export interface FontAtlasUrls {
  metricsUrl: string;
  atlasUrl: string;
}

/**
 * Register an Inter-shaped atlas under {@link DEFAULT_FONT_FAMILY}. `attachHud`
 * calls this; calling it again is a no-op.
 *
 * `urls` points the family at a copy the host already serves. The bundled atlas
 * is the same Inter every weasel app ships in its own publicDir, and fetching
 * both costs a second 150 kB transfer and a second `createImageBitmap` for
 * bytes already in memory.
 */
export async function registerDefaultFont(urls?: FontAtlasUrls): Promise<void> {
  await registerFont(
    DEFAULT_FONT_FAMILY,
    {},
    urls?.metricsUrl ?? metricsUrl,
    urls?.atlasUrl ?? atlasUrl,
  );
}
