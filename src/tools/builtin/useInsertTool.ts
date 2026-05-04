import { useMemo, useRef } from 'react';
import { useInsert, type UseInsertOptions } from '../../interactions/gestures/insert/insert';
import type { InsertAdapter } from '../../core/adapters/types';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
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
}

/** Active-slot Tool wrapping `useInsert`. Declares cursor `'crosshair'`.
 *  No keybinding by default — consumer activates via
 *  `useKeybindings({ overrides: { i: 'insert' } })` or similar. */
export function useInsertTool<TObject extends { id: string }, TPose>(
  adapter: InsertAdapter<TObject>,
  options: UseInsertToolOptions<TPose, TObject> = {},
): Tool<undefined> {
  const ctl = useInsert<TObject, TPose>(adapter, options);

  const styleRef = useRef(options.overlayStyle);
  styleRef.current = options.overlayStyle;

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

  return useMemo(
    () =>
      defineTool({
        id: 'insert',
        cursor: 'crosshair',
        overlay,
        drag: {
          onStart: (_e, ctx) => {
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
    [ctl, overlay],
  );
}
