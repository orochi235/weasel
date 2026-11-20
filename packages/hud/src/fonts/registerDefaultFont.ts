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
 * Register an Inter-shaped atlas under {@link DEFAULT_FONT_FAMILY}, lazily: it
 * is fetched the first time a widget lays out text, and the promise settles
 * with that load. `attachHud` calls this. Calling it again with the URLs the
 * family already holds is a no-op.
 *
 * `urls` points the family at a copy the host already serves. The bundled atlas
 * is the same Inter every weasel app ships in its own publicDir, and fetching
 * both costs a second 150 kB transfer and a second `createImageBitmap` for
 * bytes already in memory.
 *
 * The family is one per page, shared by every HUD. Throws, fetching nothing,
 * when it is already registered from other URLs: give every HUD the same
 * `font`, or register the other atlas under a family of its own and pass its name.
 */
export function registerDefaultFont(urls?: FontAtlasUrls): Promise<void> {
  const metrics = urls?.metricsUrl ?? metricsUrl;
  const atlas = urls?.atlasUrl ?? atlasUrl;
  try {
    return registerFont(DEFAULT_FONT_FAMILY, {}, metrics, atlas, { lazy: true });
  } catch (err) {
    throw new Error(
      `weasel-hud: the HUD font "${DEFAULT_FONT_FAMILY}" is already registered from other URLs than ` +
      `${metrics} and ${atlas}; every HUD on a page shares it. Give each HUD the same \`font\`, or register ` +
      'the other atlas under a family of its own and pass its name as `font`.',
      { cause: err },
    );
  }
}
