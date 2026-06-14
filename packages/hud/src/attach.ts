import type { Hud } from './hud';
import type { CanvasExtensionApi } from '../../../src/canvas/canvasExtension';
import type { RenderLayer } from '../../../src/core/layers/render';
import type { DrawCommand } from '../../../src/renderer';
import type { AffordanceBinding } from '../../../src/affordances/types';
import type { DragChannel } from '../../../src/tools/types';
import type { View } from '../../../src/core/viewport/view';
import { viewToTransform } from '../../../src/core/viewport/view';
import { worldToScreen } from '../../../src/core/viewport/viewTransform';
import { DEFAULT_FONT_FAMILY, registerDefaultFont } from './fonts/registerDefaultFont';
import type { Widget, HudPointerEvent } from './widget';
import { readTokens } from './theme';

interface HudDragScratch {
  widget: Widget;
}

export function attachHud(api: CanvasExtensionApi, hud: Hud): () => void {
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
    draw: (_data, _view, dims): DrawCommand[] => {
      const ctx = { dims, defaultFont: DEFAULT_FONT_FAMILY, tokens: readTokens(api.element) };
      const out: DrawCommand[] = [];
      for (const w of hud.widgets()) {
        if (w.hidden) continue;
        for (const cmd of w.draw(ctx)) out.push(cmd);
      }
      return out;
    },
    hitTest: (worldX, worldY, _data, view, _dims): AffordanceBinding | null => {
      // Convert world to screen so we can hit-test widget bounds.
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(worldX, worldY, t);
      const hit = findTopmostHit(sx, sy);
      if (!hit) return null;

      // Build a drag channel that routes events into hit.onPointer.
      // The dispatcher calls onStart immediately on hit, then onMove on each
      // pointermove, onEnd on pointerup, onCancel on pointercancel.
      const drag: DragChannel<HudDragScratch> = {
        onStart: (e, ctx) => {
          const [ex, ey] = worldToScreen(ctx.worldX, ctx.worldY, viewToTransform(ctx.view));
          ctx.scratch.widget.onPointer({ type: 'down', x: ex, y: ey, native: e } satisfies HudPointerEvent);
          return 'claim';
        },
        onMove: (e, ctx) => {
          const [ex, ey] = worldToScreen(ctx.worldX, ctx.worldY, viewToTransform(ctx.view));
          ctx.scratch.widget.onPointer({ type: 'move', x: ex, y: ey, native: e } satisfies HudPointerEvent);
          return 'claim';
        },
        onEnd: (e, ctx) => {
          const [ex, ey] = worldToScreen(ctx.worldX, ctx.worldY, viewToTransform(ctx.view));
          ctx.scratch.widget.onPointer({ type: 'up', x: ex, y: ey, native: e } satisfies HudPointerEvent);
          return 'claim';
        },
        onCancel: (ctx) => {
          // No native event available in onCancel — pass a stub. Widget
          // implementations must accept this case (the protocol type allows it).
          ctx.scratch.widget.onPointer({ type: 'cancel', native: new Event('pointercancel') as PointerEvent } satisfies HudPointerEvent);
        },
      };

      const result: AffordanceBinding<HudDragScratch> = {
        drag,
        initialScratch: { widget: hit },
      };
      return result as AffordanceBinding;
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
