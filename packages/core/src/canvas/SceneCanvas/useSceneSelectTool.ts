/**
 * Scene-aware select-tool synthesis for `<SceneCanvas>`.
 *
 * Folds together (a) the `Scene → MoveAdapter & ResizeAdapter & RotateAdapter
 * & AreaSelectAdapter` adapter (with cascading container moves and a default
 * marquee hit-test) and (b) a `useSelectTool` configured with kit-default
 * pickEvery / boundsOf derived from pose shape.
 *
 * Returns both the synthesized `adapter` (forwarded to `<Canvas>`) and the
 * `selectTool` record (registered into `useTools`). Caller-supplied
 * `pickEvery` / `boundsOf` overrides via the `geometry` arg take precedence;
 * caller-supplied `move.cascadeWorldPose` wins over the default lookup.
 */
import { useMemo } from 'react';
import { sceneToAdapter, type SceneToAdapterOptions } from '../sceneAdapter';
import { passesAncestorClips } from '../clipChain';
import { useSelectTool, type Bounds } from 'tools/builtin/select';
import { pickTopMostHit, type PickTopMostHitAdapter } from 'tools/builtin/pickTopMostHit';
import { useRotateTool } from 'tools/builtin/rotate';
import type { Node, Scene, NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { UseRotateOptions } from 'interactions/actions/rotate/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import { snap as snapBehavior } from 'interactions/gestures/shared/snap';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import { translateRectPose, type RectPose } from 'features/groups/composePose';
import { aabbOfPose, isPathLike, poseContainsRotated } from './poseGeometry';
import { shapeCoversPoint } from 'canvas/NodeShape';
import { hiddenLayerIds } from 'canvas/deps/hitTestArea';
import { meanScale } from 'core/viewport/meanScale';

/**
 * Default grab slop around a shape's outline, in screen pixels.
 *
 * Four is the same number the path-pose stroke test has always used, and it's
 * the difference between a hairline being clickable and not: a 1px stroke is
 * half a world unit of reach at scale 1, which no pointing device can hit
 * reliably. It also lets a filled shape be grabbed a few pixels outside its
 * edge, which is what makes edge-adjacent dragging feel possible.
 */
export const DEFAULT_PICK_TOLERANCE_PX = 4;

export interface UseSceneSelectToolArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  selection: SelectionApi;
  geometry?: {
    pickEvery?: (worldX: number, worldY: number) => string | string[] | null;
    boundsOf?: (id: string) => Bounds | null;
    /** How the default body-pick decides a node covers the pointer. Defaults
     *  to `'shape'`; `'pose'` opts back down to the bare pose rect. See
     *  `SceneCanvasProps.geometry.picking`. Ignored when `pickEvery` is
     *  supplied — that override owns the whole test. */
    picking?: 'pose' | 'shape';
    /** Grab slop around a shape's outline, in screen pixels. See
     *  `SceneCanvasProps.geometry.pickTolerancePx`. */
    pickTolerancePx?: number;
  };
  /** Live view, for converting the screen-pixel pick tolerance into world
   *  units. Omitted in tests and non-viewport hosts, where scale is 1. */
  getView?: () => { scale: { x: number; y: number } } | null;
  selectTool?: {
    move?: UseMoveOptions<TPose>;
    resize?: UseResizeOptions<TPose>;
    rotate?: UseRotateOptions<TPose> | false;
    snap?: SnapStrategy<TPose>;
    handleHitRadius?: number;
    /** Override the body-pick used on click/pointerdown. Alt-aware: receives
     *  the live alt state + current selection so consumers can implement
     *  alt-cycling through an overlapping stack. Default: top-most hit
     *  (alt ignored). Forwarded verbatim to `useSelectTool`. */
    pickBest?: (worldX: number, worldY: number, alt: boolean, sel: readonly string[]) => string | null;
    /** Forwarded verbatim to `useSelectTool`. See
     *  `UseSelectToolOptions.extendClickLocked`. */
    extendClickLocked?: () => boolean;
  };
  insertTool?: {
    create: SceneToAdapterOptions<TData, TLayer, TPose>['commitInsert'];
    layer?: TLayer;
  };
  layouts?: SceneToAdapterOptions<TData, TLayer, TPose>['layouts'];
}

