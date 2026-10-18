/**
 * Scene-aware select-tool synthesis for `<SceneCanvas>`: a `useSelectTool`
 * over the caller's scene adapter, configured with kit-default pickEvery /
 * boundsOf derived from pose shape. Caller-supplied `pickEvery` / `boundsOf`
 * overrides via the `geometry` arg take precedence.
 */
import { useMemo } from 'react';
import { useKitSetting, useLatest } from '@weasel-js/react';
import type { SceneCanvasAdapter } from '../sceneAdapter';
import { pickWalk, scenePickSource, scenePlaneOf, type ViewPickGates } from 'canvas/pickWalk';
import { rectFromPlane, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import { useSelectTool, type Bounds } from 'tools/builtin/select';
import { pickTopMostHit, type PickTopMostHitAdapter } from 'tools/builtin/pickTopMostHit';
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import { snap as snapBehavior } from 'interactions/gestures/shared/snap';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { drawnBoundsOf } from 'canvas/drawnBounds';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { scenePointQuery } from './scenePointQuery';
import type { SceneCanvasGeometry } from './geometryProps';

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
export interface PickView extends ViewPickGates {
  scale: { x: number; y: number };
  /** The rest of the asking camera. Supplied, it lets a parallax layer be
   *  picked through its plane; left out, every layer is taken to move with
   *  the camera. */
  x?: number;
  y?: number;
}

/** A pick view that names a whole camera, or null. */
function cameraOf(v: Pick<PickView, 'scale' | 'x' | 'y'> | null): View | null {
  return v && typeof v.x === 'number' && typeof v.y === 'number'
    ? { x: v.x, y: v.y, scale: v.scale }
    : null;
}

export interface UseSceneSelectToolArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  /** The adapter the select tool drives, built over `scene` with the same
   *  `poseDescriptor`. Its world poses are what picking and bounds read. */
  adapter: SceneCanvasAdapter<TData, TLayer, TPose>;
  /** How to read and rewrite this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  geometry?: SceneCanvasGeometry;
  /** The surface's camera, for converting the screen-pixel pick tolerance into
   *  world units. A caller picking for another view passes that view's camera
   *  to `pickEvery` / `pickBest` instead. Omitted in tests and non-viewport
   *  hosts, where scale is 1. */
  getView?: () => Pick<PickView, 'scale' | 'x' | 'y'> | null;
  /** The asking view's painted alpha per node — its `alphaFor` times any
   *  per-node override alpha. A node the view paints at alpha 0 is not on
   *  screen, so picking must not answer for it. */
  alphaOf?: (id: string) => number;
  /** The asking view's answer to "does this scene layer reach the screen".
   *  `layerVisibility` and `layerOrder` both gate a layer out of the paint
   *  (`drawLayers` drops any layer missing from a supplied order), and an
   *  undrawn layer must not claim clicks. */
  layerIsPainted?: (layer: string) => boolean;
  /** `<SceneCanvas isPointerInteractive>`: a node it rejects is left out of every hit, so
   *  whatever is beneath it answers instead. */
  isPointerInteractive?: (id: string) => boolean;
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

/** `id` drawn at `pose`, in world, as the chrome boxes it. */
function chromeBox<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  adapter: SceneCanvasAdapter<TData, TLayer, TPose>,
  descriptor: PoseDescriptor<TPose>,
  includeStroke: boolean,
  id: string,
  pose: TPose,
  scale: { x: number; y: number } | undefined,
): Bounds {
  return drawnBoundsOf(scene as never, asNodeId(id), pose, {
    descriptor: descriptor as PoseDescriptor<unknown>,
    worldPoseOf: (m) => adapter.getWorldPose(m),
    includeStroke,
    ...(scale ? { scale } : {}),
  });
}

