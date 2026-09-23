/**
 * Scene-aware select-tool synthesis for `<SceneCanvas>`: a `useSelectTool`
 * over the caller's scene adapter, configured with kit-default pickEvery /
 * boundsOf derived from pose shape. Caller-supplied `pickEvery` / `boundsOf`
 * overrides via the `geometry` arg take precedence.
 */
import { useMemo } from 'react';
import type { SceneCanvasAdapter } from '../sceneAdapter';
import { pickWalk, scenePickSource, type ViewPickGates } from 'canvas/pickWalk';
import { pathContainsPoint } from 'features/paths/pathHitTest';
import { useSelectTool, type Bounds } from 'tools/builtin/select';
import { pickTopMostHit, type PickTopMostHitAdapter } from 'tools/builtin/pickTopMostHit';
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import { snap as snapBehavior } from 'interactions/gestures/shared/snap';
import { poseDescriptorForNode, type PoseDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import { poseContains, poseContainsRotated } from './poseGeometry';
import { shapeCoversPoint, findShapeInk } from 'canvas/NodeShape';
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

/** The view a pick is asked for. A world point carries neither the scale it
 *  was produced under nor what that view paints, so a caller picking for a
 *  view other than the surface's says both. A gate left out is the one this
 *  hook was built with. */
export interface PickView extends ViewPickGates { scale: { x: number; y: number } }

export interface UseSceneSelectToolArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  /** The adapter the select tool drives, built over `scene` with the same
   *  `poseDescriptor`. Its world poses are what picking and bounds read. */
  adapter: SceneCanvasAdapter<TData, TLayer, TPose>;
  /** How to read and rewrite this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
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
  /** The surface's camera, for converting the screen-pixel pick tolerance into
   *  world units. A caller picking for another view passes that view's camera
   *  to `pickEvery` / `pickBest` instead. Omitted in tests and non-viewport
   *  hosts, where scale is 1. */
  getView?: () => Pick<PickView, 'scale'> | null;
  /** The asking view's painted alpha per node — its `alphaFor` times any
   *  per-node override alpha. A node the view paints at alpha 0 is not on
   *  screen, so picking must not answer for it. */
  alphaOf?: (id: string) => number;
  /** The asking view's answer to "does this scene layer reach the screen".
   *  `layerVisibility` and `layerOrder` both gate a layer out of the paint
   *  (`drawLayers` drops any layer missing from a supplied order), and an
   *  undrawn layer must not claim clicks. */
  layerIsPainted?: (layer: string) => boolean;
  selectTool?: {
    move?: UseMoveOptions<TPose>;
    resize?: UseResizeOptions<TPose>;
    snap?: SnapStrategy<TPose>;
    /** Override the body-pick used on click/pointerdown. Alt-aware: receives
     *  the live alt state + current selection so consumers can implement
     *  alt-cycling through an overlapping stack. Default: top-most hit
     *  (alt ignored). Forwarded verbatim to `useSelectTool`. */
    pickBest?: (worldX: number, worldY: number, alt: boolean, sel: readonly string[]) => string | null;
    /** Forwarded verbatim to `useSelectTool`. See
     *  `UseSelectToolOptions.extendClickLocked`. */
    extendClickLocked?: () => boolean;
  };
}

export interface UseSceneSelectToolReturn<TData, TLayer extends string, TPose> {
  selectTool: ReturnType<typeof useSelectTool<Node<TData, TLayer, TPose>, TPose>>;
  /** Hit-test resolved with the caller's `geometry.pickEvery` (or the
   *  pose-walk default). Forward this to `<Canvas pickEvery={...}>` so the
   *  dispatcher's `getNodeAtPoint` returns the same node the select tool
   *  picked — drag routes keyed on `target.kind` then resolve to `'*'`
   *  (move) instead of `'empty'` (marquee). */
  pickEvery: (worldX: number, worldY: number, view?: PickView | null) => string[];
  /** Single-best hit under the world point, or null. Runs `pickEvery` then
   *  collapses parent/child overlap via `pickTopMostHit` — matches the id
   *  the select tool's pointerdown classifier would settle on for a bare
   *  click. Exposed so debug HUDs can highlight the would-be selection. */
  pickBest: (worldX: number, worldY: number, view?: PickView | null) => string | null;
  /** World-space AABB of `id`, or null. Same as what the selection overlay +
   *  affordance hit-test need. Exposed so SceneCanvas can pass it to the
   *  `affordanceAt` thunk without re-deriving it. */
  boundsOf: (id: string) => import('core/viewport/fitViewToBounds').Bounds | null;
}

