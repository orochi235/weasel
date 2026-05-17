import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool, claim, none } from '../../routing';
import { useDragRadial } from 'interactions/gestures/dragRadial';
import { createInsertOp } from 'core/ops/create';
import { PolygonIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../../renderer';
import type { Tool, ToolCtx } from '../../types';

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
  /** Optional: snap world-space points to the active grid (or any other
   *  snap target). Applied to both the center (on pointerdown) and the
   *  live cursor — so the radius/rotation derived from `current - center`
   *  lands on grid in both the live overlay and the committed geometry. */
  snapPoint?: (p: PolygonPoint) => PolygonPoint;
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
  const { create, label = 'Insert polygon', sides: initialSides = 6, minRadius, snapPoint } = options;
  const createRef = useRef(create);
  createRef.current = create;
  const applyOpsRef = useRef<ToolCtx['applyOps'] | null>(null);
  const snapPointRef = useRef(snapPoint);
  snapPointRef.current = snapPoint;
  // Side count in a ref so keydown / wheel mutations are visible
  // synchronously in subsequent dr.onEnd reads. A useState tick alongside
  // forces the overlay layer to redraw when the count changes between
  // pointer events (e.g. user wheels without moving the cursor).
  const sidesRef = useRef(initialSides);
  const [, setSidesTick] = useState(0);
  const bumpSides = useCallback(() => setSidesTick((n) => n + 1), []);

  const dr = useDragRadial({
    minRadius,
    snapPoint: (p) => snapPointRef.current?.(p) ?? p,
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
        presentation: {
          label: 'Polygon',
          group: 'shape',
          icon: <PolygonIcon />,
        },
        // Phase 14c.1: declarative binding routes empty-space drags through the
        // new dispatcher + insertAction. bindingsOverrideDrag suppresses the
        // legacy drag channel in the dispatcher; the route-table entry below
        // is retained as dead code until Phase 14e removes it.
        bindings: [
          {
            spec: { kind: 'drag', target: 'empty' },
            actionId: 'insert',
            // Phase 14c.3: thunked params re-evaluated at commit time so
            // mid-gesture ArrowUp/Down side-count changes are reflected
            // in the inserted polygon's geometry.
            opts: {
              params: () => ({
                kind: 'polygon',
                sides: sidesRef.current,
                rotation: 0,
              }),
            },
          },
        ],
        initial: {
          overlay: () => overlay,
          keyDown: {
            ArrowUp: () => {
              sidesRef.current = Math.min(MAX_SIDES, sidesRef.current + 1);
              bumpSides();
              return claim();
            },
            ArrowDown: () => {
              sidesRef.current = Math.max(MIN_SIDES, sidesRef.current - 1);
              bumpSides();
              return claim();
            },
          },
          // Adjust side count via mousewheel only while a gesture is in
          // flight; otherwise pass so view-zoom / pan tools can claim.
          // Convention: wheel up (deltaY < 0) adds a side, wheel down
          // removes one. Each wheel tick is one increment regardless of
          // delta magnitude — feels Illustrator-y.
          wheel: (_ctx, event) => {
            if (!drRef.current.isActive) return none();
            const e = event as WheelEvent | undefined;
            if (!e || e.deltaY === 0) return none();
            if (e.deltaY < 0) {
              sidesRef.current = Math.min(MAX_SIDES, sidesRef.current + 1);
            } else {
              sidesRef.current = Math.max(MIN_SIDES, sidesRef.current - 1);
            }
            bumpSides();
            return claim();
          },
        },
      }),
    [dr.start, dr.move, dr.end, dr.cancel, overlay, bumpSides],
  );
}
