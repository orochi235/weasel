import { useMemo, useReducer, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { RenderLayer } from '../../core/layers/render';
import type { InsertAdapter } from '../../core/adapters/types';
import type { View } from '../../features/viewport/view';
import { useClone, type UseCloneOptions } from '../../interactions/gestures/clone';
import type { CloneBehavior, CloneLayer, ModifierState } from '../../interactions/gestures/types';
import { AUTO_POSE_DESCRIPTOR } from '../../interactions/gestures/resize/autoPoseDescriptor';

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

/** Optional adapter shape consulted for the auto-`pickBest` and auto-`drawGhost`
 *  defaults. Most consumers' adapters (e.g. `arrayAdapter`) already implement
 *  these — when present and `pickBest`/`drawGhost` are omitted, the tool
 *  derives sensible defaults. */
interface IntrospectableAdapter<T> {
  getObjects?(): T[];
  getPose?(id: string): unknown;
}

export interface UseCloneToolOptions<T extends { id: string } = { id: string }, TPose = unknown> {
  /** Clone behaviors (e.g. `cloneByAltDrag()`) — the tool only claims
   *  pointerdown when one of these `activates()` for the current modifiers,
   *  so plain (no-modifier) drags fall through to whatever active-slot
   *  tool is running. */
  behaviors: CloneBehavior[];
  /** Hit-test the world point and return the topmost cloneable id, or
   *  null if the pointer didn't land on anything cloneable. Optional —
   *  when omitted, the tool walks `adapter.getObjects()` back-to-front and
   *  tests pointer containment against `adapter.getPose(id)` via the same
   *  AUTO_POSE_DESCRIPTOR Canvas uses for its own pickEvery fallback. */
  pickBest?: (worldX: number, worldY: number) => string | null;
  /** Render the in-flight clone ghost. Receives the live overlay items
   *  (snapshot pose translated by the drag offset). The tool owns the
   *  overlay state internally so the consumer doesn't have to thread
   *  `setOverlay`/`clearOverlay` callbacks through React state. Optional —
   *  when omitted, the tool synthesizes a ghost from `drawOne` (mirroring
   *  the SceneCanvas pattern), or falls back to a translucent rect
   *  outline if neither is supplied. */
  drawGhost?: (cx: CanvasRenderingContext2D, items: CloneOverlayItem[], view: View) => void;
  /** Scene `drawOne` (the same render fn passed to
   *  `<Canvas layers={{ scene: { drawOne } }}>`). When `drawGhost` is
   *  omitted, the tool synthesizes a ghost by translating each cloned
   *  item's source pose and calling `drawOne(ctx, obj, pose, view)`. */
  drawOne?: (cx: CanvasRenderingContext2D, obj: T, pose: TPose, view: View) => void;
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
export function useCloneTool<T extends { id: string }, TPose = unknown>(
  adapter: InsertAdapter<T>,
  options: UseCloneToolOptions<T, TPose>,
): Tool<CloneScratch> {
  const optsRef = useRef(options);
  optsRef.current = options;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

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
    // Default hitBody: walk the adapter's objects back-to-front and return
    // the first whose pose contains the world point. Mirrors the same
    // fallback Canvas builds at the layer level.
    const defaultPickBest = (worldX: number, worldY: number): string | null => {
      const a = adapterRef.current as IntrospectableAdapter<T> & InsertAdapter<T>;
      if (!a.getObjects || !a.getPose) return null;
      const objs = a.getObjects();
      const point = { x: worldX, y: worldY, width: 0, height: 0 };
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        let pose: unknown;
        try {
          pose = a.getPose(o.id);
        } catch {
          continue;
        }
        if (AUTO_POSE_DESCRIPTOR.intersectsRect!(pose, point)) return o.id;
      }
      return null;
    };

    // Default drawGhost: if `drawOne` is supplied, mirror SceneCanvas's
    // pattern — translate each cloned item's source pose by its drag offset
    // and invoke drawOne against the synthesized pose. If neither drawGhost
    // nor drawOne is supplied, paint a translucent outlined rect at each
    // item's bounds as a minimal fallback.
    const defaultDrawGhost = (
      cx: CanvasRenderingContext2D,
      items: CloneOverlayItem[],
      view: View,
    ) => {
      const drawOne = optsRef.current.drawOne;
      const a = adapterRef.current as IntrospectableAdapter<T> & InsertAdapter<T>;
      if (drawOne && a.getObjects && a.getPose) {
        const byId = new Map<string, T>();
        for (const o of a.getObjects()) byId.set(o.id, o);
        cx.globalAlpha = 0.5;
        for (const item of items) {
          const obj = byId.get(item.id);
          if (!obj) continue;
          let srcPose: unknown;
          try {
            srcPose = a.getPose(item.id);
          } catch {
            continue;
          }
          const bounds = AUTO_POSE_DESCRIPTOR.getBounds(srcPose);
          const dx = item.x - bounds.x;
          const dy = item.y - bounds.y;
          const ghostPose = AUTO_POSE_DESCRIPTOR.translate!(srcPose, dx, dy);
          drawOne(cx, obj, ghostPose as TPose, view);
        }
        cx.globalAlpha = 1;
        return;
      }
      // No drawOne and no custom drawGhost: minimal translucent outline at
      // each item's snapshot bounds (translated by item.{x,y}).
      cx.save();
      cx.globalAlpha = 0.4;
      cx.strokeStyle = '#888';
      cx.lineWidth = 1;
      for (const item of items) {
        let pose: unknown = null;
        if (a.getPose) {
          try { pose = a.getPose(item.id); } catch { /* ignore */ }
        }
        const b = pose !== null ? AUTO_POSE_DESCRIPTOR.getBounds(pose) : { x: item.x, y: item.y, width: 0, height: 0 };
        cx.strokeRect(item.x, item.y, b.width, b.height);
      }
      cx.restore();
    };

    const overlay: RenderLayer<unknown> = {
      id: 'clone-ghost',
      label: 'Clone ghost',
      draw: (cx, _data, view) => {
        const items = overlayRef.current;
        if (!items) return;
        const drawGhost = optsRef.current.drawGhost ?? defaultDrawGhost;
        drawGhost(cx, items, view);
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
          const pick = optsRef.current.pickBest ?? defaultPickBest;
          const id = pick(ctx.worldX, ctx.worldY);
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
