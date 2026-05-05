import { useMemo, useRef } from 'react';
import { useInsert, type UseInsertOptions } from '../../interactions/gestures/insert/insert';
import type { InsertAdapter } from '../../core/adapters/types';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import { applyHitExistingGate } from './hitExistingGate';
import { viewToTransform } from '../../features/viewport/view';
import { worldToScreen } from '../../features/viewport/viewTransform';
import type { RenderLayer } from '../../core/layers/render';

export interface InsertOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

export interface UseInsertToolOptions<TPose, TObject extends { id: string } = { id: string }>
  extends UseInsertOptions<TPose, TObject> {
  overlayStyle?: InsertOverlayStyle;
  /** Hit-test gate consulted before insertion. On hit, selects via
   *  ctx.selection.set and skips both the click and drag paths. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
}

/** Active-slot Tool wrapping `useInsert`. Declares cursor `'crosshair'`.
 *  No keybinding by default — consumer activates via
 *  `useKeybindings({ overrides: { i: 'insert' } })` or similar. */
export function useInsertTool<TObject extends { id: string }, TPose>(
  adapter: InsertAdapter<TObject>,
  options: UseInsertToolOptions<TPose, TObject> = {},
): Tool<undefined> {
  const { hitExisting, overlayStyle, ...gestureOptions } = options;
  const ctl = useInsert<TObject, TPose>(adapter, gestureOptions);

  const styleRef = useRef(overlayStyle);
  styleRef.current = overlayStyle;

  const overlay = useMemo<RenderLayer<unknown>>(() => ({
    id: 'insert-overlay',
    label: 'Insert overlay',
    space: 'screen',
    draw: (ctx, _data, view) => {
      const ov = ctl.overlay;
      if (!ov) return;
      const cfg = styleRef.current ?? {};
      const fill = cfg.fill ?? 'rgba(127, 176, 105, 0.25)';
      const stroke = cfg.stroke ?? '#7fb069';
      const dash = cfg.dash ?? [4, 4];
      const lineWidth = cfg.lineWidth ?? 1;
      const t = viewToTransform(view);
      const { x, y, width: w, height: h } = ov.bounds;
      const [sx, sy] = worldToScreen(x, y, t);
      const sw = w * view.scale;
      const sh = h * view.scale;
      ctx.save();
      ctx.fillStyle = fill;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);
      ctx.restore();
    },
  }), [ctl]);

  const hasPointInsert = !!gestureOptions.pointInsert;

  return useMemo(
    () =>
      defineTool({
        id: 'insert',
        cursor: 'crosshair',
        overlay,
        // Dispatch routes through the consumer-supplied adapter (gesture hook calls
        // adapter.applyBatch / falls back to applyOpsTo). Unlike useTextTool, which
        // synthesizes its own adapter and must capture ctx.applyBatch into a ref,
        // useInsertTool's consumer owns the adapter and wires history themselves.
        ...(hasPointInsert
          ? {
              pointer: {
                onClick: (_e, ctx) => {
                  if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
                  ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                  ctl.end();
                  return 'claim';
                },
              },
            }
          : {}),
        drag: {
          onStart: (_e, ctx) => {
            if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
            ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onMove: (_e, ctx) => {
            ctl.move(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onEnd: () => {
            ctl.end();
            return 'claim';
          },
          onCancel: () => {
            ctl.cancel();
          },
        },
      }),
    [ctl, overlay, hasPointInsert, hitExisting],
  );
}