export interface UseSceneSelectToolReturn<TData, TLayer extends string, TPose> {
  adapter: ReturnType<typeof sceneToAdapter<TData, TLayer, TPose>> & {
    setPose: (id: string, pose: TPose) => void;
    hitTestArea: (rect: { x: number; y: number; width: number; height: number }) => string[];
    applyOps: (ops: Op[]) => void;
    setSelection: (ids: string[]) => void;
    getSelection: () => string[];
  };
  selectTool: ReturnType<typeof useSelectTool<Node<TData, TLayer, TPose>, TPose>>;
  rotateTool: ReturnType<typeof useRotateTool<Node<TData, TLayer, TPose>, TPose>>;
  /** Hit-test resolved with the caller's `geometry.pickEvery` (or the
   *  pose-walk default). Forward this to `<Canvas pickEvery={...}>` so the
   *  dispatcher's `getNodeAtPoint` returns the same node the select tool
   *  picked — drag routes keyed on `target.kind` then resolve to `'*'`
   *  (move) instead of `'empty'` (marquee). */
  pickEvery: (worldX: number, worldY: number) => string[];
  /** Single-best hit under the world point, or null. Runs `pickEvery` then
   *  collapses parent/child overlap via `pickTopMostHit` — matches the id
   *  the select tool's pointerdown classifier would settle on for a bare
   *  click. Exposed so debug HUDs can highlight the would-be selection. */
  pickBest: (worldX: number, worldY: number) => string | null;
  /** World-space AABB of `id`, or null. Same as what the selection overlay +
   *  affordance hit-test need. Exposed so SceneCanvas can pass it to the
   *  `affordanceAt` thunk without re-deriving it. */
  boundsOf: (id: string) => import('core/viewport/fitViewToBounds').Bounds | null;
}

