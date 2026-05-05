import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from '../../core/layers/render';
import { useInsert } from '../../interactions/gestures/insert/insert';
import type { InsertAdapter } from '../../core/adapters/types';
import type { Op } from '../../core/ops/types';
import { applyHitExistingGate } from './hitExistingGate';
import { viewToTransform } from '../../features/viewport/view';
import { worldToScreen } from '../../features/viewport/viewTransform';

export interface UseTextToolOptions<TObject extends { id: string }> {
  /** Click / sub-threshold-drag insertion. Called with the cursor's world
   *  point on click and on tiny drags. Return `null` to decline (e.g. to
   *  treat the click as edit-entry on an existing object). The kit wraps
   *  the returned object in an InsertOp dispatched via `ctx.applyBatch`. */
  pointInsert: (point: { x: number; y: number }) => TObject | null;
  /** Optional drag-to-size path. When provided, dragging on the canvas
   *  draws a marquee preview and on release commits via
   *  `commitInsert(bounds)`. Sub-threshold releases fall back to
   *  `pointInsert(start)`. Omit to keep click-only behavior — no marquee,
   *  no drag handlers. */
  commitInsert?: InsertAdapter<TObject>['commitInsert'];
  /** Hit-test gate consulted before insertion. When it returns id(s), the
   *  tool selects them via `ctx.selection.set` and skips both the click
   *  and drag paths. Return `null` to fall through to insertion. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  /** Threshold below which a drag falls back to `pointInsert`. Default
   *  `{ width: 4, height: 4 }`. Ignored when `commitInsert` is omitted. */
  minBounds?: { width: number; height: number };
  /** Style for the drag-to-size marquee preview. */
  marqueeStyle?: {
    stroke?: string;
    dash?: number[];
    lineWidth?: number;
    fill?: string;
  };
}

/** Active-slot Tool: click to create a new text object at the cursor;
 *  optionally drag to size its bounding box.
 *
 *  Thin Tool veneer over `useInsert` — same gesture hook `useInsertTool`
 *  uses, just with click-path semantics enabled by `pointInsert`. When
 *  `commitInsert` is omitted the gesture hook runs in `clickOnly` mode
 *  and no drag handlers register on the Tool record. */
export function useTextTool<TObject extends { id: string }>(
  options: UseTextToolOptions<TObject>,
): Tool<undefined> {
  const { pointInsert, commitInsert, hitExisting, minBounds, marqueeStyle } = options;
  const minW = minBounds?.width ?? 4;
  const minH = minBounds?.height ?? 4;

  // The gesture hook dispatches commits via `adapter.applyBatch` (or
  // `applyOpsTo(adapter, ...)` if absent — see dispatchApplyBatch). We want
  // commits to flow through the active tool ctx's `applyBatch` so apps with
  // history integration get a checkpoint. Stash the latest ctx.applyBatch
  // in a ref before invoking the controller; the synthesized adapter's
  // applyBatch reads from it.
  const applyBatchRef = useRef<((ops: Op[], label: string) => void) | null>(null);

  const adapter = useMemo<InsertAdapter<TObject>>(() => ({
    commitInsert: (b) => (commitInsert ? commitInsert(b) : null),
    commitPaste: () => [],
    snapshotSelection: () => ({ items: [] }),
    insertObject: () => {},
    setSelection: () => {},
    getSelection: () => [],
    applyBatch: (ops, label) => {
      applyBatchRef.current?.(ops, label);
    },
  }), [commitInsert]);

  const ctl = useInsert<TObject, { x: number; y: number; width: number; height: number }>(
    adapter,
    {
      pointInsert,
      clickOnly: !commitInsert,
      minBounds: { width: minW, height: minH },
      insertLabel: 'Insert text',
    },
  );

  const styleRef = useRef(marqueeStyle);
  styleRef.current = marqueeStyle;
  const ctlRef = useRef(ctl);
  ctlRef.current = ctl;
  // Tracks whether the active drag actually started the controller (vs.
  // hitExisting short-circuiting onStart). Subsequent onMove/onEnd should
  // no-op when false so we don't dispatch a phantom commit.
  const dragActiveRef = useRef(false);

  const overlay = useMemo<RenderLayer<unknown>>(() => ({
    id: 'text-overlay',
    label: 'Text overlay',
    space: 'screen',
    draw: (ctx, _data, view) => {
      const ov = ctlRef.current.overlay;
      if (!ov) return;
      const cfg = styleRef.current ?? {};
      const stroke = cfg.stroke ?? '#a48bd4';
      const dash = cfg.dash ?? [3, 3];
      const lineWidth = cfg.lineWidth ?? 1;
      const fill = cfg.fill ?? 'rgba(164, 139, 212, 0.10)';
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
  }), []);

  return useMemo(
    () =>
      defineTool({
        id: 'text',
        keybinding: 'T',
        cursor: 'text',
        overlay: commitInsert ? overlay : undefined,
        pointer: {
          onClick: (_e, ctx) => {
            if (applyHitExistingGate(ctx, hitExisting)) return 'claim';
            applyBatchRef.current = ctx.applyBatch;
            ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            ctl.end();
            applyBatchRef.current = null;
            return 'claim';
          },
        },
        ...(commitInsert
          ? {
              drag: {
                onStart: (_e, ctx) => {
                  if (applyHitExistingGate(ctx, hitExisting)) {
                    dragActiveRef.current = false;
                    return 'claim';
                  }
                  applyBatchRef.current = ctx.applyBatch;
                  dragActiveRef.current = true;
                  ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                  return 'claim';
                },
                onMove: (_e, ctx) => {
                  if (!dragActiveRef.current) return 'claim';
                  ctl.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                  return 'claim';
                },
                onEnd: () => {
                  if (!dragActiveRef.current) return 'claim';
                  ctl.end();
                  dragActiveRef.current = false;
                  applyBatchRef.current = null;
                  return 'claim';
                },
                onCancel: () => {
                  if (!dragActiveRef.current) return;
                  ctl.cancel();
                  dragActiveRef.current = false;
                  applyBatchRef.current = null;
                },
              },
            }
          : {}),
      }),
    [ctl, commitInsert, overlay, hitExisting],
  );
}
