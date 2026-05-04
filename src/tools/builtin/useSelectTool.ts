import { useMemo } from 'react';
import { useMove, type UseMoveOptions } from '../../interactions/gestures/move/move';
import { useResize, type UseResizeOptions } from '../../interactions/gestures/resize/resize';
import { useRotate, type UseRotateOptions } from '../../interactions/gestures/rotate/rotate';
import { useAreaSelect, type UseAreaSelectOptions } from '../../interactions/gestures/area-select/areaSelect';
import { cornerResizeHandles, hitCornerHandle } from '../../interactions/gestures/resize/cornerHandles';
import { rotationHandle, hitRotationHandle } from '../../interactions/gestures/rotate/handle';
import type { MoveAdapter } from '../../core/adapters/types';
import type { ResizeAdapter } from '../../core/adapters/types';
import type { RotateAdapter } from '../../core/adapters/types';
import type { AreaSelectAdapter } from '../../core/adapters/types';
import type { ResizeAnchor } from '../../interactions/gestures/types';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

/** World-space bounding rect for hit-testing handles. Uses `width`/`height` to
 *  match `cornerResizeHandles` and `rotationHandle` expectations. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseSelectToolOptions<_TObject extends { id: string }, TPose> {
  /** Return ids of objects whose body covers (worldX, worldY). */
  hitBody: (worldX: number, worldY: number) => string[];
  /** Return the world-space bounds of `id`, or null if not found. */
  boundsOf: (id: string) => Bounds | null;
  /** Square hit-radius for corner resize handles. Default: 8. */
  handleHitRadius?: number;
  /** Distance from top edge of bounds to rotation handle center. Default: 24. */
  rotationHandleDistance?: number;
  move?: UseMoveOptions<TPose>;
  resize?: UseResizeOptions<TPose>;
  rotate?: UseRotateOptions<TPose>;
  areaSelect?: UseAreaSelectOptions;
}

/** Intersection of all four sub-controller adapter interfaces.
 *  The narrow adapters share compatible `getObject`/`getPose`/`setPose`/`applyBatch`
 *  shapes; `AreaSelectAdapter` adds `hitTestArea`/`applyOps`/`setSelection`/`getSelection`.
 *  No conflicting overloads — intersection is safe. */
type SelectAdapter<TObject extends { id: string }, TPose> =
  MoveAdapter<TObject, TPose>
  & ResizeAdapter<TObject, TPose>
  & RotateAdapter<TObject, TPose>
  & AreaSelectAdapter;

export type SelectScratch =
  | { kind: 'idle' }
  | { kind: 'move'; ids: string[] }
  | { kind: 'resize'; targetId: string; anchor: ResizeAnchor }
  | { kind: 'rotate'; targetId: string }
  | { kind: 'area' };

/** Active-slot Tool wrapping `useMove`/`useResize`/`useRotate`/`useAreaSelect`.
 *
 *  Hit-test priority on pointer-down (single selection only for handles):
 *  1. Rotation handle
 *  2. Corner resize handles
 *  3. Body hit → move + immediate selection
 *  4. Empty → area-select marquee
 *
 *  `scratch` routes `drag.*` to the matching controller. */
export function useSelectTool<TObject extends { id: string }, TPose>(
  adapter: SelectAdapter<TObject, TPose>,
  options: UseSelectToolOptions<TObject, TPose>,
): Tool<SelectScratch> {
  const move = useMove<TObject, TPose>(adapter, options.move ?? {});
  const resize = useResize<TObject, TPose>(adapter, options.resize ?? {});
  const rotate = useRotate<TObject, TPose>(adapter, options.rotate ?? {});
  const areaSelect = useAreaSelect(adapter, options.areaSelect ?? {});

  const handleHitRadius = options.handleHitRadius ?? 8;
  const rotationHandleDistance = options.rotationHandleDistance ?? 24;

  return useMemo(
    () =>
      defineTool<SelectScratch>({
        id: 'select',
        cursor: 'default',
        initScratch: () => ({ kind: 'idle' }),

        pointer: {
          onDown: (_e, ctx) => {
            const sel = ctx.selection.current;
            // handleHitRadius is screen-px; convert to world by dividing by
            // current view scale so the hit area matches the rendered handle
            // size under zoom.
            const radiusWorld = handleHitRadius / ctx.view.scale;

            // 1. Rotation handle (single selection only)
            if (sel.length === 1) {
              const b = options.boundsOf(sel[0]);
              if (b) {
                const handle = rotationHandle(b, rotationHandleDistance);
                if (hitRotationHandle(handle, ctx.worldX, ctx.worldY, radiusWorld)) {
                  ctx.scratch = { kind: 'rotate', targetId: sel[0] };
                  return 'claim';
                }
              }
            }

            // 2. Corner resize handles (single selection only)
            if (sel.length === 1) {
              const b = options.boundsOf(sel[0]);
              if (b) {
                for (const h of cornerResizeHandles(b)) {
                  if (hitCornerHandle(h, ctx.worldX, ctx.worldY, radiusWorld)) {
                    ctx.scratch = { kind: 'resize', targetId: sel[0], anchor: h.anchor };
                    return 'claim';
                  }
                }
              }
            }

            // 3. Body hit → move (+ select)
            const ids = options.hitBody(ctx.worldX, ctx.worldY);
            if (ids.length > 0) {
              ctx.selection.applyClick(ids[0], ctx.modifiers);
              // After applyClick the selection may have changed; use it if non-empty.
              const moveIds = ctx.selection.current.length > 0 ? ctx.selection.current : ids;
              ctx.scratch = { kind: 'move', ids: moveIds };
              return 'claim';
            }

            // 4. Empty → area-select
            ctx.scratch = { kind: 'area' };
            return 'claim';
          },
        },

        drag: {
          onStart: (e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move':
                move.start({ ids: s.ids, worldX: ctx.worldX, worldY: ctx.worldY, clientX: e.clientX, clientY: e.clientY });
                return 'claim';
              case 'resize':
                resize.start(s.targetId, s.anchor, ctx.worldX, ctx.worldY);
                return 'claim';
              case 'rotate':
                rotate.start({ id: s.targetId, worldX: ctx.worldX, worldY: ctx.worldY });
                return 'claim';
              case 'area':
                areaSelect.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              default:
                return 'pass';
            }
          },

          onMove: (e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move':
                move.move({ worldX: ctx.worldX, worldY: ctx.worldY, clientX: e.clientX, clientY: e.clientY, modifiers: ctx.modifiers });
                return 'claim';
              case 'resize':
                resize.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              case 'rotate':
                rotate.move({ worldX: ctx.worldX, worldY: ctx.worldY, modifiers: ctx.modifiers });
                return 'claim';
              case 'area':
                areaSelect.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              default:
                return 'pass';
            }
          },

          onEnd: (_e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move': move.end(); return 'claim';
              case 'resize': resize.end(); return 'claim';
              case 'rotate': rotate.end(); return 'claim';
              case 'area': areaSelect.end(); return 'claim';
              default: return 'pass';
            }
          },

          onCancel: (ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move': move.cancel(); break;
              case 'resize': resize.cancel(); break;
              case 'rotate': rotate.cancel(); break;
              case 'area': areaSelect.cancel(); break;
            }
          },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [move, resize, rotate, areaSelect, options.hitBody, options.boundsOf, handleHitRadius, rotationHandleDistance],
  );
}
