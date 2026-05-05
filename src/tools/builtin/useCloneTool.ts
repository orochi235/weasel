import { useMemo, useReducer, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from '../../core/layers/render';
import type { InsertAdapter } from '../../core/adapters/types';
import { useClone, type UseCloneOptions } from '../../interactions/gestures/clone';
import type { CloneBehavior, CloneLayer, ModifierState } from '../../interactions/gestures/types';

/** Live preview item published by useClone — `{id, x, y}` (snapshot pose
 *  translated by the in-flight drag offset). */
export interface CloneOverlayItem {
  id: string;
  x: number;
  y: number;
}

export interface CloneScratch {
  /** Id captured by pickBest on pointer.onDown; passed to clone.start at
   *  threshold-cross. `null` when the down didn't land on a body. */
  pendingId: string | null;
  /** Modifier snapshot at down — replayed into clone.start so the
   *  behavior's `activates()` decision uses the down-time state, not
   *  whatever modifiers happen to be held at threshold-cross. */
  pendingMods: ModifierState | null;
}

export interface UseCloneToolOptions {
  /** Clone behaviors (e.g. `cloneByAltDrag()`) — the tool only claims
   *  pointerdown when one of these `activates()` for the current modifiers,
   *  so plain (no-modifier) drags fall through to whatever active-slot
   *  tool is running. */
  behaviors: CloneBehavior[];
  /** Hit-test the world point and return the topmost cloneable id, or
   *  null if the pointer didn't land on anything cloneable. */
  pickBest: (worldX: number, worldY: number) => string | null;
  /** Render the in-flight clone ghost. Receives the live overlay items
   *  (snapshot pose translated by the drag offset). The tool owns the
   *  overlay state internally so the consumer doesn't have to thread
   *  `setOverlay`/`clearOverlay` callbacks through React state. */
  drawGhost: (cx: CanvasRenderingContext2D, items: CloneOverlayItem[]) => void;
  /** CloneLayer category passed to `clone.start`. Default `'structures'`. */
  layer?: CloneLayer;
  /** Optional id-list expansion (e.g. virtual-group expansion). Forwarded
   *  to `useClone`. */
  expandIds?: UseCloneOptions['expandIds'];
  /** Tool id. Default `'clone'`. */
  id?: string;
  /** Cursor while the activating modifier is held. Default `'copy'`. */
  cursor?: string;
}

/** Wraps `useClone` as a Tool record. The tool sits in the alwaysOn slot
 *  (or wherever the consumer puts it) and only claims pointerdowns when
 *  (a) one of the `behaviors` activates for the current modifiers and
 *  (b) `pickBest` finds a target. Encapsulates the overlay-state plumbing
 *  that previously lived in every consumer (setOverlay/clearOverlay
 *  callbacks bridging React state). */
export function useCloneTool<T extends { id: string }>(
  adapter: InsertAdapter<T>,
  options: UseCloneToolOptions,
): Tool<CloneScratch> {
  const optsRef = useRef(options);
  optsRef.current = options;

  // Overlay state lives in a ref so setOverlay/clearOverlay can write
  // synchronously from useClone's lifecycle. Bump a tick to force the
  // overlay layer's `draw` callback to re-fire on the next frame.
  const overlayRef = useRef<CloneOverlayItem[] | null>(null);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const forceRenderRef = useRef(forceRender);
  forceRenderRef.current = forceRender;

  const clone = useClone(adapter, {
    behaviors: options.behaviors,
    expandIds: options.expandIds,
    setOverlay: (_layer, objects) => {
      overlayRef.current = objects as CloneOverlayItem[];
      forceRenderRef.current();
    },
    clearOverlay: () => {
      overlayRef.current = null;
      forceRenderRef.current();
    },
  });
  const cloneRef = useRef(clone);
  cloneRef.current = clone;
  // Synchronous mirror of clone.isCloning. The hook's `isCloning` is React
  // state and won't reflect a same-tick start() call until re-render, but
  // the tool dispatcher fires onStart→onMove→onEnd within a single tick.
  const activeRef = useRef(false);

  return useMemo(() => {
    const overlay: RenderLayer<unknown> = {
      id: 'clone-ghost',
      label: 'Clone ghost',
      draw: (cx) => {
        const items = overlayRef.current;
        if (!items) return;
        optsRef.current.drawGhost(cx, items);
      },
    };

    return defineTool<CloneScratch>({
      id: optsRef.current.id ?? 'clone',
      cursor: optsRef.current.cursor ?? 'copy',
      overlay,
      initScratch: () => ({ pendingId: null, pendingMods: null }),

      pointer: {
        onDown: (_e, ctx) => {
          const mods = ctx.modifiers;
          const activates = optsRef.current.behaviors.some((b) => b.activates(mods));
          if (!activates) return 'pass';
          const id = optsRef.current.pickBest(ctx.worldX, ctx.worldY);
          if (id === null) return 'pass';
          ctx.scratch.pendingId = id;
          ctx.scratch.pendingMods = { ...mods };
          return 'claim';
        },
      },

      drag: {
        onStart: (_e, ctx) => {
          const { pendingId, pendingMods } = ctx.scratch;
          if (pendingId === null || pendingMods === null) return 'pass';
          cloneRef.current.start(
            ctx.worldX,
            ctx.worldY,
            [pendingId],
            optsRef.current.layer ?? 'structures',
            pendingMods,
          );
          activeRef.current = true;
          return 'claim';
        },

        onMove: (_e, ctx) => {
          if (!activeRef.current) return 'pass';
          cloneRef.current.move(ctx.worldX, ctx.worldY, ctx.modifiers);
          return 'claim';
        },

        onEnd: (_e, _ctx) => {
          if (!activeRef.current) return 'pass';
          cloneRef.current.end();
          activeRef.current = false;
          return 'claim';
        },

        onCancel: () => {
          if (activeRef.current) {
            cloneRef.current.cancel();
            activeRef.current = false;
          }
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