export function useSceneSelectTool<TData, TLayer extends string, TPose>(
  args: UseSceneSelectToolArgs<TData, TLayer, TPose>,
): UseSceneSelectToolReturn<TData, TLayer, TPose> {
  const { scene, adapter, geometry, selectTool: opts, getView, alphaOf, layerIsPainted } = args;
  const d = (args.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;

  const pickEveryProp = geometry?.pickEvery;
  const boundsOfProp = geometry?.boundsOf;
  // Default. The pose rect is the wrong answer for anything that isn't a
  // rectangle, so `'pose'` is the opt-out rather than the baseline. Cheap to
  // leave on: the rect pre-filter runs first and rejects every node the
  // pointer isn't over, and the survivors' silhouettes are memoized per node.
  const shapePicking = (geometry?.picking ?? 'shape') === 'shape';
  const pickTolerancePx = geometry?.pickTolerancePx ?? DEFAULT_PICK_TOLERANCE_PX;
  const moveOptions = opts?.move;
  const snap = opts?.snap;

  const wiredMoveOptions = useMemo<UseMoveOptions<TPose>>(() => {
    const merged: UseMoveOptions<TPose> = { ...(moveOptions ?? {}) };
    if (snap) {
      const existing = merged.behaviors ?? [];
      merged.behaviors = [snapBehavior(snap), ...existing];
    }
    return merged;
  }, [moveOptions, snap]);

  // Default pickEvery: walk renderOrder() forward (back-to-front) and collect
  // every node whose pose contains the world point. Order matches the
  // `useSelectTool` contract — last element is the topmost — so `pickTopMostHit`
  // picks correctly. Wraps the caller's `pickEvery` (string-or-null) into the
  // array form `useSelectTool` expects. `poseContainsRotated` reads
  // `pose.rotation` directly (the kit's one rotation convention), so rotated
  // shapes pick against their rendered, rotated body without a per-demo override.
  const wiredHitBody = useMemo(() => {
    return (wx: number, wy: number, view?: PickView | null): string[] => {
      if (pickEveryProp) {
        const r = pickEveryProp(wx, wy);
        if (r == null) return [];
        return Array.isArray(r) ? r : [r];
      }
      // Screen-pixel slop → world units, so the grab zone around an outline
      // stays the same apparent thickness at any zoom.
      // `scale` also resolves a stroke's `{px}` width into world units; without
      // it a pixel width is read as a world width and the reach is wrong at
      // every zoom but 1.
      const scale = meanScale((view ?? getView?.())?.scale ?? { x: 1, y: 1 });
      const viewAlpha = view?.alphaOf ?? alphaOf;
      const viewLayers = view?.layerIsPainted ?? layerIsPainted;
      const tolerance = pickTolerancePx / scale;
      // Through the adapter, not `n.pose`: an ephemeral override is the pose
      // the renderer draws, so it has to be the one picking tests. World, not
      // local, for the same reason — a framed child is drawn in its parent's
      // frame, not where its own pose says.
      const src = scenePickSource<TData, TLayer, TPose>(scene, {
        getPose: (id) => adapter.getWorldPose(id),
        ...(viewAlpha ? { alphaOf: viewAlpha } : {}),
        ...(viewLayers ? { layerIsPainted: viewLayers } : {}),
      });
      return pickWalk<TPose>(src, {
        hits: (n, pose, derived) => {
          // The pre-filter has to be at least as generous as the refinement
          // that follows it, or it rejects points the refinement would have
          // claimed. A stroke reaches past the pose box by `outset` — a whole
          // stroke width for an outer align — on top of the pointer slop.
          const outset = shapePicking
            ? (findShapeInk(n as never, pose, { scale })?.outset ?? 0)
            : 0;
          // A derived node's pose is a placeholder — typically zero-sized at
          // the origin — so its own box rejects every point the path covers.
          // The path is the region to test instead, and `poseContains` already
          // reads a path-like pose as one.
          const admitted = derived
            ? poseContains(derived as never, wx, wy, tolerance + outset, d as PoseDescriptor<unknown>)
            : poseContainsRotated(pose, wx, wy, tolerance + outset, d as PoseDescriptor<unknown>);
          if (!admitted) return false;
          // `shapeCoversPoint` narrows the rect to the ink the painter actually
          // lays down (and answers `true` for painters that have no silhouette,
          // so nothing becomes unpickable).
          return !shapePicking
            || shapeCoversPoint(n as never, pose, wx, wy, {
              tolerance, scale, derivedPath: derived,
            });
        },
        clipAdmits: (clip) => pathContainsPoint(clip, wx, wy),
      });
    };
  }, [scene, adapter, pickEveryProp, shapePicking, pickTolerancePx, getView,
      alphaOf, layerIsPainted, d]);

  const wiredBoundsOf = useMemo(() => {
    return (id: string): Bounds | null => {
      if (boundsOfProp) return boundsOfProp(id);
      const n = scene.get(asNodeId(id));
      if (!n) return null;
      // World, not local: a framed child is drawn in its parent's frame, and
      // the chrome has to land on the ink.
      const pose = adapter.getWorldPose(id);
      const g = poseDescriptorForNode(d, n);
      const b = g.getBounds(pose);
      const rot = g.getRotation?.(pose) ?? (b as { rotation?: number }).rotation ?? 0;
      return rot ? { ...b, rotation: rot } : b;
    };
  }, [scene, adapter, boundsOfProp, d]);

  const selectTool = useSelectTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
    pickEvery: wiredHitBody,
    move: wiredMoveOptions,
    ...(opts?.pickBest ? { pickBest: opts.pickBest } : {}),
    ...(opts?.extendClickLocked ? { extendClickLocked: opts.extendClickLocked } : {}),
  });


  const wiredPickBest = useMemo(() => {
    return (wx: number, wy: number, view?: PickView | null): string | null => {
      const ids = wiredHitBody(wx, wy, view);
      return pickTopMostHit(ids, adapter as unknown as PickTopMostHitAdapter);
    };
  }, [wiredHitBody, adapter]);

  return {
    selectTool,
    pickEvery: wiredHitBody,
    pickBest: wiredPickBest,
    boundsOf: wiredBoundsOf,
  };
}
