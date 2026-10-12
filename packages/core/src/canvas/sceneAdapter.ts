/**
 * Synthesize a `<Canvas>`-compatible adapter from a `Scene` primitive.
 *
 * The Scene owns nodes/poses/parenting and auto-records ops on every mutation.
 * `<SceneCanvas>` calls `sceneToAdapter(scene)` and forwards the result to
 * `<Canvas>`'s `adapter` prop. Selection and hit-testing are not part of the
 * Scene model — Canvas's internal `useSelection` and pose-derived pickEvery
 * cover those.
 *
 * Pose semantics match the rest of the kit: `getPose` / `setPose` return /
 * write **local** coordinates (relative to parent). The Scene stores pose on
 * each node directly; world composition (when needed) is the renderer's job
 * via `composeWorldPose`, not the adapter's.
 */
import { useMemo } from 'react';
import type {
  AreaSelectAdapter,
  ClipboardSnapshot,
  InsertAdapter,
  PasteCtx,
  LassoHitMode,
  LassoSelectAdapter,
  RegionPickView,
  LayerEnumerableAdapter,
  MoveAdapter,
  ResizeAdapter,
  RotateAdapter,
} from 'core/adapters/types';
import type { LayoutStrategy } from '../layout/types';
import type { Op } from 'core/ops/types';
import type { Node, Scene } from 'core/scene/types';
import { definesFrame, effectivePose } from 'core/scene/effectivePose';
import { sceneMutators } from 'core/scene/sceneMutators';
import { asNodeId } from 'core/scene/types';
import { applyOpsTo } from 'core/applyOps';
import { hitTestArea, hitTestLassoPolygon, regionPickOptions } from 'canvas/deps/hitTestArea';
import type { ScenePickSourceOptions } from 'canvas/pickWalk';
import {
  poseDescriptorForNode,
  translatePoseViaDescriptor,
  visualBoundsViaDescriptor,
  type PoseDescriptor,
} from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { composeWorldPose, frameAtOrAbove, type PoseComposition } from 'core/scene/composePose';
import type { Bounds } from '../core/viewport/fitViewToBounds';
import { scenePoseTarget } from '../animation/poseTarget';
import { cascadeRecord } from './cascadeRecord';
import { cascadingSetPose, containerCascade } from './poseCascade';
import { pasteSceneSnapshot, snapshotSceneSelection, type SceneClipboardEnv } from './sceneClipboard';

/** Minimal selection contract `sceneToAdapter` needs to wire `getSelection` /
 *  `setSelection`. Matches `useSelection().adapterMethods` plus an imperative
 *  read; pass `useSelection()` itself or `selection.adapterMethods`. */
export interface SceneAdapterSelection {
  get?(): string[];
  set?(ids: string[]): void;
  getSelection?(): string[];
  setSelection?(ids: string[]): void;
}

/** Sibling z-order surface used by reorder ops. Inlined here (rather than
 *  pulled from `core/ops/reorder` to avoid import cycles); the `null` parent
 *  channel addresses the root sibling list. */
/** @internal */
interface ReorderAdapter {
  getChildren(parentId: string | null): string[];
  setChildOrder(parentId: string | null, ids: string[]): void;
}

/** Everything the interaction layer can ask of a scene, as one type: the
 *  move, resize, rotate, selection, layer and reorder contracts combined.
 *  `<SceneCanvas>` synthesizes one of these, which is why most consumers never
 *  touch an adapter directly. */
