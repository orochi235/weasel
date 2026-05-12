import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import { useDragRadial } from 'interactions/gestures/dragRadial';
import { createInsertOp } from 'core/ops/create';
import { StarIcon } from '../../icons';
import type { Tool, ToolCtx } from '../types';

export interface StarPoint { x: number; y: number }

export interface UseStarToolOptions<TNode extends { id: string }> {
  create: (
    center: StarPoint,
    outerRadius: number,
    innerRadius: number,
    rotation: number,
    points: number,
  ) => TNode | null;
  label?: string;
  points?: number;
  innerRatio?: number;
  minRadius?: number;
}

const MIN_POINTS = 3;
const MAX_POINTS = 32;

/**
 * Drag-from-center star tool. Outer radius = drag radius;
 * inner radius = outer × `innerRatio` (default 0.5). Points default 5,
 * adjustable via ArrowUp/Down (range 3–32). No default keybinding —
 * consumers can bind via the existing keybindings mechanism.
 */
export function useStarTool<TNode extends { id: string }>(
  options: UseStarToolOptions<TNode>,
): Tool<null> {
  const {
    create,
    label = 'Insert star',
    points: initialPoints = 5,
    innerRatio: initialInnerRatio = 0.5,
    minRadius,
  } = options;
  const createRef = useRef(create);
  createRef.current = create;
  const applyBatchRef = useRef<ToolCtx['applyBatch'] | null>(null);
  // Refs (not React state) so keydown mutations are visible synchronously
  // in subsequent dr.onEnd reads.
  const pointsRef = useRef(initialPoints);
  const innerRatioRef = useRef(initialInnerRatio);

  const dr = useDragRadial({
    minRadius,
    onEnd: (ctx) => {
      const applyBatch = applyBatchRef.current;
      if (!applyBatch) return false;
      if (ctx.isSubThreshold) return false;
      const node = createRef.current(
        ctx.center,
        ctx.radius,
        ctx.radius * innerRatioRef.current,
        ctx.rotation,
        pointsRef.current,
      );
      if (!node) return false;
      applyBatch([createInsertOp({ node, label })], label);
      return true;
    },
  });

  return useMemo(
    () =>
      defineTool<null>({
        id: 'star',
        cursor: 'crosshair',
        initScratch: () => null,
        presentation: {
          label: 'Star',
          group: 'shape',
          icon: <StarIcon />,
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
              pointsRef.current = Math.min(MAX_POINTS, pointsRef.current + 1);
              return 'claim';
            }
            if (e.key === 'ArrowDown') {
              pointsRef.current = Math.max(MIN_POINTS, pointsRef.current - 1);
              return 'claim';
            }
            return 'pass';
          },
        },
      }),
    [dr.start, dr.move, dr.end, dr.cancel],
  );
}
