import type { Hud } from './hud';
import type { CanvasExtensionApi, RenderLayer, LayerHit, View } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { viewToTransform } from '@weasel-js/core';
import { worldToScreen } from '@weasel-js/core';
import { DEFAULT_FONT_FAMILY, registerDefaultFont } from './fonts/registerDefaultFont';
import type { Widget, HudPointerEvent } from './widget';
import type { HudHitPayload } from './tool';
import { resolveTheme, weaselTheme, type ResolvedTheme } from '@weasel-js/theme';

export interface AttachHudOptions {
  /** Resolved theme the widgets draw with. Defaults to the built-in theme's
   *  default mode; pass `useTheme().resolved` to follow a live theme. */
  readonly theme?: ResolvedTheme;
}

export function attachHud(
  api: CanvasExtensionApi,
  hud: Hud,
  options: AttachHudOptions = {},
): () => void {
  const theme = options.theme ?? resolveTheme(weaselTheme, weaselTheme.defaultMode);
  if (hud.attached) {
    throw new Error('weasel-hud: this HUD is already attached to a canvas.');
  }

  // Kick off default-font registration. Widgets that draw text before this
  // resolves render via the renderer's existing fallback (warn + skip).
  registerDefaultFont()
    .then(() => api.requestRedraw())
    .catch((err) => {
      console.warn('weasel-hud: failed to register default font', err);
    });

  // Track the currently-hovered widget at the closure level.
  let lastHovered: Widget | null = null;

  const findTopmostHit = (sx: number, sy: number): Widget | null => {
    const list = hud.widgets();
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      if (!w.hidden && w.hitTest(sx, sy)) return w;
    }
    return null;
  };

  const layer: RenderLayer<unknown> = {
    id: 'weasel-hud',
    label: 'HUD',
    space: 'screen',
    draw: (data, view, dims): DrawCommand[] => {
      const ctx = { dims, defaultFont: DEFAULT_FONT_FAMILY, tokens: theme };
      const out: DrawCommand[] = [];
      // Pass 1: interiors. All content precedes all frames so one window's
      // content can never paint over another window's border.
      for (const w of hud.widgets()) {
        if (w.hidden || !w.content || !w.contentRect) continue;
        const rect = w.contentRect;
        if (rect.w <= 0 || rect.h <= 0) continue;
        const children = w.content({
          data, view, dims, rect, defaultFont: DEFAULT_FONT_FAMILY, tokens: theme,
        });
        if (children.length === 0) continue;
        out.push({
          kind: 'group',
          clip: { kind: 'rect', x: rect.x, y: rect.y, width: rect.w, height: rect.h },
          children,
        });
      }
      // Pass 2: frames.
      for (const w of hud.widgets()) {
        if (w.hidden) continue;
        for (const cmd of w.draw(ctx)) out.push(cmd);
      }
      return out;
    },
    hitTest: (worldX, worldY, _data, view, _dims): LayerHit | null => {
      // Convert world to screen so we can hit-test widget bounds.
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(worldX, worldY, t);
      const hit = findTopmostHit(sx, sy);
      if (!hit) return null;
      // Report WHICH widget was hit and stop there. `<SceneCanvas>` folds this
      // into its `affordanceAt` thunk, so the hit reaches actions as an
      // `AffordanceHit` of kind `layer:weasel-hud` carrying this payload; the
      // `hud.pointer` action (see `tool.ts`) picks it up from there.
      //
      // This used to return a `DragChannel` for the tool-routing dispatcher to
      // drive directly. That dispatcher is gone, and a hit-test handing back
      // event handlers was always an odd shape — a hit-test should say what
      // was hit.
      // Exclusive: hud chrome floats over the scene, so a press on it is not a
      // press on whatever sits underneath. Bindings that don't consult the
      // affordance are barred from it by the dispatcher.
      return {
        initialScratch: { widget: hit },
        strength: 'exclusive',
        ...(hit.cursorAt ? { cursor: hit.cursorAt(sx, sy) } : {}),
      } satisfies LayerHit<HudHitPayload>;
    },
    onUncapturedMove: (worldX, worldY, evt, view: View) => {
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(worldX, worldY, t);
      const hit = findTopmostHit(sx, sy);
      if (hit !== lastHovered) {
        if (lastHovered) lastHovered.onPointer({ type: 'hoverleave', native: evt } satisfies HudPointerEvent);
        if (hit) hit.onPointer({ type: 'hovermove', x: sx, y: sy, native: evt } satisfies HudPointerEvent);
        lastHovered = hit;
        api.requestRedraw();
      }
    },
    onUncapturedLeave: () => {
      if (lastHovered) {
        lastHovered.onPointer({ type: 'hoverleave', native: null } satisfies HudPointerEvent);
        lastHovered = null;
        api.requestRedraw();
      }
    },
  };

  const detachLayer = api.registerLayer(layer);

  // Bind the HUD to a host shim. The HUD only uses requestRedraw and
  // registerLayer in v1; provide registerLayer as a no-op since the HUD has
  // already registered its single layer via api.registerLayer above.
  hud.bind({
    requestRedraw: api.requestRedraw,
    registerLayer: () => () => {},
  });

  return () => {
    detachLayer();
    hud.unbind();
  };
}
