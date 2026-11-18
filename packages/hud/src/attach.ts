import type { Hud } from './hud';
import type { HudHost } from './host';
import { recordHudOn } from './loupe/loupeRoutes';
import type { CanvasExtensionApi, RenderLayer, LayerHit, View } from '@weasel-js/core';
import { clientToCanvas, viewToTransform } from '@weasel-js/core';
import { worldToScreen } from '@weasel-js/core';
import {
  DEFAULT_FONT_FAMILY,
  registerDefaultFont,
  type FontAtlasUrls,
} from './fonts/registerDefaultFont';
import { claimsOf, cursorOf, type Widget, type HudDrawCtx } from './widget';
import type { HudHitPayload } from './tool';
import { resolveTheme, weaselTheme, type ColorSourceContext, type ResolvedTheme } from '@weasel-js/theme';
import { hudColor } from './colors';
import { wireFocus } from './domFocus';
import { createHover } from './hover';
import { createLayerDeps } from './layerDeps';
import { createLayerDraw } from './layerDraw';

/** Options for `attachHud`. */
export interface AttachHudOptions {
  /** Resolved theme the widgets draw with. Defaults to the built-in theme's
   *  default mode; pass `useTheme().resolved` to follow a live theme. */
  readonly theme?: ResolvedTheme;
  /** What a widget's color sources resolve against: a theme, the tint list a
   *  numeric `tint` indexes, and a palette — `useTheme()`'s value is one.
   *  Defaults to the built-in theme and its list, resolved against `theme`. */
  readonly tints?: ColorSourceContext;
  /**
   * Where the text a widget draws without naming a family comes from.
   *
   * - A family name: that family, already registered by the host. The HUD
   *   fetches nothing.
   * - A `{ metricsUrl, atlasUrl }` pair: the HUD's own family, registered from
   *   the host's copy of the atlas rather than the bundled one.
   *
   * Unset, the bundled atlas is fetched and registered.
   */
  readonly font?: string | FontAtlasUrls;
}

/**
 * Bind a HUD to a canvas: register its render layer, route pointer input to
 * the widget under the cursor, and register the default font. Returns
 * the detach function.
 *
 * Throws if the HUD is already attached — a HUD belongs to one canvas at a
 * time.
 */
export function attachHud(
  api: CanvasExtensionApi,
  hud: Hud,
  options: AttachHudOptions = {},
): () => void {
  const detach = bindHud(api, hud, options);
  // Recorded so a HUD entry built without this HUD finds its loupes.
  const forget = recordHudOn(api, hud);
  return () => { forget(); detach(); };
}

/** Registers the bundled font, and redraws the canvas once it arrives while the HUD is still `attached` there. */
function loadDefaultFont(api: CanvasExtensionApi, urls: FontAtlasUrls | undefined, attached: () => boolean): void {
  registerDefaultFont(urls)
    .then(() => { if (attached()) api.requestRedraw(); })
    .catch((err) => {
      console.warn('weasel-hud: failed to register default font', err);
    });
}

/** The topmost widget that takes a press at `(sx, sy)`, or null where none does or one lets it pass. */
function widgetAt(hud: Hud, sx: number, sy: number): Widget | null {
  const list = hud.widgets();
  for (let i = list.length - 1; i >= 0; i--) {
    const w = list[i];
    if (!w.hidden && w.passes?.(sx, sy)) return null;
    // Decoration is skipped rather than downgraded: a hit at all would let
    // `hud.press` consume the press, and the walk has to keep descending to
    // whatever is beneath — another widget, or the scene.
    if (claimsOf(w).length === 0) continue;
    if (!w.hidden && w.hitTest(sx, sy)) return w;
  }
  return null;
}

function bindHud(api: CanvasExtensionApi, hud: Hud, options: AttachHudOptions): () => void {
  const theme = options.theme ?? resolveTheme(weaselTheme);
  const color = hudColor(options.tints ?? { theme: weaselTheme, resolved: theme });
  if (hud.attached) {
    throw new Error('weasel-hud: this HUD is already attached to a canvas.');
  }

  // Register the default font. It loads when a widget first lays out text,
  // which lays out as nothing until then. A named family is the host's to have
  // registered, so there is nothing to fetch and nothing to wait for.
  const font = options.font;
  const defaultFont = typeof font === 'string' ? font : DEFAULT_FONT_FAMILY;
  let attached = true;
  if (typeof font !== 'string') loadDefaultFont(api, font, () => attached);

  const hitAt = (sx: number, sy: number): Widget | null => widgetAt(hud, sx, sy);
  const hover = createHover(() => api.requestRedraw());

  const layerDeps = createLayerDeps(hud);
  const depsCtx: HudDrawCtx = { dims: { width: 0, height: 0 }, defaultFont, tokens: theme, color };
  const layer: RenderLayer<unknown> = {
    id: 'weasel-hud',
    label: 'HUD',
    space: 'screen',
    deps: (_data, _view, dims) => { depsCtx.dims = dims; return layerDeps(depsCtx); },
    draw: createLayerDraw(hud, { defaultFont, tokens: theme, color }),
    hitTest: (worldX, worldY, _data, view, _dims): LayerHit | null => {
      // Convert world to screen so we can hit-test widget bounds.
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(worldX, worldY, t);
      const hit = hitAt(sx, sy);
      if (!hit) return null;
      const cursor = cursorOf(hit, sx, sy);
      // Report WHICH widget was hit and stop there. `<SceneCanvas>` folds this
      // into its `affordanceAt` thunk, so the hit reaches actions as an
      // `AffordanceHit` of kind `layer:weasel-hud` carrying this payload.
      // Exclusive: hud chrome floats over the scene, so a press on it is not a
      // press on whatever sits underneath.
      return {
        initialScratch: { widget: hit },
        strength: 'exclusive',
        claimedKinds: claimsOf(hit),
        ...(cursor !== undefined ? { cursor } : {}),
      } satisfies LayerHit<HudHitPayload>;
    },
    onUncapturedMove: (worldX, worldY, evt, view: View) => {
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(worldX, worldY, t);
      hover.move(hitAt(sx, sy), sx, sy, evt);
    },
    onUncapturedLeave: () => { hover.leave(); },
  };

  const detachLayer = api.registerLayer(layer);
  const detachFocus = api.element ? wireFocus(api.element, hud, hitAt) : () => {};

  // registerLayer is a no-op: the HUD's one layer is registered on `api` above.
  hud.bind(canvasHost(api));

  return () => {
    attached = false;
    // Widgets outlive the attachment. Leaving one believing the pointer is
    // still over it strands it painted as hovered, and a re-attach starts
    // with nothing hovered so it never sees the leave.
    hover.clear();
    detachFocus();
    detachLayer();
    hud.unbind();
  };
}

/** The host a canvas gives its HUD: its redraw and frames, and its element's CSS pixels as the HUD's space. */
function canvasHost(api: CanvasExtensionApi): HudHost {
  return {
    requestRedraw: api.requestRedraw,
    registerLayer: () => () => {},
    subscribeFrame: api.subscribeFrame,
    toCanvas: (client) => {
      const element = api.element;
      if (!element) return { x: client.x, y: client.y };
      const [x, y] = clientToCanvas(element, client.x, client.y);
      return { x, y };
    },
    size: () => {
      const { width, height } = api.getSurfaceRect();
      return { width, height };
    },
  };
}
