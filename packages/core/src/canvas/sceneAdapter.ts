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
import { dwarn } from '../debug';
import type {
  AreaSelectAdapter,
  ClipboardSnapshot,
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
import type { Node, NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { applyOpsTo } from 'core/applyOps';
import {
  polygonContainsRect,
  polygonContainsRectCenter,
  polygonIntersectsRect,
} from 'features/paths/polygonHitTestRect';
import type { Path } from 'features/paths/types';
import { findShapeSilhouette } from './NodeShape';
import { pathIntersectsRect } from 'features/paths/pathHitTest';
import { translateRectPose } from 'features/groups/composePose';
import type { Bounds } from '../core/viewport/fitViewToBounds';

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
      getSelection(): string[];
      setSelection(ids: string[]): void;
      insertNode(node: Node<TData, TLayer, TPose>, index?: number): void;
      removeNode(id: string): void;
      applyOps(ops: Op[], label?: string): void;
      snapshotSelection(ids: string[]): ClipboardSnapshot;
      commitPaste(
        clipboard: ClipboardSnapshot,
        offset: { dx: number; dy: number },
        ctx?: { dropPoint?: { worldX: number; worldY: number } },
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
      // Explicit `clipFromPose` wins; otherwise fall back to the painter
      // silhouette so non-rect shape kinds clip area-select correctly
      // without per-node wiring.
      const ownClip: Path | null =
        typeof node.clipFromPose === 'function'
          ? node.clipFromPose(node.pose)
          : findShapeSilhouette(
              node as unknown as Node<unknown, string, TPose>,
              node.pose,
            );
      const childClips: readonly Path[] =
        ownClip !== null ? [...ancestorClips, ownClip] : ancestorClips;

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

// Fallback id generator for `commitInsert` when the consumer factory omits
// `created.id`. Mirrors `scene.ts`'s `defaultGenerateId` shape; module-scoped
// counter keeps ids unique across adapters in a session.
let adapterFallbackIdCounter = 0;
function adapterFallbackId(): string {
  return `n${(adapterFallbackIdCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Fresh ids for pasted nodes. The scene's own `generateId` isn't reachable
// from the adapter, so `commitPaste` mints ids in the same shape as
// `defaultGenerateId` with a `paste-` prefix (module-scoped counter + random
// suffix keeps them unique across adapters and repeated pastes). Accepted
// risk: the counter is per-tab, so cross-tab paste (the OS-clipboard path)
// leans on the random suffix alone for uniqueness — a collision makes
// `scene.add` throw rather than silently overwrite.
let pasteIdCounter = 0;
function pasteNodeId(): string {
  return `paste-${(pasteIdCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Copy one node field (pose / data / children) so clipboard snapshots don't
// alias live scene state. Spread-level copy per the clipboard contract:
// mutating a snapshot's pose/data/children must not touch the scene.
function copyField<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (value !== null && typeof value === 'object') return { ...(value as object) } as T;
  return value;
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

  // Pose translator for `commitPaste`. Resolution chain:
  //   1. the consumer's cascade translator, when configured (the same seam
  //      non-rect pose shapes already use for container drags);
  //   2. `translateRectPose`, but only when the pose actually carries
  //      top-level numeric x/y (the default `poseBounds` shape assumption);
  //   3. identity + dwarn — pasted nodes land untranslated (overlapping the
  //      source) rather than having bogus/NaN x/y written into a pose shape
  //      the kit doesn't understand. Mirrors `cascadeContainerPose`'s opt-in
  //      posture: exotic poses must supply their own translator.
  const pasteTranslatePose = (pose: TPose, dx: number, dy: number): TPose => {
    if (cascadeTranslate !== null) return cascadeTranslate(pose, dx, dy);
    const p = pose as unknown as { x?: unknown; y?: unknown };
    if (typeof p.x === 'number' && typeof p.y === 'number') {
      return (translateRectPose as unknown as (pose: TPose, dx: number, dy: number) => TPose)(
        pose, dx, dy,
      );
    }
    dwarn(
      'scene-canvas',
      'commitPaste: pose has no top-level numeric x/y and no cascadeContainerPose translator is configured — pasting untranslated',
    );
    return pose;
  };

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
    // Unified applyOps: when a label is supplied the ops are wrapped in a
    // batch checkpoint (history-aware path used by Move/Resize/Rotate/Insert/
    // Delete tools). When a journal is active (via scene's getActiveJournal
    // option), scene.applyBatch routes to the journal instead of recording a
    // new parent-history entry. Without a label the ops are applied transiently
    // via applyOpsTo (AreaSelectAdapter contract — no checkpoint).
    applyOps(ops: Op[], label?: string) {
      if (label !== undefined) {
        scene.applyBatch(ops, label, this);
      } else {
        applyOpsTo(this, ops);
      }
    },
    // Node-mutation surface used by kit InsertOps / DeleteOps (e.g.
    // useNest wrapping the selection in a new container node, or its
    // inverse). Re-adds via the full structural spec so the round-trip
    // survives undo/redo; removes by id.
    insertNode(node: Node<TData, TLayer, TPose>, index?: number) {
      scene.add({
        kind: node.kind,
        layer: node.layer,
        pose: node.pose,
        data: node.data,
        id: node.id,
        ...(index !== undefined ? { index } : {}),
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
    // marquee gesture. `applyOps` (above) dispatches transiently when called
    // without a label, matching the AreaSelectAdapter contract; `hitTestArea`
    // does an AABB-vs-AABB scan over `scene.renderOrder()` via `poseBounds`
    // (default identity for `{x,y,width,height}` poses).
    getSelection,
    setSelection,
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
            const id = asNodeId(created.id ?? adapterFallbackId());
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
    //
    // `snapshotSelection` captures adapter-shaped node copies; `commitPaste`
    // is a pure factory like `commitInsert` above — it mints fresh nodes but
    // NEVER touches the scene. Insertion happens via the hook's InsertOps
    // (one per created node, parents before children), which is what makes a
    // whole paste a single undo entry.
    snapshotSelection(ids: string[]): ClipboardSnapshot {
      const idSet = new Set(ids);
      const taken = new Set<string>();
      const items: Node<TData, TLayer, TPose>[] = [];
      // DFS from one snapshot root: push the node, then its subtree —
      // parents-before-children, so paste can re-insert in array order.
      const capture = (id: string): void => {
        if (taken.has(id)) return;
        const n = scene.get(asNodeId(id));
        if (!n) return;
        taken.add(id);
        if (n.kind === 'container') {
          items.push({
            kind: 'container',
            id: n.id,
            layer: n.layer,
            parent: n.parent,
            pose: copyField(n.pose),
            data: copyField(n.data),
            children: [...n.children],
            ...(n.clipFromPose ? { clipFromPose: n.clipFromPose } : {}),
          });
          for (const cid of scene.childrenOf(asNodeId(id))) capture(cid);
        } else {
          items.push({
            kind: 'leaf',
            id: n.id,
            layer: n.layer,
            parent: n.parent,
            pose: copyField(n.pose),
            data: copyField(n.data),
          });
        }
      };
      for (const id of ids) {
        // Dedupe: an id whose ancestor is also selected is already covered
        // by that ancestor's subtree walk.
        if (scene.ancestorsOf(asNodeId(id)).some((a) => idSet.has(a))) continue;
        capture(id);
      }
      return { items };
    },
    commitPaste(
      clipboard: ClipboardSnapshot,
      offset: { dx: number; dy: number },
      ctx?: { dropPoint?: { worldX: number; worldY: number } },
    ): Node<TData, TLayer, TPose>[] {
      // Snapshot items are adapter-shaped node copies: what snapshotSelection
      // captures, and what commitPaste itself returns (`useClipboardOps`
      // feeds `created` back in as the next cascade source).
      const src = clipboard.items as Node<TData, TLayer, TPose>[];
      if (src.length === 0) return [];
      const idMap = new Map<string, NodeId>();
      for (const item of src) idMap.set(item.id, asNodeId(pasteNodeId()));
      // Items whose captured parent isn't part of the snapshot become roots
      // of the pasted cluster.
      const isRoot = (item: Node<TData, TLayer, TPose>): boolean =>
        item.parent === null || !idMap.has(item.parent);
      // Scene v1 poses are absolute (see the cascade notes above), so the
      // delta applies to EVERY pasted node — the cluster translates rigidly,
      // descendants staying attached to their parents.
      let dx = offset.dx;
      let dy = offset.dy;
      if (ctx?.dropPoint) {
        // Drop-point policy: land the cluster origin (min corner of the root
        // items' bounds) on the drop point; `offset` is ignored.
        let minX = Infinity;
        let minY = Infinity;
        for (const item of src) {
          if (!isRoot(item)) continue;
          const b = poseBounds(item.pose);
          if (b.x < minX) minX = b.x;
          if (b.y < minY) minY = b.y;
        }
        if (Number.isFinite(minX) && Number.isFinite(minY)) {
          dx = ctx.dropPoint.worldX - minX;
          dy = ctx.dropPoint.worldY - minY;
        }
      }
      const out: Node<TData, TLayer, TPose>[] = [];
      for (const item of src) {
        const base = {
          id: idMap.get(item.id)!,
          layer: item.layer,
          parent: isRoot(item) ? null : idMap.get(item.parent as string)!,
          pose: pasteTranslatePose(copyField(item.pose), dx, dy),
          data: copyField(item.data),
        };
        if (item.kind === 'container') {
          out.push({
            ...base,
            kind: 'container',
            children: item.children.filter((c) => idMap.has(c)).map((c) => idMap.get(c)!),
            ...(item.clipFromPose ? { clipFromPose: item.clipFromPose } : {}),
          });
        } else {
          out.push({ ...base, kind: 'leaf' });
        }
      }
      // `src` is parents-before-children (snapshotSelection's DFS order),
      // and this loop preserves it — children re-attach to freshly-inserted
      // parents when the hook's InsertOps apply in order.
      return out;
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
 * React-hook wrapper around `sceneToAdapter`. Memoizes on `scene`,
 * `options.selection`, `options.commitInsert`, `options.insertLayer`, and
 * `options.layouts` so the adapter identity is stable across renders unless
 * one of those changes.
 *
 * Saves the per-demo `useMemo(() => sceneToAdapter(scene, { selection }),
 * [scene, selection])` boilerplate every consumer that wires custom tools
 * would otherwise repeat.
 */
export function useSceneAdapter<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  options: SceneToAdapterOptions<TData, TLayer, TPose> = {},
): SceneCanvasAdapter<TData, TLayer, TPose> {
  const { selection, commitInsert, insertLayer, layouts, poseBounds, cascadeContainerPose } = options;
  return useMemo(
    () => sceneToAdapter(scene, { selection, commitInsert, insertLayer, layouts, poseBounds, cascadeContainerPose }),
    [scene, selection, commitInsert, insertLayer, layouts, poseBounds, cascadeContainerPose],
  );
}
