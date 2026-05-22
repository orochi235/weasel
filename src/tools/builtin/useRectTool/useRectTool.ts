import { useMemo, useRef } from 'react';
import { createElement } from 'react';
import { defineTool } from '../../routing';
import { RectIcon } from '../../../icons';
import { useDragRect } from 'interactions/gestures/dragRect';
import { createInsertOp } from 'core/ops/create';
import { marqueeDrawCommands, type InsertOverlayStyle } from '../marquee';
import type { Tool, ToolCtx } from '../../types';
import type { View } from 'core/viewport/view';

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseRectToolOptions<TNode extends { id: string }> {
  create: (bounds: RectBounds) => TNode | null;
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

/**
 * Drag-to-draw rectangle tool. The user drags a rect; on release the `create`
 * factory is called with the final bounds and the returned object is inserted
 * into the scene via an undoable op.
 *
 * Role model for tools that create scene objects: uses `ctx.applyOps` +
 * `createInsertOp` directly rather than routing through adapter.commitInsert.
 */
export function useRectTool<TNode extends { id: string }>(
  options: UseRectToolOptions<TNode>,
): Tool<null> {
  const { create, label = 'Insert rectangle', minBounds, overlayStyle, snapPoint } = options;

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
      id: 'rect-tool-overlay',
      label: 'Rect preview',
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
        id: 'rect',
        hookName: 'useRectTool',
        keybinding: { key: 'R' },
        cursor: 'crosshair',
        presentation: {
          label: 'Rectangle',
          icon: createElement(RectIcon),
          group: 'shape',
        },
        // Declarative binding routes empty-space drags through the new
        // dispatcher + insertAction. The legacy route-table drag channel
        // has been removed alongside `Tool.bindingsOverrideDrag`.
        bindings: [
          // Single binding; insertAction toggles corner ⇄ center based on
          // live Alt state so users can engage/disengage Alt mid-drag and
          // see the bounds snap between the two modes.
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { params: { kind: 'rect' } },
          },
        ],
        initial: {
          overlay: () => overlay,
        },
      }),
    [dr.start, dr.move, dr.end, dr.cancel, overlay],
  );
}
