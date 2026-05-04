import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from '../../core/layers/render';
import { createInsertOp } from '../../core/ops/create';
import { viewToTransform } from '../../features/viewport/view';
import { worldToScreen } from '../../features/viewport/viewTransform';

export interface UseTextToolOptions<TObject extends { id: string }> {
  /** Build a new text object at the clicked world point. Return `null` to
   *  decline (e.g. clicked on an existing object the consumer would rather
   *  treat as edit-entry). The kit wraps the returned object in an InsertOp
   *  and dispatches it via `ctx.applyBatch`. */
  commitInsert: (point: { worldX: number; worldY: number }) => TObject | null;
  /** Optional drag-to-size path. When provided, dragging on the canvas
   *  draws a marquee preview and on release commits a text object whose
   *  pose is the marquee's bounds. If the drag never crosses `minBounds`
   *  the tool falls back to `commitInsert(start)` so a quick click-drag
   *  still inserts at the cursor. Omit this option to keep click-only
   *  behavior. */
  commitInsertBounds?: (bounds: { x: number; y: number; width: number; height: number }) => TObject | null;
  /** Minimum marquee size before `commitInsertBounds` runs (otherwise the
   *  click fallback takes over). Default `{ width: 4, height: 4 }`. */
  minBounds?: { width?: number; height?: number };
  /** Style for the drag-to-size marquee preview. */
  marqueeStyle?: {
    stroke?: string;
    dash?: number[];
    lineWidth?: number;
    fill?: string;
  };
  /** Optional hit-test consulted before insertion. When it returns an id
   *  (or array of ids), the tool selects those objects via `ctx.selection.set`
   *  instead of inserting — so clicking an existing text object selects it
   *  rather than stamping a new one on top. Applies to both the click path
   *  and the drag-start point of the bounds path. Return `null` to fall
   *  through to insertion. */
  hitExisting?: (point: { worldX: number; worldY: number }) => string | string[] | null;
}

type TextScratch =
  | { kind: 'idle' }
  | { kind: 'drag'; startX: number; startY: number; curX: number; curY: number };

/** Active-slot Tool: click to create a new text object at the cursor;
 *  optionally drag to size its bounding box.
 *
 *  When `commitInsertBounds` is omitted the tool is click-only (legacy
 *  behavior). When provided, drag draws a dashed marquee and on release
 *  commits via `commitInsertBounds(bounds)`. Releases that didn't cross
 *  `minBounds` fall back to `commitInsert(start)` so a wobbly click still
 *  inserts at the cursor.
 *
 *  Consumers wanting double-click-to-edit on existing nodes wire that
 *  separately via `useTextEdit`. */
export function useTextTool<TObject extends { id: string }>(
  options: UseTextToolOptions<TObject>,
): Tool<TextScratch> {
  const { commitInsert, commitInsertBounds, minBounds, marqueeStyle, hitExisting } = options;
  const minW = minBounds?.width ?? 4;
  const minH = minBounds?.height ?? 4;

  // Refs so the overlay closure pulls live scratch without rebuilding the
  // Tool record on every drag tick.
  const scratchRef = useRef<TextScratch>({ kind: 'idle' });
  const styleRef = useRef(marqueeStyle);
  styleRef.current = marqueeStyle;

  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'text-overlay',
      label: 'Text overlay',
      space: 'screen',
      draw: (ctx, _data, view) => {
        const s = scratchRef.current;
        if (s.kind !== 'drag') return;
        const cfg = styleRef.current ?? {};
        const stroke = cfg.stroke ?? '#a48bd4';
        const dash = cfg.dash ?? [3, 3];
        const lineWidth = cfg.lineWidth ?? 1;
        const fill = cfg.fill ?? 'rgba(164, 139, 212, 0.10)';
        const t = viewToTransform(view);
        const x = Math.min(s.startX, s.curX);
        const y = Math.min(s.startY, s.curY);
        const w = Math.abs(s.curX - s.startX);
        const h = Math.abs(s.curY - s.startY);
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
    }),
    [],
  );

  return useMemo(
    () =>
      defineTool<TextScratch>({
        id: 'text',
        keybinding: 'T',
        cursor: 'text',
        overlay: commitInsertBounds ? overlay : undefined,
        initScratch: () => ({ kind: 'idle' }),
        pointer: {
          onClick: (_e, ctx) => {
            if (hitExisting) {
              const hit = hitExisting({ worldX: ctx.worldX, worldY: ctx.worldY });
              if (hit) {
                ctx.selection.set(Array.isArray(hit) ? hit : [hit]);
                return 'claim';
              }
            }
            const obj = commitInsert({ worldX: ctx.worldX, worldY: ctx.worldY });
            if (!obj) return 'pass';
            ctx.applyBatch([createInsertOp({ object: obj })], 'Insert text');
            return 'claim';
          },
        },
        // Drag is only wired when the consumer opts in via commitInsertBounds.
        // Otherwise the dispatcher routes plain clicks to pointer.onClick as before.
        ...(commitInsertBounds
          ? {
              drag: {
                onStart: (_e, ctx) => {
                  if (hitExisting) {
                    const hit = hitExisting({ worldX: ctx.worldX, worldY: ctx.worldY });
                    if (hit) {
                      ctx.selection.set(Array.isArray(hit) ? hit : [hit]);
                      // Stay idle: subsequent onMove/onEnd no-op, no marquee.
                      ctx.scratch = { kind: 'idle' };
                      scratchRef.current = ctx.scratch;
                      return 'claim';
                    }
                  }
                  ctx.scratch = {
                    kind: 'drag',
                    startX: ctx.worldX,
                    startY: ctx.worldY,
                    curX: ctx.worldX,
                    curY: ctx.worldY,
                  };
                  scratchRef.current = ctx.scratch;
                  return 'claim';
                },
                onMove: (_e, ctx) => {
                  if (ctx.scratch.kind !== 'drag') return 'pass';
                  ctx.scratch = {
                    ...ctx.scratch,
                    curX: ctx.worldX,
                    curY: ctx.worldY,
                  };
                  scratchRef.current = ctx.scratch;
                  return 'claim';
                },
                onEnd: (_e, ctx) => {
                  const s = ctx.scratch;
                  if (s.kind !== 'drag') return 'pass';
                  const x = Math.min(s.startX, s.curX);
                  const y = Math.min(s.startY, s.curY);
                  const w = Math.abs(s.curX - s.startX);
                  const h = Math.abs(s.curY - s.startY);
                  ctx.scratch = { kind: 'idle' };
                  scratchRef.current = ctx.scratch;
                  // Below threshold: behave like a click at the start point.
                  // Tiny drags (jitter) still produce a sensibly-sized text
                  // box at the cursor instead of a 1-pixel one.
                  if (w < minW || h < minH) {
                    const obj = commitInsert({ worldX: s.startX, worldY: s.startY });
                    if (!obj) return 'pass';
                    ctx.applyBatch([createInsertOp({ object: obj })], 'Insert text');
                    return 'claim';
                  }
                  const obj = commitInsertBounds({ x, y, width: w, height: h });
                  if (!obj) return 'pass';
                  ctx.applyBatch([createInsertOp({ object: obj })], 'Insert text');
                  return 'claim';
                },
                onCancel: (ctx) => {
                  ctx.scratch = { kind: 'idle' };
                  scratchRef.current = ctx.scratch;
                },
              },
            }
          : {}),
      }),
    [commitInsert, commitInsertBounds, overlay, minW, minH, hitExisting],
  );
}
