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
import { useSelectTool, type Bounds } from 'tools/builtin/useSelectTool';
import { useRotateTool } from 'tools/builtin/useRotateTool';
import type { Node, Scene, NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { UseRotateOptions } from 'interactions/actions/rotate/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import type { UseAreaSelectOptions } from 'interactions/actions/area-select/options';
import { snap as snapBehavior } from 'interactions/gestures/shared/snap';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import { aabbOfPose, isPathLike, poseContainsRotated } from './poseGeometry';

export interface UseSceneSelectToolArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  selection: SelectionApi;
  geometry?: {
    pickEvery?: (worldX: number, worldY: number) => string | null;
    boundsOf?: (id: string) => Bounds | null;
  };
  selectTool?: {
    move?: UseMoveOptions<TPose>;
    resize?: UseResizeOptions<TPose>;
    rotate?: UseRotateOptions<TPose>;
    snap?: SnapStrategy<TPose>;
    handleHitRadius?: number;
    areaSelect?: UseAreaSelectOptions;
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
  /** World-space AABB of `id`, or null. Same as what the selection overlay +
   *  affordance hit-test need. Exposed so SceneCanvas can pass it to the
   *  `affordanceAt` thunk without re-deriving it. */
  boundsOf: (id: string) => import('core/viewport/fitViewToBounds').Bounds | null;
}

export function useSceneSelectTool<TData, TLayer extends string, TPose>(
  args: UseSceneSelectToolArgs<TData, TLayer, TPose>,
): UseSceneSelectToolReturn<TData, TLayer, TPose> {
  const { scene, selection, geometry, selectTool: opts, insertTool, layouts } = args;

  const pickEveryProp = geometry?.pickEvery;
  const boundsOfProp = geometry?.boundsOf;
  const moveOptions = opts?.move;
  const resizeOptions = opts?.resize;
  const rotateOptions = opts?.rotate;
  const snap = opts?.snap;
  const handleHitRadius = opts?.handleHitRadius;
  const areaSelectOptions = opts?.areaSelect;
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
            const cp = cn.pose as unknown as { x: number; y: number };
            base.setPose(cid, { ...(cn.pose as object), x: cp.x + dx, y: cp.y + dy } as unknown as TPose);
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
        for (const nid of scene.renderOrder()) {
          const n = scene.get(nid);
          if (!n) continue;
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

  // Default pickEvery: walk renderOrder() back-to-front (top-most first) and
  // return the first node whose pose contains the world point. Wraps the
  // caller's `pickEvery` (string-or-null) into the array form `useSelectTool`
  // expects. When the configured resize geometry exposes `getRotation`, the
  // shared `poseContainsRotated` projects the click into the pose's local
  // frame so rotated rects pick correctly without a per-demo override.
  const getRotation = resizeOptions?.geometry?.getRotation;
  const wiredHitBody = useMemo(() => {
    return (wx: number, wy: number): string[] => {
      if (pickEveryProp) {
        const id = pickEveryProp(wx, wy);
        return id ? [id] : [];
      }
      const ordered = [...scene.renderOrder()];
      for (let i = ordered.length - 1; i >= 0; i--) {
        const n = scene.get(ordered[i]);
        if (n && poseContainsRotated(n.pose, wx, wy, getRotation)) return [n.id];
      }
      return [];
    };
  }, [scene, pickEveryProp, getRotation]);

  const wiredBoundsOf = useMemo(() => {
    return (id: string): Bounds | null => {
      if (boundsOfProp) return boundsOfProp(id);
      const n = scene.get(asNodeId(id));
      if (!n) return null;
      const b = aabbOfPose(n.pose);
      // Surface rotation to the overlay directly from the pose. Independent
      // of any gesture-side descriptor (notably `selectTool.resize.geometry`,
      // which the rotated-resize math demo deliberately subverts to
      // demonstrate counterexamples — the overlay must keep showing the
      // rect's true rotation regardless).
      const rot = (n.pose as { rotation?: number }).rotation;
      return rot ? { ...b, rotation: rot } : b;
    };
  }, [scene, boundsOfProp]);

  const selectTool = useSelectTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
    pickEvery: wiredHitBody,
    boundsOf: wiredBoundsOf,
    move: wiredMoveOptions,
    ...(areaSelectOptions ? { areaSelect: areaSelectOptions } : {}),
    getNode: (id: string) => scene.get(asNodeId(id)) ?? null,
    getSelection: () => selection.current,
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

  return {
    adapter: adapter as UseSceneSelectToolReturn<TData, TLayer, TPose>['adapter'],
    selectTool,
    rotateTool,
    pickEvery: wiredHitBody,
    boundsOf: wiredBoundsOf,
  };
}
