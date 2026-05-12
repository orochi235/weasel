import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import { useDragRadial } from 'interactions/gestures/dragRadial';
import { createInsertOp } from 'core/ops/create';
import { PolygonIcon } from '../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../renderer';
import type { Tool, ToolCtx } from '../types';

const GHOST_STROKE = '#7fb069';
const GHOST_LINE_WIDTH = 1;
const GHOST_DASH: number[] = [4, 4];

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
  const applyOpsRef = useRef<ToolCtx['applyOps'] | null>(null);
  // Side count in a ref so keydown mutations are visible synchronously in
  // subsequent dr.onEnd reads. No React re-render needed.
  const sidesRef = useRef(initialSides);

  const dr = useDragRadial({
    minRadius,
    onEnd: (ctx) => {
      const applyOps = applyOpsRef.current;
      if (!applyOps) return false;
      if (ctx.isSubThreshold) return false;
      const node = createRef.current(
        ctx.center,
        ctx.radius,
        ctx.rotation,
        sidesRef.current,
      );
      if (!node) return false;
      applyOps([createInsertOp({ node, label })], label);
      return true;
    },
  });

  const drRef = useRef(dr);
  drRef.current = dr;

  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'polygon-tool-overlay',
      label: 'Polygon preview',
      space: 'screen' as const,
      draw: (_data: unknown, view: View): DrawCommand[] => {
        const ov = drRef.current.overlay;
        if (!ov || ov.radius === 0) return [];
        const t = viewToTransform(view);
        const sides = sidesRef.current;
        const b = new PathBuilder();
        for (let i = 0; i < sides; i++) {
          const angle = ov.rotation + (i / sides) * Math.PI * 2;
          const wx = ov.center.x + ov.radius * Math.cos(angle);
          const wy = ov.center.y + ov.radius * Math.sin(angle);
          const [sx, sy] = worldToScreen(wx, wy, t);
          if (i === 0) b.moveTo(sx, sy); else b.lineTo(sx, sy);
        }
        b.close();
        return [{
          kind: 'path',
          path: b.build(),
          stroke: { paint: { color: GHOST_STROKE }, width: GHOST_LINE_WIDTH, dash: GHOST_DASH },
        }];
      },
    }),
    [],
  );

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
            applyOpsRef.current = ctx.applyOps;
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
        overlay,
      }),
    [dr.start, dr.move, dr.end, dr.cancel, overlay],
  );
}