export interface UseSceneSelectToolReturn<TData, TLayer extends string, TPose> {
  selectTool: ReturnType<typeof useSelectTool<Node<TData, TLayer, TPose>, TPose>>;
  /** Every id under the world point, back-to-front (topmost last), from the
   *  caller's `geometry.pickEvery` or the pose-walk default. */
  pickEvery: (worldX: number, worldY: number, view?: PickView | null) => string[];
  /** Single-best hit under the world point, or null. Runs `pickEvery` then
   *  collapses parent/child overlap via `pickTopMostHit` — matches the id
   *  the select tool's pointerdown classifier would settle on for a bare
   *  click. The canvas's `getNodeAtPoint` resolves through it. */
  pickBest: (worldX: number, worldY: number, view?: PickView | null) => string | null;
  /** World-space AABB of `id`, or null. Same as what the selection overlay +
   *  affordance hit-test need. Exposed so SceneCanvas can pass it to the
   *  `affordanceAt` thunk without re-deriving it. `view` is the camera the
   *  box is drawn under — a plane node sits somewhere else in each — and
   *  defaults to the surface's. */
  boundsOf: (id: string, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null) =>
    import('core/viewport/fitViewToBounds').Bounds | null;
  /** How `view`'s world (the surface's camera by default) maps into the plane
   *  `id` is drawn through, or null when its layer moves with the camera. */
  planeOfNode: (id: string, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null) => PlaneMap | null;
  /** `boundsOf` for `id` drawn at `pose` rather than its own — how chrome
   *  boxes an in-flight preview. Ignores a `geometry.boundsOf` override, which
   *  answers only for a node's own pose. */
  boundsOfPose: (id: string, pose: TPose, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null) =>
    import('core/viewport/fitViewToBounds').Bounds | null;
  /** `selectTool.move` with `selectTool.snap` folded into its behaviors — what
   *  the `move` preset's bindings carry. */
  moveOptions: UseMoveOptions<TPose>;
}

export function useSceneSelectTool<TData, TLayer extends string, TPose>(
  args: UseSceneSelectToolArgs<TData, TLayer, TPose>,
): UseSceneSelectToolReturn<TData, TLayer, TPose> {
  const { scene, adapter, geometry, selectTool: opts, getView, alphaOf, layerIsPainted, isPointerInteractive } = args;
  const d = (args.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;

  const pickEveryProp = geometry?.pickEvery;
  const boundsOfProp = geometry?.boundsOf;
  // Default. The pose rect is the wrong answer for anything that isn't a rectangle, so `'pose'`
  // is the opt-out rather than the baseline. Cheap to leave on: the rect pre-filter rejects every
  // node the pointer isn't over first, and the survivors' silhouettes are memoized per node.
  const shapePicking = (geometry?.picking ?? 'shape') === 'shape';
  const kitPickTolerancePx = useKitSetting('targets.pickTolerancePx');
  const pickTolerancePx = geometry?.pickTolerancePx ?? kitPickTolerancePx ?? DEFAULT_PICK_TOLERANCE_PX;
  const includeStroke = geometry?.boundsIncludeStroke ?? true;
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

  const wiredHitBody = usePointPick({
    scene, adapter, d, pickEveryProp, shapePicking, pickTolerancePx, getView,
    alphaOf, layerIsPainted, isPointerInteractive,
  });

  // Read through a ref: this is the chrome's bounds source, and a caller's
  // inline `getView` would otherwise rebuild it, and everything keyed on it,
  // every render.
  const getViewRef = useLatest(getView);
  const wiredPlaneOfNode = useMemo(() => {
    return (id: string, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null): PlaneMap | null => {
      const n = scene.get(asNodeId(id));
      const camera = cameraOf(view ?? getViewRef.current?.() ?? null);
      if (!n || !camera) return null;
      return scenePlaneOf(scene.layers, camera)?.(n.layer) ?? null;
    };
  }, [scene, getViewRef]);

  const wiredBoundsOfPose = useMemo(() => {
    return (id: string, pose: TPose, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null): Bounds | null => {
      if (!scene.get(asNodeId(id))) return null;
      const scale = (view ?? getViewRef.current?.() ?? null)?.scale;
      const own = chromeBox(scene, adapter, d, includeStroke, id, pose, scale);
      // A plane node is drawn where its plane puts it, and the chrome has to
      // follow it there.
      const plane = wiredPlaneOfNode(id, view);
      return plane ? rectFromPlane(plane, own) : own;
    };
  }, [scene, adapter, d, includeStroke, getViewRef, wiredPlaneOfNode]);

  const wiredBoundsOf = useMemo(() => {
    return (id: string, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null): Bounds | null => {
      if (boundsOfProp) return boundsOfProp(id);
      if (!scene.get(asNodeId(id))) return null;
      // World, not local: a framed child is drawn in its parent's frame, and
      // the chrome has to land on the ink.
      return wiredBoundsOfPose(id, adapter.getWorldPose(id), view);
    };
  }, [scene, adapter, boundsOfProp, wiredBoundsOfPose]);

  const selectTool = useSelectTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
    pickEvery: wiredHitBody,
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
    boundsOfPose: wiredBoundsOfPose,
    planeOfNode: wiredPlaneOfNode,
    moveOptions: wiredMoveOptions,
  };
}

