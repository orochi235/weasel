/**
 * Synthesize a `<Canvas>`-compatible adapter from a `Scene` primitive.
 * `getPose` / `setPose` return / write **local** coordinates (relative to
 * parent); world composition is the renderer's job via `composeWorldPose`.
 */
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
import { nodeGates } from 'core/scene/nodeGates';
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
import { composesFrames, composeWorldPose, frameAtOrAbove } from 'core/scene/composePose';
import type { Bounds } from '../core/viewport/fitViewToBounds';
import { scenePoseTarget } from '../animation/poseTarget';
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
  // Optional on the underlying adapter contracts, but unconditionally
  // provided by a scene-backed adapter.
  & {
      getParent(id: string): string | null;
      getLayers: NonNullable<LayerEnumerableAdapter<TLayer>['getLayers']>;
      /** The node's pose with every ancestor's frame folded in. Equal to
       *  `getPose` unless the scene composes poses. */
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
      /** Retarget a derived node's sources — what a `setDependsOn` op writes through. */
      setDependsOn(id: string, dependsOn: readonly string[] | 'children' | undefined): void;
      /** Hide or show a node — what a `setHidden` op writes through. */
      setHidden(id: string, hidden: boolean): void;
      /** Lock or unlock a node — what a `setLocked` op writes through. */
      setLocked(id: string, locked: boolean): void;
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
  /** Selection source: the result of `useSelection()` (or its
   *  `adapterMethods`). When omitted, `getSelection` returns `[]` and
   *  `setSelection` is a noop, so the marquee gesture updates nothing. */
  selection?: SceneAdapterSelection;
  /** How to read and rewrite this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
}

/** Derive the adapter for a scene. Reads go straight to the scene; writes are
 *  ops applied through its history, so anything done through the adapter is
 *  undoable.
 *
 *  Moving a container carries its contents either way the scene composes
 *  poses. Under a frame (`scene.composition`) the one pose written moves them.
 *  Under the absolute-pose model `setPose` on a container translates every
 *  descendant by the same delta, and a batch that poses descendants too undoes
 *  exactly only when it goes through this adapter's `applyOps`. */
export function sceneToAdapter<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: SceneToAdapterOptions<TData, TLayer, TPose> = {},
): SceneCanvasAdapter<TData, TLayer, TPose> {
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

  const composition = scene.composition;
  const composes = composesFrames(composition);
  const pickOpts: ScenePickSourceOptions<unknown> = {};
  // The asking view's layer gate and camera, over the adapter's own options.
  const pickOptsFor = (view: RegionPickView | undefined): ScenePickSourceOptions<unknown> =>
    (view ? { ...pickOpts, ...regionPickOptions(view, undefined) } : pickOpts);

  const cascade = composes ? null : { setPose: cascadingSetPose(scene, d) };

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
    // the nodes not hidden, and the effective pose.
    getNodes() {
      const gates = nodeGates(scene);
      return scene.renderOrderNodes().filter((n) => !gates.hidden(n.id));
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
      return composeWorldPose(adapter, id, composition.compose);
    },
    // Only present when it would do something: the render walk skips the fold
    // entirely when this is absent, which is the absolute-pose path.
    ...(composes ? { composePose: composition.compose } : {}),
    ...(cascade ? { setPose: (id: string, pose: TPose) => cascade.setPose(asNodeId(id), pose) } : {}),
    poseTarget(id, descriptor) {
      if (cascade === null || scene.get(asNodeId(id))?.kind !== 'container') {
        return scenePoseTarget(scene, id, descriptor ?? d);
      }
      // Its descendants hold poses of their own: a commit moves them, and they are shown beside it.
      const carried = containerCascade(scene, asNodeId(id), d, (pose) => adapter.setPose(id, pose));
      return scenePoseTarget(scene, id, descriptor ?? d, carried);
    },
    getLayers: () => scene.layers.map((l) => ({ id: l.id, visible: l.visible, parallax: l.parallax })),
    subscribeLayers: (listener) => scene.subscribe(listener),
    getLayout: (id) => scene.layoutOf(asNodeId(id)),
    // With a label the ops are one batch checkpoint; without one they are
    // applied transiently, with no checkpoint (the AreaSelectAdapter contract).
    applyOps(ops: Op[], label?: string) {
      if (label !== undefined) {
        scene.applyBatch(ops, label, this);
      } else {
        applyOpsTo(this, ops);
      }
    },
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
    // A pure factory: it constructs a Node spec but does NOT touch the scene.
    // The `InsertOp` → `adapter.insertNode` → `scene.add` path is the sole
    // insertion path. Calling `scene.add` here too would double-insert, and
    // the second add throws on id collision.
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