export function useSceneSelectTool<TData, TLayer extends string, TPose>(
  args: UseSceneSelectToolArgs<TData, TLayer, TPose>,
): UseSceneSelectToolReturn<TData, TLayer, TPose> {
  const { scene, selection, geometry, selectTool: opts, insertTool, layouts, getView } = args;

  const pickEveryProp = geometry?.pickEvery;
  const boundsOfProp = geometry?.boundsOf;
  // Default. The pose rect is the wrong answer for anything that isn't a
  // rectangle, so `'pose'` is the opt-out rather than the baseline. Cheap to
  // leave on: the rect pre-filter runs first and rejects every node the
  // pointer isn't over, and the survivors' silhouettes are memoized per node.
  const shapePicking = (geometry?.picking ?? 'shape') === 'shape';
  const pickTolerancePx = geometry?.pickTolerancePx ?? DEFAULT_PICK_TOLERANCE_PX;
  const moveOptions = opts?.move;
  const rotateOptions = opts?.rotate;
  const snap = opts?.snap;
  const handleHitRadius = opts?.handleHitRadius;
  const commitInsert = insertTool?.create;
  const insertLayer = insertTool?.layer;

  const adapter = useMemo(() => {
    const base = sceneToAdapter(scene, { commitInsert, insertLayer, layouts });
    const collectDescendants = (id: string, out: string[]): void => {
      for (const cid of scene.childrenOf(asNodeId(id))) {
        out.push(cid);
        collectDescendants(cid, out);
      }
    };
    return {
      ...base,
      setPose(id: string, pose: TPose) {
        const n = scene.get(asNodeId(id));
        if (!n || n.kind !== 'container') {
          base.setPose(id, pose);
          return;
        }
        const prev = n.pose as unknown as { x: number; y: number };
        const next = pose as unknown as { x: number; y: number };
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        if (dx === 0 && dy === 0) {
          base.setPose(id, pose);
          return;
        }
        const desc: string[] = [];
        collectDescendants(id, desc);
        scene.batch('move container', () => {
          base.setPose(id, pose);
          for (const cid of desc) {
            const cn = scene.get(asNodeId(cid));
            if (!cn) continue;
            // Container cascade is rect-only: translate each descendant's
            // top-level (x, y) by the same delta via the shared helper.
            base.setPose(cid, translateRectPose(cn.pose as unknown as RectPose, dx, dy) as unknown as TPose);
          }
        });
      },
      // Selection methods, widened to `string[]` so the synthesized adapter
      // satisfies `AreaSelectAdapter` (which keeps the kit-internal adapter
      // contract on plain `string[]`; the brand lives on the public selection
      // surface, not on adapter shapes).
      getSelection: (): string[] => [...selection.adapterMethods.getSelection()],
      setSelection: (ids: string[]) => selection.adapterMethods.setSelection(ids as NodeId[]),
      // Default marquee hit-test: walk every renderOrder node and collect ids
      // whose AABB intersects the marquee rect. Path-shaped poses use their
      // path descriptor for a tighter test.
      hitTestArea: (rect: { x: number; y: number; width: number; height: number }): string[] => {
        const hits: string[] = [];
        for (const n of scene.renderOrderNodes()) {
          if (isPathLike(n.pose) && pathPoseDescriptor.intersectsRect) {
            if (pathPoseDescriptor.intersectsRect(n.pose, rect)) hits.push(n.id);
            continue;
          }
          const b = aabbOfPose(n.pose);
          if (b.x < rect.x + rect.width && b.x + b.width > rect.x
            && b.y < rect.y + rect.height && b.y + b.height > rect.y) {
            hits.push(n.id);
          }
        }
        return hits;
      },
    };
  }, [scene, commitInsert, insertLayer, layouts, selection]);

  // Default cascade lookup for the move overlay — reads live world pose from
  // the scene. Caller's `moveOptions.cascadeWorldPose` (if any) wins.
  const wiredMoveOptions = useMemo<UseMoveOptions<TPose>>(() => {
    const defaultCascade = (id: string): TPose | null => {
      const n = scene.get(asNodeId(id));
      return n ? n.pose : null;
    };
    const merged: UseMoveOptions<TPose> = {
      cascadeWorldPose: defaultCascade,
      ...(moveOptions ?? {}),
    };
    if (snap) {
      const existing = merged.behaviors ?? [];
      merged.behaviors = [snapBehavior(snap), ...existing];
    }
    return merged;
  }, [scene, moveOptions, snap]);

  // Default pickEvery: walk renderOrder() forward (back-to-front) and collect
  // every node whose pose contains the world point. Order matches the
  // `useSelectTool` contract — last element is the topmost — so `pickTopMostHit`
  // picks correctly. Wraps the caller's `pickEvery` (string-or-null) into the
  // array form `useSelectTool` expects. `poseContainsRotated` reads
  // `pose.rotation` directly (the kit's one rotation convention), so rotated
  // shapes pick against their rendered, rotated body without a per-demo override.
  const wiredHitBody = useMemo(() => {
    return (wx: number, wy: number): string[] => {
      if (pickEveryProp) {
        const r = pickEveryProp(wx, wy);
        if (r == null) return [];
        return Array.isArray(r) ? r : [r];
      }
      // Screen-pixel slop → world units, so the grab zone around an outline
      // stays the same apparent thickness at any zoom.
      const tolerance = pickTolerancePx / meanScale(getView?.()?.scale ?? { x: 1, y: 1 });
      const out: string[] = [];
      const hidden = hiddenLayerIds(scene.layers);
      for (const n of scene.renderOrderNodes()) {
        // A hidden layer isn't painted (`buildSceneTree` skips its bucket), so
        // picking must not answer for it either.
        if (hidden.size > 0 && hidden.has(n.layer)) continue;
        // Through the adapter, not `n.pose`: an ephemeral override is the pose
        // the renderer draws, so it has to be the one picking tests.
        const pose = adapter.getPose(n.id);
        // The pose rect is the pre-filter — grown by the tolerance, because a
        // shape's outline (and the slop around it) reaches outside its own
        // bounds, and an un-grown pre-filter would reject those hits before
        // the refinement ever ran.
        if (!poseContainsRotated(pose, wx, wy, tolerance)) continue;
        // `shapeCoversPoint` narrows the rect to the ink the painter actually
        // lays down (and answers `true` for painters that have no silhouette,
        // so nothing becomes unpickable).
        if (shapePicking && !shapeCoversPoint(n, pose, wx, wy, { tolerance })) continue;
        // A container clips its subtree and the renderer honors it, so a child
        // outside the clip is unpainted — and must not be pickable either.
        if (!passesAncestorClips(scene, n, wx, wy)) continue;
        out.push(n.id);
      }
      return out;
    };
  }, [scene, adapter, pickEveryProp, shapePicking, pickTolerancePx, getView]);

  const wiredBoundsOf = useMemo(() => {
    return (id: string): Bounds | null => {
      if (boundsOfProp) return boundsOfProp(id);
      const n = scene.get(asNodeId(id));
      if (!n) return null;
      const pose = adapter.getPose(id);
      const b = aabbOfPose(pose);
      // Surface rotation to the overlay directly from the pose. Independent
      // of any gesture-side descriptor (notably `selectTool.resize.geometry`,
      // which the rotated-resize math demo deliberately subverts to
      // demonstrate counterexamples — the overlay must keep showing the
      // rect's true rotation regardless).
      const rot = (pose as { rotation?: number }).rotation;
      return rot ? { ...b, rotation: rot } : b;
    };
  }, [scene, adapter, boundsOfProp]);

  const selectTool = useSelectTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
    pickEvery: wiredHitBody,
    move: wiredMoveOptions,
    ...(opts?.pickBest ? { pickBest: opts.pickBest } : {}),
    ...(opts?.extendClickLocked ? { extendClickLocked: opts.extendClickLocked } : {}),
  });

  const rotateTool = useRotateTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
    ...(rotateOptions ? { rotate: rotateOptions } : {}),
    ...(handleHitRadius !== undefined ? { handleHitRadius } : {}),
    // rotationHandleDistance default lives inside useRotateTool — only forward
    // if a caller passes one. Today there's no path for callers to provide
    // this through SceneCanvas; leave to a follow-up.
    boundsOf: wiredBoundsOf,
    getSelection: () => [...selection.current],
    getNode: (id) => scene.get(asNodeId(id)) ?? null,
  });

  const wiredPickBest = useMemo(() => {
    return (wx: number, wy: number): string | null => {
      const ids = wiredHitBody(wx, wy);
      return pickTopMostHit(ids, adapter as unknown as PickTopMostHitAdapter);
    };
  }, [wiredHitBody, adapter]);

  return {
    adapter: adapter as UseSceneSelectToolReturn<TData, TLayer, TPose>['adapter'],
    selectTool,
    rotateTool,
    pickEvery: wiredHitBody,
    pickBest: wiredPickBest,
    boundsOf: wiredBoundsOf,
  };
}
