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
import type {
  AreaSelectAdapter,
  InsertAdapter,
  LassoHitMode,
  LassoSelectAdapter,
  LayerEnumerableAdapter,
  MoveAdapter,
  ResizeAdapter,
  RotateAdapter,
} from 'core/adapters/types';
import type { LayoutStrategy } from '../layout/types';
import type { Op } from 'core/ops/types';
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { applyOpsTo } from 'core/applyOps';
import {
  polygonContainsRect,
  polygonContainsRectCenter,
  polygonIntersectsRect,
} from 'features/paths/polygonHitTestRect';
import type { Path } from 'features/paths/types';
import { pathIntersectsRect } from 'features/paths/pathHitTest';
import { translateRectPose } from 'features/groups/composePose';

interface Bounds { x: number; y: number; width: number; height: number; }

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
interface ReorderAdapter {
  getChildren(parentId: string | null): string[];
  setChildOrder(parentId: string | null, ids: string[]): void;
}

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
  // hooks like useNestedGroup, etc.) can rely on these being present.
  & {
      getParent(id: string): string | null;
      getSelection(): string[];
      setSelection(ids: string[]): void;
      insertNode(node: Node<TData, TLayer, TPose>): void;
      removeNode(id: string): void;
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
  /** Project a pose to an AABB for `hitTestArea`. Default: identity (works
   *  when TPose carries top-level x/y/width/height). Override for non-rect
   *  poses. */
  poseBounds?: (pose: TPose) => Bounds;
  /** Layout strategies keyed by container node id. When a container is
   *  configured here, `move` runs its layout-aware pass on drag (reflow on
   *  enter, reflow leftovers on exit, reparent + write reflowed poses on
   *  commit). Containers without an entry behave as plain parents. Pass
   *  either a static map, or a `getLayout(id)` function for dynamic
   *  resolution. */
  layouts?:
    | Record<string, LayoutStrategy<TPose>>
    | ((containerId: string) => LayoutStrategy<TPose> | null);
  /** When set, `setPose(id, ...)` on a container node cascades the translation
   *  to every descendant. Scene v1 stores absolute poses, so dragging a
   *  container needs to translate its children to keep them visually attached
   *  to their parent. Pass `'rect'` to use the built-in `translateRectPose`
   *  (works for any `TPose extends { x: number; y: number }`); pass a custom
   *  `(pose, dx, dy) => pose` for non-rect pose shapes. Omit to leave setPose
   *  primitive — containers move but their descendants don't follow. */
  cascadeContainerPose?: 'rect' | ((pose: TPose, dx: number, dy: number) => TPose);
}

// ─── Clip-aware hierarchical walk ────────────────────────────────────────────

/**
 * Test whether a node's bounds pass all accumulated ancestor clips.
 * A clip "passes" for a child when the child's bounds intersect the clip
 * region — i.e., some part of the child is visible through the clip.
 */
function nodeBoundsPassClips(
  clips: readonly Path[],
  bounds: Bounds,
): boolean {
  for (const clip of clips) {
    if (!pathIntersectsRect(clip, bounds)) return false;
  }
  return true;
}

/**
 * Walk the scene tree hierarchically (roots → children via DFS), evaluating
 * each node against a geometry callback. When a container has `clipFromPose`,
 * the clip is evaluated once for that container and accumulated into an
 * ancestor-clip chain: descendants whose bounds don't intersect any ancestor
 * clip are excluded from results even if they satisfy the geometry callback.
 *
 * Containers are gated on ancestor clips before their own geometry test —
 * consistent with leaves. A container whose AABB doesn't pass the enclosing
 * grandparent clip is not included, and neither are its children.
 */
