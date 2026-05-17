import { useMemo, useRef } from 'react';
import { defineTool } from '../../routing';
import { useDragRect } from 'interactions/gestures/dragRect';
import { createInsertOp } from 'core/ops/create';
import { type InsertOverlayStyle } from '../marquee';
import { EllipseIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../../renderer';
import type { Tool, ToolCtx } from '../../types';

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
  /** Optional: snap world-space points to the active grid (or any other
   *  snap target). Applied to every coord the gesture ingests, so both the
   *  live overlay and the committed geometry use the snapped values. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
}

const DEFAULT_STYLE = {
  fill: 'rgba(127, 176, 105, 0.25)',
  stroke: '#7fb069',
  dash: [4, 4] as number[],
  lineWidth: 1,
};

/** Magic-number for the cubic-Bezier approximation of a circular quadrant —
 *  the canonical "kappa". Gives <1% max error vs. a true circle. */
const ELLIPSE_KAPPA = 0.5522847498307936;

/**
 * Drag-to-draw ellipse tool. The `create` factory receives the bounding
 * rect and returns the node to insert (consumer-defined shape — the kit
 * doesn't impose an ellipse geometry encoding here). Mirrors `useRectTool`.
 */
export function useEllipseTool<TNode extends { id: string }>(
  options: UseEllipseToolOptions<TNode>,
): Tool<null> {
  const { create, label = 'Insert ellipse', minBounds, overlayStyle, snapPoint } = options;

  const createRef = useRef(create);
  createRef.current = create;
  const applyOpsRef = useRef<ToolCtx['applyOps'] | null>(null);
  const overlayStyleRef = useRef(overlayStyle);
  overlayStyleRef.current = overlayStyle;
  const snapPointRef = useRef(snapPoint);
  snapPointRef.current = snapPoint;

  const dr = useDragRect({
    minBounds,
    snapPoint: (p) => snapPointRef.current?.(p) ?? p,
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

  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'ellipse-tool-overlay',
      label: 'Ellipse preview',
      space: 'screen' as const,
      draw: (_data: unknown, view: View): DrawCommand[] => {
        const ov = drRef.current.overlay;
        if (!ov) return [];
        const { bounds } = ov;
        if (bounds.width === 0 || bounds.height === 0) return [];
        const style = overlayStyleRef.current;
        const stroke = style?.stroke ?? DEFAULT_STYLE.stroke;
        const dash = style?.dash ?? DEFAULT_STYLE.dash;
        const lineWidth = style?.lineWidth ?? DEFAULT_STYLE.lineWidth;
        const t = viewToTransform(view);
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const rx = bounds.width / 2;
        const ry = bounds.height / 2;
        const ox = rx * ELLIPSE_KAPPA;
        const oy = ry * ELLIPSE_KAPPA;
        // Emit the same 4-cubic-Bezier ellipse approximation consumers use
        // for their committed geometry — preview matches output exactly.
        const ws: Array<[number, number]> = [
          [cx + rx, cy],
          [cx + rx, cy + oy], [cx + ox, cy + ry], [cx, cy + ry],
          [cx - ox, cy + ry], [cx - rx, cy + oy], [cx - rx, cy],
          [cx - rx, cy - oy], [cx - ox, cy - ry], [cx, cy - ry],
          [cx + ox, cy - ry], [cx + rx, cy - oy], [cx + rx, cy],
        ];
        const s = ws.map(([wx, wy]) => worldToScreen(wx, wy, t));
        const b = new PathBuilder();
        b.moveTo(s[0][0], s[0][1]);
        b.curveTo(s[1][0], s[1][1], s[2][0], s[2][1], s[3][0], s[3][1]);
        b.curveTo(s[4][0], s[4][1], s[5][0], s[5][1], s[6][0], s[6][1]);
        b.curveTo(s[7][0], s[7][1], s[8][0], s[8][1], s[9][0], s[9][1]);
        b.curveTo(s[10][0], s[10][1], s[11][0], s[11][1], s[12][0], s[12][1]);
        b.close();
        return [{
          kind: 'path',
          path: b.build(),
          stroke: { paint: { color: stroke }, width: lineWidth, dash },
        }];
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
        presentation: {
          label: 'Ellipse',
          group: 'shape',
          icon: <EllipseIcon />,
        },
        // Phase 14c.1: declarative binding routes empty-space drags through the
        // new dispatcher + insertAction. bindingsOverrideDrag suppresses the
        // legacy drag channel in the dispatcher; the route-table entry below
        // is retained as dead code until Phase 14e removes it.
        bindings: [
          {
            spec: { kind: 'drag', target: 'empty' },
            actionId: 'insert',
            opts: { params: { kind: 'ellipse' } },
          },
        ],
        initial: {
          overlay: () => overlay,
        },
      }),
    [dr.start, dr.move, dr.end, dr.cancel, overlay],
  );
}
