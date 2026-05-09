import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import { useDragRect } from '../../interactions/gestures/dragRect';
import { createInsertOp } from '../../core/ops/create';
import { drawMarquee, marqueeDrawCommands, type InsertOverlayStyle } from './marquee';
import type { Tool, ToolCtx } from '../types';
import type { View } from '../../features/viewport/view';

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseRectToolOptions<TObject extends { id: string }> {
  create: (bounds: RectBounds) => TObject | null;
  label?: string;
  minBounds?: { width: number; height: number };
  overlayStyle?: InsertOverlayStyle;
}

const DEFAULT_STYLE = {
  fill: 'rgba(127, 176, 105, 0.25)',
  stroke: '#7fb069',
  dash: [4, 4] as number[],
  lineWidth: 1,
};

/**
 * Drag-to-draw rectangle tool. The user drags a rect; on release the `create`
 * factory is called with the final bounds and the returned object is inserted
 * into the scene via an undoable op.
 *
 * Role model for tools that create scene objects: uses `ctx.applyBatch` +
 * `createInsertOp` directly rather than routing through adapter.commitInsert.
 */
export function useRectTool<TObject extends { id: string }>(
  options: UseRectToolOptions<TObject>,
): Tool<null> {
  const { create, label = 'Insert rectangle', minBounds, overlayStyle } = options;

  const createRef = useRef(create);
  createRef.current = create;
  const applyBatchRef = useRef<ToolCtx['applyBatch'] | null>(null);
  const overlayStyleRef = useRef(overlayStyle);
  overlayStyleRef.current = overlayStyle;

  const dr = useDragRect({
    minBounds,
    onEnd: (ctx) => {
      const applyBatch = applyBatchRef.current;
      if (!applyBatch) return false;
      const object = createRef.current(ctx.bounds);
      if (!object) return false;
      applyBatch([createInsertOp({ object, label })], label);
      return true;
    },
  });

  const drRef = useRef(dr);
  drRef.current = dr;

  const overlay = useMemo(
    () => ({
      id: 'rect-tool-overlay',
      label: 'Rect preview',
      space: 'screen' as const,
      draw: (ctx: CanvasRenderingContext2D, _data: unknown, view: View) => {
        const ov = drRef.current.overlay;
        if (!ov) return;
        drawMarquee(ctx, view, ov.bounds, overlayStyleRef.current, DEFAULT_STYLE);
      },
      drawGL: (_data: unknown, view: View) => {
        const ov = drRef.current.overlay;
        if (!ov) return [];
        return marqueeDrawCommands(view, ov.bounds, overlayStyleRef.current, DEFAULT_STYLE);
      },
    }),
    [],
  );

  return useMemo(
    () =>
      defineTool<null>({
        id: 'rect',
        keybinding: 'R',
        cursor: 'crosshair',
        initScratch: () => null,
        drag: {
          onStart: (_e, ctx) => {
            dr.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onMove: (_e, ctx) => {
            dr.move(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onEnd: (_e, ctx) => {
            applyBatchRef.current = ctx.applyBatch;
            dr.end();
            return 'claim';
          },
          onCancel: () => {
            dr.cancel();
          },
        },
        overlay,
      }),
    [dr.start, dr.move, dr.end, dr.cancel, overlay],
  );
}
