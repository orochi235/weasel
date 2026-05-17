import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool, begin, claim, none } from '../../routing';
import { useDragRadial } from 'interactions/gestures/dragRadial';
import { createInsertOp } from 'core/ops/create';
import { StarIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../../renderer';
import type { Tool, ToolCtx } from '../../types';

/** Default screen-space chrome for the drag-ghost overlay. */
const GHOST_STROKE = '#7fb069';
const GHOST_LINE_WIDTH = 1;
const GHOST_DASH: number[] = [4, 4];

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
  /** Optional: snap world-space points to the active grid (or any other
   *  snap target). Applied to both the center (on pointerdown) and the
   *  live cursor — so the radius/rotation derived from `current - center`
   *  lands on grid in both the live overlay and the committed geometry. */
  snapPoint?: (p: StarPoint) => StarPoint;
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
    snapPoint,
  } = options;
  const createRef = useRef(create);
  createRef.current = create;
  const applyOpsRef = useRef<ToolCtx['applyOps'] | null>(null);
  const snapPointRef = useRef(snapPoint);
  snapPointRef.current = snapPoint;
  // Refs (not React state) so keydown / wheel mutations are visible
  // synchronously in subsequent dr.onEnd reads. A useState tick alongside
  // forces the overlay layer to redraw when the count changes between
  // pointer events (e.g. user wheels without moving the cursor).
  const pointsRef = useRef(initialPoints);
  const innerRatioRef = useRef(initialInnerRatio);
  const [, setPointsTick] = useState(0);
  const bumpPoints = useCallback(() => setPointsTick((n) => n + 1), []);

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
        ctx.radius * innerRatioRef.current,
        ctx.rotation,
        pointsRef.current,
      );
      if (!node) return false;
      applyOps([createInsertOp({ node, label })], label);
      return true;
    },
  });

  // drRef keeps the overlay closure on a stable reference; React re-renders
  // (triggered by useDragRadial's internal setOverlay) make `dr` itself
  // change identity but the ref always points at the latest controller.
  const drRef = useRef(dr);
  drRef.current = dr;

  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'star-tool-overlay',
      label: 'Star preview',
      space: 'screen' as const,
      draw: (_data: unknown, view: View): DrawCommand[] => {
        const ov = drRef.current.overlay;
        if (!ov || ov.radius === 0) return [];
        const t = viewToTransform(view);
        const points = pointsRef.current;
        const innerRatio = innerRatioRef.current;
        const n = points * 2;
        const b = new PathBuilder();
        for (let i = 0; i < n; i++) {
          const r = i % 2 === 0 ? ov.radius : ov.radius * innerRatio;
          const angle = ov.rotation + (i / n) * Math.PI * 2;
          const wx = ov.center.x + r * Math.cos(angle);
          const wy = ov.center.y + r * Math.sin(angle);
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
        id: 'star',
        cursor: 'crosshair',
        presentation: {
          label: 'Star',
          group: 'shape',
          icon: <StarIcon />,
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
            // mid-gesture point-count / ratio changes flow through.
            opts: {
              params: () => ({
                kind: 'star',
                points: pointsRef.current,
                innerRadiusRatio: innerRatioRef.current,
                rotation: 0,
              }),
            },
          },
        ],
        bindingsOverrideDrag: true,
        initial: {
          overlay: () => overlay,
          drag: (ctx) => {
            dr.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            return begin<null>({
              scratch: null,
              onMove: (c) => {
                dr.move(c.worldX, c.worldY, c.modifiers);
                return claim();
              },
              onRelease: (c) => {
                applyOpsRef.current = c.applyOps;
                dr.end();
                return claim();
              },
              onCancel: () => {
                dr.cancel();
              },
            });
          },
          keyDown: {
            ArrowUp: () => {
              pointsRef.current = Math.min(MAX_POINTS, pointsRef.current + 1);
              bumpPoints();
              return claim();
            },
            ArrowDown: () => {
              pointsRef.current = Math.max(MIN_POINTS, pointsRef.current - 1);
              bumpPoints();
              return claim();
            },
          },
          // Mousewheel mid-drag adjusts the point count. Idle wheels pass
          // through to view zoom / other ambient tools.
          wheel: (_ctx, event) => {
            if (!drRef.current.isActive) return none();
            const e = event as WheelEvent | undefined;
            if (!e || e.deltaY === 0) return none();
            if (e.deltaY < 0) {
              pointsRef.current = Math.min(MAX_POINTS, pointsRef.current + 1);
            } else {
              pointsRef.current = Math.max(MIN_POINTS, pointsRef.current - 1);
            }
            bumpPoints();
            return claim();
          },
        },
      }),
    [dr.start, dr.move, dr.end, dr.cancel, overlay, bumpPoints],
  );
}
