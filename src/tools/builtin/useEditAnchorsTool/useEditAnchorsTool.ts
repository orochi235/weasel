import { useMemo, useRef } from 'react';
import { defineTool, begin, claim, none } from '../../routing';
import type { Tool } from '../../types';
import {
  type EditAnchorsController,
  type EditAnchorsStartArgs,
  createAnchorEditOverlayLayer,
  type AnchorEditOverlayOpts,
} from 'interactions/gestures/edit-anchors';
import type { KeyBinding } from 'interactions/actions/useKeybinding';

/** Vestigial scratch shape — kept exported for backward compatibility
 *  with the imperative `Tool<EditAnchorsScratch>` surface. The declarative
 *  routing migration parks the in-flight hit state in a closure ref
 *  instead, so the runtime scratch is `null`. */
export interface EditAnchorsScratch {
  pendingStart: EditAnchorsStartArgs | null;
}

export interface UseEditAnchorsToolOptions {
  /** Tool id. Default `'edit-anchors'`. */
  id?: string;
  /** Keybinding. Default `{ key: 'A' }` (matches Illustrator's Direct Selection). */
  keybinding?: KeyBinding;
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
 *  Pointer flow (declarative routing, Phase 5b):
 *    - `pointerDown` (every target) calls `controller.tryHit`. On miss it
 *      clears the highlighted anchor and returns `claim()`. On hit it
 *      stashes the hit in a closure-scoped slot.
 *    - `drag` (function-form) reads the stashed hit at threshold-cross,
 *      calls `controller.start`, and returns `begin(spec)` whose
 *      continuations forward `move` / `end` / `cancel` to the controller.
 *    - `keyDown.Escape` cancels the in-flight drag (if any) and invokes
 *      `onExit` so the consumer can drop edit mode entirely.
 *
 *  Hit-test math is hand-rolled by `controller.tryHit` rather than
 *  surfaced as `ctx.target` kinds, so drag is function-form (Pattern B in
 *  the Phase 5b plan) rather than a per-kind route table. */
export function useEditAnchorsTool<TNode extends { id: string }>(
  controller: EditAnchorsController<TNode>,
  options: UseEditAnchorsToolOptions = {},
): Tool<null> {
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

    // Closure-scoped hand-off from pointerDown → drag. Holds the anchor /
    // handle hit captured at pointerdown so drag.onStart can call
    // `controller.start` at threshold-cross. Cleared by every pointerDown
    // (miss path) and by every drag.onStart (after the controller takes
    // it). One slot is enough because at most one gesture is active per
    // tool instance.
    let pendingStart: EditAnchorsStartArgs | null = null;

    return defineTool<null>({
      id: optsRef.current.id ?? 'edit-anchors',
      keybinding: optsRef.current.keybinding ?? { key: 'A' },
      cursor: optsRef.current.cursor ?? 'default',
      initial: {
        overlay: () => overlay,

        // pointerDown classifier — hand-rolled hit test via the
        // controller. Routes for `'*'` cover every target kind including
        // empty hits (via the wildcard fall-through introduced in T1 of
        // the wildcard semantic flip). The controller's hit-test is
        // independent of `ctx.target`: a body click that doesn't land on
        // an anchor should still clear the highlight, matching the
        // pre-migration `pointer.onDown` semantics.
        pointerDown: {
          '*': (ctx) => {
            const c = ctrlRef.current;
            const result = c.tryHit(ctx.worldX, ctx.worldY);
            if (!result) {
              c.clearSelection();
              pendingStart = null;
              return claim();
            }
            pendingStart = {
              id: result.id,
              hit: result.hit,
              worldX: ctx.worldX,
              worldY: ctx.worldY,
            };
            return claim();
          },
        },

        // Function-form drag: at threshold-cross, consume the pending hit
        // and open the controller's drag. If the down landed on empty
        // space (no anchor hit captured), pass through so the dispatcher
        // can hand the drag to the next slot.
        drag: (_ctx) => {
          const pending = pendingStart;
          pendingStart = null;
          if (!pending) return none();
          const c = ctrlRef.current;
          c.start(pending);
          return begin<null>({
            scratch: null,
            onMove: (mctx) => {
              c.move({
                worldX: mctx.worldX,
                worldY: mctx.worldY,
                modifiers: mctx.modifiers,
              });
              return claim();
            },
            onRelease: () => {
              c.end();
              return claim();
            },
            onCancel: () => {
              c.cancel();
            },
          });
        },

        keyDown: {
          Escape: () => {
            const c = ctrlRef.current;
            if (c.isActive()) c.cancel();
            optsRef.current.onExit?.();
            return claim();
          },
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
