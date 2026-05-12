import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import { useDragRect } from 'interactions/gestures/dragRect';
import { createInsertOp } from 'core/ops/create';
import { marqueeDrawCommands, type InsertOverlayStyle } from './marquee';
import { EllipseIcon } from '../../icons';
import type { Tool, ToolCtx } from '../types';
import type { View } from 'core/viewport/view';

export interface EllipseBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseEllipseToolOptions<TNode extends { id: string }> {
  create: (bounds: EllipseBounds) => TNode | null;
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
 * Drag-to-draw ellipse tool. The `create` factory receives the bounding
 * rect and returns the node to insert (consumer-defined shape — the kit
 * doesn't impose an ellipse geometry encoding here). Mirrors `useRectTool`.
 */
export function useEllipseTool<TNode extends { id: string }>(
  options: UseEllipseToolOptions<TNode>,
): Tool<null> {
  const { create, label = 'Insert ellipse', minBounds, overlayStyle } = options;

  const createRef = useRef(create);
  createRef.current = create;
  const applyOpsRef = useRef<ToolCtx['applyOps'] | null>(null);
  const overlayStyleRef = useRef(overlayStyle);
  overlayStyleRef.current = overlayStyle;

  const dr = useDragRect({
    minBounds,
    onEnd: (ctx) => {
      const applyOps = applyOpsRef.current;
      if (!applyOps) return false;
      if (ctx.isSubThreshold) return false;
      const node = createRef.current(ctx.bounds);
      if (!node) return false;
      applyOps([createInsertOp({ node, label })], label);
      return true;
    },
  });

  const drRef = useRef(dr);
  drRef.current = dr;

  const overlay = useMemo(
    () => ({
      id: 'ellipse-tool-overlay',
      label: 'Ellipse preview',
      space: 'screen' as const,
      draw: (_data: unknown, view: View) => {
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
        id: 'ellipse',
        keybinding: { key: 'E' },
        cursor: 'crosshair',
        initScratch: () => null,
        presentation: {
          label: 'Ellipse',
          group: 'shape',
          icon: <EllipseIcon />,
        },
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
            applyOpsRef.current = ctx.applyOps;
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