export type SceneCanvasAdapter<TData, TLayer extends string, TPose> =
  & MoveAdapter<Node<TData, TLayer, TPose>, TPose>
  & ResizeAdapter<Node<TData, TLayer, TPose>, TPose>
  & RotateAdapter<Node<TData, TLayer, TPose>, TPose>
  & AreaSelectAdapter
  & LassoSelectAdapter
  & LayerEnumerableAdapter<TLayer>
  & ReorderAdapter
  & Partial<InsertAdapter<Node<TData, TLayer, TPose>>>
  // Tighten the parts that are optional on the underlying adapter contracts
  // but unconditionally provided by a scene-backed adapter. Anything that
  // routes scene mutations through this adapter (kit InsertOps, hierarchical
  // hooks like useNest, etc.) can rely on these being present.
  & {
      getParent(id: string): string | null;
      /** The node's pose with every ancestor's frame folded in. Equal to
       *  `getPose` unless a `poseComposition` is configured. */
      getWorldPose(id: string): TPose;
      /** Whether `id`'s pose is a frame its children are expressed in — see
       *  `definesFrame`. */
      definesFrame(id: string): boolean;
      /** Present only when a composing strategy is configured; the render
       *  walk feature-detects it. */
      composePose?(parent: TPose, child: TPose): TPose;
      getSelection(): string[];
      setSelection(ids: string[]): void;
      insertNode(node: Node<TData, TLayer, TPose>, index?: number): void;
      removeNode(id: string): void;
      /** Replace a node's `data` — what a `setData` op writes through. */
      setData(id: string, data: TData): void;
      /** Swap a container's layout — what a `setLayout` op writes through. */
      setLayout(id: string, layout: LayoutStrategy<TPose> | string | null): void;
      /** Move a node to another layer — what a `setLayer` op writes through. */
      setLayer(id: string, layer: TLayer): void;
      getRemovalClosure(ids: readonly string[]): string[];
      applyOps(ops: Op[], label?: string): void;
      snapshotSelection(ids: string[]): ClipboardSnapshot;
      commitPaste(
        clipboard: ClipboardSnapshot,
        offset: { dx: number; dy: number },
        ctx?: PasteCtx,
      ): Node<TData, TLayer, TPose>[];
      getPasteOffset(clipboard: ClipboardSnapshot): { dx: number; dy: number };
    };

/** Optional extras for the synthesized adapter. Pass `commitInsert` to wire
 *  the insert gesture into a Scene-owned canvas; the returned object becomes
 *  a leaf on the layer named by `layer` (default `'default'`). */
export interface SceneToAdapterOptions<TData, TLayer extends string, TPose> {
  /** Factory for new objects. Returning `null` aborts the insert. */
  commitInsert?: (bounds: Bounds) => {
    pose: TPose;
    data: TData;
    id?: string;
  } | null;
  /** Layer to place inserted nodes on. Defaults to the trivial-form layer. */
  insertLayer?: TLayer;
  /** Selection source for `AreaSelectAdapter.getSelection` / `setSelection`.
   *  Pass the result of `useSelection()` (or its `adapterMethods`). When
   *  omitted, `getSelection` returns `[]` and `setSelection` is a noop —
   *  fine for read-only or selection-less canvases, but the marquee gesture
   *  won't update any external selection state. */
  selection?: SceneAdapterSelection;
  /** How to read and rewrite this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  /** Layout strategies keyed by container node id, for containers whose
   *  scene node declares none (`ContainerNode.layout` wins). `move` runs its
   *  layout-aware pass on them; for inserts, deletes and resizes to reach
   *  them too, install them with `useLayoutArrivals`. Pass either a static
   *  map, or a `getLayout(id)` function for dynamic resolution. */
  layouts?:
    | Record<string, LayoutStrategy<TPose>>
    | ((containerId: string) => LayoutStrategy<TPose> | null);
  /** When true, `setPose` on a container translates every descendant by the
   *  same delta, through the pose descriptor. Scene v1 stores absolute poses,
   *  so without it children stay behind. A batch that poses descendants too
   *  undoes exactly only when it goes through this adapter's `applyOps`. */
  cascadeContainerPose?: boolean;
  /** How a child's stored pose folds into its parent's frame. Omit for the
   *  absolute-pose model, where a parent contributes no transform. Supplying a
   *  composing strategy makes a container's pose a **frame**: rotating the
   *  container rotates its contents, and `setPose` on it must not also
   *  translate them, so it cannot be combined with `cascadeContainerPose`. */
  poseComposition?: PoseComposition<TPose>;
}

/** Derive the adapter for a scene. Reads go straight to the scene; writes are
 *  ops applied through its history, so anything done through the adapter is
 *  undoable. */
