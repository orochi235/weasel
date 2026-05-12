import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import { useDragRadial } from 'interactions/gestures/dragRadial';
import { createInsertOp } from 'core/ops/create';
import { PolygonIcon } from '../../icons';
import type { Tool, ToolCtx } from '../types';

export interface PolygonPoint { x: number; y: number }

export interface UsePolygonToolOptions<TNode extends { id: string }> {
  create: (
    center: PolygonPoint,
    radius: number,
    rotation: number,
    sides: number,
  ) => TNode | null;
  label?: string;
  sides?: number;
  minRadius?: number;
}

const MIN_SIDES = 3;
const MAX_SIDES = 32;

/**
 * Drag-from-center polygon tool. Pointerdown sets center; drag determines
 * radius + rotation. Side count from `opts.sides` (default 6), adjustable
 * mid-gesture via ArrowUp/Down (range 3–32). Side count persists across
 * gestures (Illustrator convention).
 */
export function usePolygonTool<TNode extends { id: string }>(
  options: UsePolygonToolOptions<TNode>,
): Tool<null> {
  const { create, label = 'Insert polygon', sides: initialSides = 6, minRadius } = options;
  const createRef = useRef(create);
  createRef.current = create;
  const applyBatchRef = useRef<ToolCtx['applyBatch'] | null>(null);
  // Side count in a ref so keydown mutations are visible synchronously in
  // subsequent dr.onEnd reads. No React re-render needed.
  const sidesRef = useRef(initialSides);

  const dr = useDragRadial({
    minRadius,
    onEnd: (ctx) => {
      const applyBatch = applyBatchRef.current;
      if (!applyBatch) return false;
      if (ctx.isSubThreshold) return false;
      const node = createRef.current(
        ctx.center,
        ctx.radius,
        ctx.rotation,
        sidesRef.current,
      );
      if (!node) return false;
      applyBatch([createInsertOp({ node, label })], label);
      return true;
    },
  });

  return useMemo(
    () =>
      defineTool<null>({
        id: 'polygon',
        keybinding: { key: 'G' },
        cursor: 'crosshair',
        initScratch: () => null,
        presentation: {
          label: 'Polygon',
          group: 'shape',
          icon: <PolygonIcon />,
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
            applyBatchRef.current = ctx.applyBatch;
            dr.end();
            return 'claim';
          },
          onCancel: () => dr.cancel(),
        },
        keyboard: {
          onDown: (e) => {
            if (e.key === 'ArrowUp') {
              sidesRef.current = Math.min(MAX_SIDES, sidesRef.current + 1);
              return 'claim';
            }
            if (e.key === 'ArrowDown') {
              sidesRef.current = Math.max(MIN_SIDES, sidesRef.current - 1);
              return 'claim';
            }
            return 'pass';
          },
        },
      }),
    [dr.start, dr.move, dr.end, dr.cancel],
  );
}