/** Every id under a world point, back-to-front: the caller's `geometry.pickEvery` or the pose
 *  walk, less whatever `isPointerInteractive` rejects. */
function usePointPick<TData, TLayer extends string, TPose>(args: {
  scene: Scene<TData, TLayer, TPose>;
  adapter: SceneCanvasAdapter<TData, TLayer, TPose>;
  d: PoseDescriptor<TPose>;
  pickEveryProp: SceneCanvasGeometry['pickEvery'];
  shapePicking: boolean;
  pickTolerancePx: number;
  getView: UseSceneSelectToolArgs<TData, TLayer, TPose>['getView'];
  alphaOf: ((id: string) => number) | undefined;
  layerIsPainted: ((layer: string) => boolean) | undefined;
  isPointerInteractive: ((id: string) => boolean) | undefined;
}): (wx: number, wy: number, view?: PickView | null) => string[] {
  const {
    scene, adapter, d, pickEveryProp, shapePicking, pickTolerancePx, getView,
    alphaOf, layerIsPainted, isPointerInteractive,
  } = args;
  // Default pickEvery: walk renderOrder() forward (back-to-front) and collect
  // every node whose pose contains the world point. Order matches the
  // `useSelectTool` contract — last element is the topmost — so `pickTopMostHit`
  // picks correctly. Wraps the caller's `pickEvery` (string-or-null) into the
  // array form `useSelectTool` expects. `poseContainsRotated` reads
  // `pose.rotation` directly (the kit's one rotation convention), so rotated
  // shapes pick against their rendered, rotated body without a per-demo override.
  const walk = useMemo(() => {
    return (wx: number, wy: number, view?: PickView | null): string[] => {
      if (pickEveryProp) {
        const r = pickEveryProp(wx, wy);
        if (r == null) return [];
        return Array.isArray(r) ? r : [r];
      }
      const asked = view ?? getView?.() ?? null;
      const viewAlpha = view?.alphaOf ?? alphaOf;
      const viewLayers = view?.layerIsPainted ?? layerIsPainted;
      const camera = cameraOf(asked);
      // Through the adapter, not `n.pose`: an ephemeral override is the pose
      // the renderer draws, so it has to be the one picking tests. World, not
      // local, for the same reason — a framed child is drawn in its parent's
      // frame, not where its own pose says.
      const src = scenePickSource<TData, TLayer, TPose>(scene, {
        getPose: (id) => adapter.getWorldPose(id),
        ...(viewAlpha ? { alphaOf: viewAlpha } : {}),
        ...(viewLayers ? { layerIsPainted: viewLayers } : {}),
        ...(camera ? { camera } : {}),
      });
      const pointQuery = scenePointQuery<TPose>(d as PoseDescriptor<unknown>, shapePicking, pickTolerancePx);
      return pickWalk<TPose>(src, pointQuery(wx, wy, asked?.scale ?? { x: 1, y: 1 }));
    };
  }, [scene, adapter, pickEveryProp, shapePicking, pickTolerancePx, getView,
      alphaOf, layerIsPainted, d]);
  const wiredHitBody = useMemo(() => {
    if (!isPointerInteractive) return walk;
    return (wx: number, wy: number, view?: PickView | null): string[] =>
      walk(wx, wy, view).filter((id) => isPointerInteractive(id) !== false);
  }, [walk, isPointerInteractive]);
  return wiredHitBody;
}
