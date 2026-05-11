import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import {
  type EditAnchorsController,
  type EditAnchorsStartArgs,
  createAnchorEditOverlayLayer,
  type AnchorEditOverlayOpts,
} from 'interactions/gestures/edit-anchors';

export interface EditAnchorsScratch {
  /** Captured on pointer.onDown when the down landed on an anchor or
   *  control. Drives `controller.start` at threshold-cross. */
  pendingStart: EditAnchorsStartArgs | null;
}

export interface UseEditAnchorsToolOptions {
  /** Tool id. Default `'edit-anchors'`. */
  id?: string;
  /** Keybinding. Default `'A'` (matches Illustrator's Direct Selection). */
  keybinding?: string;
  /** Cursor. Default `'default'`. */
  cursor?: string;
  /** Visual style overrides for the anchor-edit overlay. The `getOverlay`
   *  callback is wired internally to the controller — pass any of the
   *  other style fields to customize colors / radii. */
  overlayStyle?: Partial<Omit<AnchorEditOverlayOpts, 'getOverlay'>>;
  /** Optional callback for Escape — consumers typically clear their
   *  `editingId` state to exit edit mode entirely. The tool itself only
   *  cancels the in-flight drag and clears the highlighted anchor. */
  onExit?: () => void;
}

/** Wraps `useEditAnchors` as a Tool record so anchor-editing becomes an
 *  active-slot tool. The consumer still owns `useEditAnchors` (so they
 *  control how `editingId` is set — by selection, double-click, palette,
 *  etc.); this tool routes pointer / drag / keyboard / overlay through
 *  the controller.
 *
 *  Pointer flow: `pointer.onDown` calls `controller.tryHit` — on miss,
 *  it clears the anchor highlight and claims the gesture; on hit, it
 *  stashes the hit in scratch. `drag.onStart` fires `controller.start`
 *  at threshold-cross; `drag.onMove` calls `controller.move`;
 *  `drag.onEnd` calls `controller.end`. Escape cancels the drag and
 *  invokes `onExit` so the consumer can drop edit mode. */
export function useEditAnchorsTool<TNode extends { id: string }>(
  controller: EditAnchorsController<TNode>,
  options: UseEditAnchorsToolOptions = {},
): Tool<EditAnchorsScratch> {
  const ctrlRef = useRef(controller);
  ctrlRef.current = controller;
  const optsRef = useRef(options);
  optsRef.current = options;

  return useMemo(() => {
    const overlay = createAnchorEditOverlayLayer({
      ...optsRef.current.overlayStyle,
      getOverlay: () => {
        const ov = ctrlRef.current.overlay;
        if (!ov) return null;
        return { pose: ov.pose, selectedAnchors: ov.selectedAnchors };
      },
    });

    return defineTool<EditAnchorsScratch>({
      id: optsRef.current.id ?? 'edit-anchors',
      keybinding: optsRef.current.keybinding ?? 'A',
      cursor: optsRef.current.cursor ?? 'default',
      overlay,
      initScratch: () => ({ pendingStart: null }),

      pointer: {
        onDown: (_e, ctx) => {
          const c = ctrlRef.current;
          const result = c.tryHit(ctx.worldX, ctx.worldY);
          if (!result) {
            // Empty click while editing — clear the highlighted anchor.
            // Consumer's onExit (if wired) handles full mode-exit on
            // Escape; clicking off only deselects.
            c.clearSelection();
            ctx.scratch.pendingStart = null;
            return 'claim';
          }
          ctx.scratch.pendingStart = {
            id: result.id,
            hit: result.hit,
            worldX: ctx.worldX,
            worldY: ctx.worldY,
          };
          return 'claim';
        },

        onClick: (_e, ctx) => {
          // Sub-threshold release on an anchor hit — start() ran in
          // pointer.onDown? No: start() must wait for threshold so a
          // pure click doesn't open a no-op transform. Selection is
          // updated by start(); a sub-threshold release shouldn't fire
          // start(). Clear pendingStart so a stale hit doesn't leak.
          ctx.scratch.pendingStart = null;
          return 'claim';
        },
      },

      drag: {
        onStart: (_e, ctx) => {
          const pending = ctx.scratch.pendingStart;
          if (!pending) return 'pass';
          ctrlRef.current.start(pending);
          return 'claim';
        },

        onMove: (_e, ctx) => {
          const c = ctrlRef.current;
          if (!c.isActive()) return 'pass';
          c.move({ worldX: ctx.worldX, worldY: ctx.worldY, modifiers: ctx.modifiers });
          return 'claim';
        },

        onEnd: (_e, _ctx) => {
          const c = ctrlRef.current;
          if (!c.isActive()) return 'pass';
          c.end();
          return 'claim';
        },

        onCancel: () => {
          const c = ctrlRef.current;
          if (c.isActive()) c.cancel();
        },
      },

      keyboard: {
        onDown: (e, _ctx) => {
          if (e.key === 'Escape') {
            const c = ctrlRef.current;
            if (c.isActive()) c.cancel();
            optsRef.current.onExit?.();
            return 'claim';
          }
          return 'pass';
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