function walkClipAware<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  poseBounds: (pose: TPose) => Bounds,
  nodeTest: (node: Node<TData, TLayer, TPose>) => boolean,
): string[] {
  const results: string[] = [];

  // `ancestorClips` accumulates clip paths from parent containers.
  // Each entry is computed exactly once when visiting that container.
  function walk(nodeId: string, ancestorClips: readonly Path[]): void {
    const node = scene.get(asNodeId(nodeId));
    if (!node) return;

    if (node.kind === 'container') {
      // Gate the container on ancestor clips first, same as leaves.
      // A container outside its grandparent's clip is invisible — exclude it
      // and skip its children entirely.
      if (ancestorClips.length > 0) {
        const b = poseBounds(node.pose);
        if (!nodeBoundsPassClips(ancestorClips, b)) return;
      }

      // Test this container's own geometry.
      if (nodeTest(node)) results.push(nodeId);

      // Compute this container's clip exactly once per query visit.
      const childClips: readonly Path[] =
        typeof node.clipFromPose === 'function'
          ? (() => {
              const clip = node.clipFromPose(node.pose);
              return clip !== null ? [...ancestorClips, clip] : ancestorClips;
            })()
          : ancestorClips;

      // Recurse into children, propagating the accumulated clip chain.
      for (const childId of scene.childrenOf(asNodeId(nodeId))) {
        walk(childId, childClips);
      }
    } else {
      // Leaf node — included only if it passes all ancestor clips AND the
      // geometry test. The clip chain is empty for plain trees, so
      // nodeBoundsPassClips short-circuits to true with no clip overhead.
      if (ancestorClips.length > 0) {
        const b = poseBounds(node.pose);
        if (!nodeBoundsPassClips(ancestorClips, b)) return;
      }
      if (nodeTest(node)) results.push(nodeId);
    }
  }

  for (const rootId of scene.roots) {
    walk(rootId, []);
  }

  return results;
}

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
  const poseBounds = options.poseBounds ?? ((p: TPose) => p as unknown as Bounds);

  const cascadeTranslate: ((pose: TPose, dx: number, dy: number) => TPose) | null =
    options.cascadeContainerPose === 'rect'
      ? (translateRectPose as unknown as (pose: TPose, dx: number, dy: number) => TPose)
      : options.cascadeContainerPose ?? null;

  const adapter: SceneCanvasAdapter<TData, TLayer, TPose> = {
    getNode(id) {
      return scene.get(asNodeId(id));
    },
    getNodes() {
      const visible = visibleLayers();
      const out: Node<TData, TLayer, TPose>[] = [];
      for (const id of scene.renderOrder()) {
        const n = scene.get(id);
        if (n && visible.has(n.layer)) out.push(n);
      }
      return out;
    },
    getPose(id) {
      const n = scene.get(asNodeId(id));
      if (!n) throw new Error(`sceneToAdapter: unknown node "${id}"`);
      return n.pose;
    },
    getParent(id) {
      const n = scene.get(asNodeId(id));
      return n?.parent ?? null;
    },
    setPose(id, pose) {
      // Container cascade (opt-in): under scene v1's absolute-pose semantics,
      // moving a container needs to translate every descendant by the same
      // delta so children visually stay attached. We compute dx/dy from the
      // top-level (x, y) of before/after — the only shape contract the cascade
      // requires of TPose; everything else flows through the supplied
      // translatePose. The whole cascade lands as one scene.batch so undo
      // collapses to a single step.
      if (cascadeTranslate !== null) {
        const node = scene.get(asNodeId(id));
        if (node && node.kind === 'container') {
          const before = node.pose as unknown as { x: number; y: number };
          const after = pose as unknown as { x: number; y: number };
          const dx = after.x - before.x;
          const dy = after.y - before.y;
          if (dx !== 0 || dy !== 0) {
            const descIds: string[] = [];
            const collect = (rootId: string): void => {
              for (const cid of scene.childrenOf(asNodeId(rootId))) {
                descIds.push(cid);
                collect(cid);
              }
            };
            collect(id);
            scene.batch('setPose', () => {
              scene.setPose(asNodeId(id), pose);
              for (const cid of descIds) {
                const cn = scene.get(asNodeId(cid));
                if (!cn) continue;
                scene.setPose(asNodeId(cid), cascadeTranslate(cn.pose, dx, dy));
              }
            });
            return;
          }
        }
      }
      scene.setPose(asNodeId(id), pose);
    },
    setParent(id, parentId) {
      scene.move(asNodeId(id), parentId === null ? null : asNodeId(parentId));
    },
    getChildren(id) {
      // Reorder ops call this with parentId === null to mean "root siblings."
      // The kit's existing callers always pass a string, so this widening is
      // additive — falls through to scene.childrenOf for the typed path and
      // returns scene.roots for the null path.
      if (id === null) return [...scene.roots];
      return [...scene.childrenOf(asNodeId(id))];
    },
    setChildOrder(parentId, ids) {
      // Batched reorder: each scene.reorder call is its own kit:move log
      // entry, but scene.batch wraps them into one undo unit + one notify.
      scene.batch('Reorder', () => {
        for (let i = 0; i < ids.length; i++) {
          // Skip ids that are already in the target slot to avoid useless
          // log entries.
          const current = parentId === null
            ? scene.roots
            : scene.childrenOf(asNodeId(parentId));
          if (current[i] === ids[i]) continue;
          scene.reorder(asNodeId(ids[i]), i);
        }
      });
    },
    getLayers() {
      return scene.layers.map((l) => ({ id: l.id, visible: l.visible }));
    },
    ...(options.layouts
      ? {
          getLayout: typeof options.layouts === 'function'
            ? options.layouts
            : (id: string) =>
                (options.layouts as Record<string, LayoutStrategy<TPose>>)[id] ?? null,
        }
      : {}),
    applyBatch(ops: Op[], label: string) {
      scene.batch(label, () => {
        for (const op of ops) op.apply(this);
      });
    },
    // Node-mutation surface used by kit InsertOps / DeleteOps (e.g.
    // useNestedGroup wrapping the selection in a new container node, or its
    // inverse). Re-adds via the full structural spec so the round-trip
    // survives undo/redo; removes by id.
    insertNode(node: Node<TData, TLayer, TPose>) {
      scene.add({
        kind: node.kind,
        layer: node.layer,
        pose: node.pose,
        data: node.data,
        id: node.id,
        ...(node.parent !== null ? { parent: node.parent } : {}),
        ...(node.kind === 'container' && node.clipFromPose
          ? { clipFromPose: node.clipFromPose }
          : {}),
      });
    },
    removeNode(id: string) {
      scene.remove(asNodeId(id));
    },
    // AreaSelectAdapter surface — included unconditionally so plain
    // `useSelectTool(sceneToAdapter(scene, { selection }))` Just Works for the
    // marquee gesture. `applyOps` uses the shared `applyOpsTo` dispatcher
    // (no checkpoint, matches the transient AreaSelectAdapter contract);
    // `hitTestArea` does an AABB-vs-AABB scan over `scene.renderOrder()` via
    // `poseBounds` (default identity for `{x,y,width,height}` poses).
    getSelection,
    setSelection,
    applyOps(ops: Op[]) {
      applyOpsTo(this, ops);
    },
    hitTestArea(rect: Bounds) {
      return walkClipAware(scene, poseBounds, (n) => {
        const b = poseBounds(n.pose);
        return (
          b.x < rect.x + rect.width &&
          b.x + b.width > rect.x &&
          b.y < rect.y + rect.height &&
          b.y + b.height > rect.y
        );
      });
    },
    hitTestLasso(polygon, mode: LassoHitMode) {
      if (polygon.length < 3) return [];
      return walkClipAware(scene, poseBounds, (n) => {
        const b = poseBounds(n.pose);
        return (
          mode === 'centers' ? polygonContainsRectCenter(polygon, b) :
          mode === 'enclosed' ? polygonContainsRect(polygon, b) :
          polygonIntersectsRect(polygon, b)
        );
      });
    },
    // commitInsert (gesture-time leaf insert) is opt-in: present only when
    // `options.commitInsert` is. The full insertNode/removeNode mutators
    // above are always present so kit-side InsertOp / DeleteOp round-trip
    // through scene.add / scene.remove regardless.
    ...(options.commitInsert
      ? {
          commitInsert: (bounds: { x: number; y: number; width: number; height: number }) => {
            const created = options.commitInsert!(bounds);
            if (!created) return null;
            const layer = (options.insertLayer ?? ('default' as TLayer));
            const id = scene.add({
              kind: 'leaf',
              layer,
              pose: created.pose,
              data: created.data,
              ...(created.id ? { id: asNodeId(created.id) } : {}),
            });
            return scene.get(id) ?? null;
          },
        }
      : {}),
  };

  return adapter;
}