export function sceneToAdapter<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: SceneToAdapterOptions<TData, TLayer, TPose> = {},
): SceneCanvasAdapter<TData, TLayer, TPose> {
  const visibleLayers = (): Set<TLayer> => {
    const out = new Set<TLayer>();
    for (const layer of scene.layers) {
      if (layer.visible) out.add(layer.id);
    }
    return out;
  };

  const sel = options.selection;
  const getSelection = sel?.getSelection ?? sel?.get ?? (() => [] as string[]);
  const setSelection = sel?.setSelection ?? sel?.set ?? (() => {});
  const d = (options.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const poseBounds = (p: TPose, node: unknown): Bounds =>
    visualBoundsViaDescriptor(p, poseDescriptorForNode(d, node));
  const translate = (p: TPose, dx: number, dy: number, node?: unknown): TPose =>
    translatePoseViaDescriptor(
      p, dx, dy, node === undefined ? d : poseDescriptorForNode(d, node),
    );

  const composition = options.poseComposition;
  const composes = composition !== undefined && composition.closure !== 'identity';
  const pickOpts: ScenePickSourceOptions<unknown> = composition
    ? { poseComposition: composition as PoseComposition<unknown> }
    : {};
  // The asking view's layer gate and camera, over the adapter's own options.
  const pickOptsFor = (view: RegionPickView | undefined): ScenePickSourceOptions<unknown> =>
    (view ? { ...pickOpts, ...regionPickOptions(view, undefined, undefined) } : pickOpts);
  if (composes && options.cascadeContainerPose) {
    throw new Error(
      'sceneToAdapter: poseComposition and cascadeContainerPose contradict each other. ' +
      'Under a composing strategy a child\'s pose is already relative to its parent, so ' +
      'the cascade would move every descendant twice. Drop cascadeContainerPose.',
    );
  }

  const record = options.cascadeContainerPose ? cascadeRecord<TPose>(scene) : null;
  const cascade = record && { record, setPose: cascadingSetPose(scene, d, record) };

  const clipboardEnv: SceneClipboardEnv<TData, TLayer, TPose> = {
    scene,
    composes,
    worldPoseOf: (id) => adapter.getWorldPose(id),
    frameAtOrAbove: (id) => frameAtOrAbove(adapter, id),
    poseBounds,
    translate,
  };

  const adapter: SceneCanvasAdapter<TData, TLayer, TPose> = {
    ...sceneMutators(scene),
    // What is shown, where the mutators' other users read the document:
    // visible layers only, and the effective pose.
    getNodes() {
      const visible = visibleLayers();
      const out: Node<TData, TLayer, TPose>[] = [];
      for (const n of scene.renderOrderNodes()) {
        if (visible.has(n.layer)) out.push(n);
      }
      return out;
    },
    getPose(id) {
      const nid = asNodeId(id);
      const n = scene.get(nid);
      if (!n) throw new Error(`sceneToAdapter: unknown node "${id}"`);
      return effectivePose(scene, n);
    },
    definesFrame(id) {
      const n = scene.get(asNodeId(id));
      return n === undefined || definesFrame(n);
    },
    getWorldPose(id) {
      if (!composes) return adapter.getPose(id);
      return composeWorldPose(adapter, id, composition!.compose);
    },
    // Only present when it would do something: the render walk skips the fold
    // entirely when this is absent, which is the absolute-pose path.
    ...(composes ? { composePose: composition!.compose } : {}),
    ...(cascade ? { setPose: (id: string, pose: TPose) => cascade.setPose(asNodeId(id), pose) } : {}),
    poseTarget(id, descriptor) {
      if (!options.cascadeContainerPose || scene.get(asNodeId(id))?.kind !== 'container') {
        return scenePoseTarget(scene, id, descriptor ?? d);
      }
      // Its descendants hold poses of their own: a commit moves them, and they are shown beside it.
      const cascade = containerCascade(scene, asNodeId(id), d, (pose) => adapter.setPose(id, pose));
      return scenePoseTarget(scene, id, descriptor ?? d, cascade);
    },
    getLayers() {
      return scene.layers.map((l) => ({ id: l.id, visible: l.visible, parallax: l.parallax }));
    },
    getLayout(id) {
      const declared = scene.layoutOf(asNodeId(id));
      if (declared !== null || !options.layouts) return declared;
      return typeof options.layouts === 'function'
        ? options.layouts(id)
        : options.layouts[id] ?? null;
    },
    // Unified applyOps: when a label is supplied the ops are wrapped in a
    // batch checkpoint (history-aware path used by Move/Resize/Rotate/Insert/
    // Delete tools). When a journal is active (via scene's getActiveJournal
    // option), scene.applyBatch routes to the journal instead of recording a
    // new parent-history entry. Without a label the ops are applied transiently
    // via applyOpsTo (AreaSelectAdapter contract — no checkpoint).
    applyOps(ops: Op[], label?: string) {
      if (label !== undefined) {
        scene.applyBatch(cascade ? cascade.record.recorded(ops) : ops, label, this);
      } else {
        applyOpsTo(this, ops);
      }
    },
    // AreaSelectAdapter surface — included unconditionally so plain
    // `useSelectTool(sceneToAdapter(scene, { selection }))` Just Works for the
    // marquee gesture. `applyOps` (above) dispatches transiently when called
    // without a label, matching the AreaSelectAdapter contract.
    getSelection,
    setSelection,
    // The live marquee's and lasso's own hit-tests. Containers come back:
    // this adapter's consumer has nothing to fold children into them.
    hitTestArea(rect: Bounds, view?: RegionPickView) {
      return hitTestArea(
        scene,
        rect,
        pickOptsFor(view),
        d as PoseDescriptor<unknown>,
        { includeContainers: true },
      );
    },
    hitTestLasso(polygon, mode: LassoHitMode, view?: RegionPickView) {
      return hitTestLassoPolygon(
        scene,
        polygon,
        mode,
        pickOptsFor(view),
        d as PoseDescriptor<unknown>,
        { includeContainers: true },
      );
    },
    // commitInsert (gesture-time leaf insert) is opt-in: present only when
    // `options.commitInsert` is. The full insertNode/removeNode mutators
    // above are always present so kit-side InsertOp / DeleteOp round-trip
    // through scene.add / scene.remove regardless.
    //
    // Contract: this is a pure factory — it constructs a Node spec but does
    // NOT touch the scene. `useInsert`'s onEnd dispatches an `InsertOp`
    // whose apply() calls `adapter.insertNode` → `scene.add`, which is the
    // sole insertion path. Calling `scene.add` here too would double-insert,
    // and the second add throws on id collision (silently dropping the
    // gesture's pointer-up cleanup and breaking the next drag).
    ...(options.commitInsert
      ? {
          commitInsert: (bounds: { x: number; y: number; width: number; height: number }) => {
            const created = options.commitInsert!(bounds);
            if (!created) return null;
            const layer = (options.insertLayer ?? ('default' as TLayer));
            const id = created.id === undefined ? scene.mintId() : asNodeId(created.id);
            return {
              kind: 'leaf',
              id,
              layer,
              pose: created.pose,
              data: created.data,
              parent: null,
            } as Node<TData, TLayer, TPose>;
          },
        }
      : {}),
    // Clipboard seam (`useClipboardOps` / the paste ingestion path).
    snapshotSelection(ids: string[]): ClipboardSnapshot {
      return snapshotSceneSelection(clipboardEnv, ids);
    },
    commitPaste(
      clipboard: ClipboardSnapshot,
      offset: { dx: number; dy: number },
      ctx?: PasteCtx,
    ): Node<TData, TLayer, TPose>[] {
      return pasteSceneSnapshot(clipboardEnv, clipboard, offset, ctx);
    },
    // Constant cascade: the hook re-snapshots the just-created items, so
    // repeated pastes stack +12/+12 each time.
    getPasteOffset(): { dx: number; dy: number } {
      return { dx: 12, dy: 12 };
    },
  };

  return adapter;
}

/**
 * React-hook wrapper around `sceneToAdapter`. Memoizes on every option, so
 * the adapter keeps its identity across renders unless one of them changes.
 */
export function useSceneAdapter<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: SceneToAdapterOptions<TData, TLayer, TPose> = {},
): SceneCanvasAdapter<TData, TLayer, TPose> {
  const {
    selection, commitInsert, insertLayer, layouts, poseDescriptor, cascadeContainerPose, poseComposition,
  } = options;
  return useMemo(
    () => sceneToAdapter(scene, {
      selection, commitInsert, insertLayer, layouts, poseDescriptor, cascadeContainerPose, poseComposition,
    }),
    [scene, selection, commitInsert, insertLayer, layouts, poseDescriptor, cascadeContainerPose, poseComposition],
  );
}
