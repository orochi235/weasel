import type { MutableRefObject } from 'react';
import type {
  AreaSelectAdapter,
  InsertAdapter,
  LassoHitMode,
  LassoSelectAdapter,
  MoveAdapter,
  ResizeAdapter,
} from './types';
import {
  polygonContainsRect,
  polygonContainsRectCenter,
  polygonIntersectsRect,
} from '../geometry/polygonHitTestRect';
import type { Op } from '../ops/types';
import { applyOpsTo } from '../applyOps';
import type { Bounds } from '../viewport/fitViewToBounds';
import type { ClipboardSnapshot } from './types';

/** Configuration for `arrayAdapter`. */
export interface ArrayAdapterConfig<TNode extends { id: string }, TPose> {
  /** Live ref to the current array. */
  ref: MutableRefObject<TNode[]>;
  /** Functional setter (typically the second value from `useState`). */
  setItems: (updater: (items: TNode[]) => TNode[]) => void;
  /** Project an object to its pose. Required. */
  toPose: (obj: TNode) => TPose;
  /** Merge a new pose back into an object. Default: shallow spread. */
  fromPose?: (obj: TNode, pose: TPose) => TNode;
  /** Optional parent lookup. Default returns `null`. */
  getParent?: (id: string) => string | null;
  /** Optional reparent mutator. Default is a noop. */
  setParent?: (id: string, parentId: string | null) => void;
  /** Optional children lookup. Default omits the method. */
  getChildren?: (id: string) => string[] | undefined;

  /** Live ref to the current selection. Default: empty array. */
  selectionRef?: MutableRefObject<string[]>;
  /** Selection setter. Default: noop. */
  setSelection?: (ids: string[]) => void;

  /** Factory for `commitInsert` — invoked at the end of an insert drag.
   *  Consumers own id generation and any palette/payload fields. Returning
   *  `null` aborts the insert. When omitted, `commitInsert` returns `null`. */
  createDefault?: (bounds: Bounds) => TNode | null;

  /** Project a pose to an AABB for `hitTestArea`. Default: identity (works
   *  when TPose carries top-level x/y/width/height). */
  poseBounds?: (pose: TPose) => Bounds;
  /** Tight intersection test against a pose. Default: AABB-vs-AABB using
   *  `poseBounds`. Override for non-rect poses (e.g. polygons via
   *  `pathPoseDescriptor.intersectsRect`). */
  intersectsRect?: (pose: TPose, rect: Bounds) => boolean;

  /** Factory for fresh node ids in `commitPaste`. Default: `crypto.randomUUID()`
   *  when available, otherwise a monotonic `paste-<n>` counter. Override
   *  when consumers want stable id schemes (e.g. `clip-${n++}`). */
  nextId?: () => string;
  /** Translate a pose by `(dx, dy)`. Default: shallow-spread `{ x, y }`,
   *  which matches the canonical axis-aligned rect pose. Override for
   *  non-rect poses whose translation isn't a top-level `x`/`y` bump. */
  translatePose?: (pose: TPose, dx: number, dy: number) => TPose;
}

/**
 * Combined adapter satisfying every narrow adapter the kit ships. Methods
 * with no default implementation (e.g. `commitInsert` without
 * `createDefault`) return null/[]/noop — sufficient to typecheck against
 * `InsertAdapter`/`AreaSelectAdapter`, and the corresponding gesture hook
 * simply produces no commit.
 */
export interface ArrayAdapter<TNode extends { id: string }, TPose>
  extends MoveAdapter<TNode, TPose>,
    ResizeAdapter<TNode, TPose>,
    InsertAdapter<TNode>,
    AreaSelectAdapter,
    LassoSelectAdapter {
  getNodes(): TNode[];
  removeNode(id: string): void;
  // ArrayAdapter satisfies the union of all narrow adapters; redeclare the
  // methods that are optional on AreaSelectAdapter (post-relaxation) but
  // required on InsertAdapter so TS sees a single non-conflicting signature.
  getSelection(): string[];
  setSelection(ids: string[]): void;
  // Redeclare applyOps with an optional label so it's compatible with both
  // MoveAdapter (label required) and AreaSelectAdapter (label absent = transient).
  applyOps?(ops: Op[], label?: string): void;
}

function defaultFromPose<TNode extends { id: string }, TPose>(
  obj: TNode,
  pose: TPose,
): TNode {
  return { ...obj, ...(pose as object) } as TNode;
}

function defaultPoseBounds<TPose>(pose: TPose): Bounds {
  return pose as unknown as Bounds;
}

function defaultTranslatePose<TPose>(pose: TPose, dx: number, dy: number): TPose {
  const p = pose as unknown as { x?: number; y?: number };
  return { ...(pose as object), x: (p.x ?? 0) + dx, y: (p.y ?? 0) + dy } as TPose;
}

let monotonicPasteCounter = 0;
function defaultNextId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `paste-${monotonicPasteCounter++}`;
}

/**
 * Synthesize a many-faceted adapter from a `useState`-array scene. Always
 * satisfies `MoveAdapter`, `ResizeAdapter`, `InsertAdapter`, and
 * `AreaSelectAdapter` via structural typing. Override individual methods by
 * spreading the result.
 *
 * `applyOps` is intentionally omitted — hooks fall back to the built-in
 * dispatcher (see `dispatchApplyBatch`). Apps with custom history
 * integration supply their own via spread.
 */
export function arrayAdapter<TNode extends { id: string }, TPose>(
  config: ArrayAdapterConfig<TNode, TPose>,
): ArrayAdapter<TNode, TPose> {
  const {
    ref,
    setItems,
    toPose,
    fromPose = defaultFromPose,
    getParent = () => null,
    setParent = () => {},
    getChildren,
    selectionRef,
    setSelection = () => {},
    createDefault,
    poseBounds = defaultPoseBounds,
    intersectsRect,
    nextId = defaultNextId,
    translatePose = defaultTranslatePose,
  } = config;

  const getSelection = selectionRef ? () => selectionRef.current : () => [];

  const adapter: ArrayAdapter<TNode, TPose> = {
    getNode: (id) => ref.current.find((o) => o.id === id),
    getNodes: () => ref.current,
    getPose: (id) => {
      const obj = ref.current.find((o) => o.id === id);
      if (!obj) throw new Error(`arrayAdapter.getPose: id "${id}" not found`);
      return toPose(obj);
    },
    setPose: (id, pose) => {
      setItems((items) => items.map((o) => (o.id === id ? fromPose(o, pose) : o)));
    },
    getParent,
    setParent,

    insertNode: (obj) => setItems((items) => [...items, obj]),
    removeNode: (id) => setItems((items) => items.filter((o) => o.id !== id)),

    getSelection,
    setSelection,

    hitTestArea: (rect) => {
      const out: string[] = [];
      for (const o of ref.current) {
        const pose = toPose(o);
        const hit = intersectsRect
          ? intersectsRect(pose, rect)
          : (() => {
              const b = poseBounds(pose);
              return (
                b.x < rect.x + rect.width &&
                b.x + b.width > rect.x &&
                b.y < rect.y + rect.height &&
                b.y + b.height > rect.y
              );
            })();
        if (hit) out.push(o.id);
      }
      return out;
    },

    hitTestLasso: (polygon, mode: LassoHitMode) => {
      if (polygon.length < 3) return [];
      const out: string[] = [];
      for (const o of ref.current) {
        const pose = toPose(o);
        const b = poseBounds(pose);
        const hit =
          mode === 'centers' ? polygonContainsRectCenter(polygon, b) :
          mode === 'enclosed' ? polygonContainsRect(polygon, b) :
          polygonIntersectsRect(polygon, b);
        if (hit) out.push(o.id);
      }
      return out;
    },

    // Use a method shorthand so `this` is the call-site receiver, not the
    // adapter we're building here. That way consumers can spread additional
    // methods on top (e.g. `{ ...arrayAdapter(...), ...selection.adapterMethods }`)
    // and `applyOps` will dispatch ops against the merged object.
    applyOps(ops: Op[]) {
      applyOpsTo(this, ops);
    },

    commitInsert: createDefault ? (b) => createDefault(b) : () => null,
    commitPaste: (
      clip: ClipboardSnapshot,
      offset: { dx: number; dy: number },
      ctx?: { dropPoint?: { worldX: number; worldY: number } },
    ): TNode[] => {
      const src = clip.items as TNode[];
      if (src.length === 0) return [];

      // Default translation = `offset`. When `dropPoint` is supplied, center
      // the cluster's union AABB (in pose space, via `poseBounds(toPose(n))`)
      // at the drop point — matches the `ClipboardDemo` reference wiring.
      let dx = offset.dx;
      let dy = offset.dy;
      if (ctx?.dropPoint) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of src) {
          const b = poseBounds(toPose(n));
          if (b.x < minX) minX = b.x;
          if (b.y < minY) minY = b.y;
          if (b.x + b.width > maxX) maxX = b.x + b.width;
          if (b.y + b.height > maxY) maxY = b.y + b.height;
        }
        // Defensive: if poseBounds returned nothing usable, fall back to offset.
        if (Number.isFinite(minX) && Number.isFinite(minY)) {
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          dx = ctx.dropPoint.worldX - cx;
          dy = ctx.dropPoint.worldY - cy;
        }
      }

      // Deep-clone via JSON round-trip so the snapshot isn't mutated by
      // downstream pose edits. Adapter config can override `translatePose`
      // for non-rect poses where shallow `{x, y}` bump is wrong.
      const out: TNode[] = [];
      for (const n of src) {
        const cloned = JSON.parse(JSON.stringify(n)) as TNode;
        (cloned as { id: string }).id = nextId();
        const translated = translatePose(toPose(cloned), dx, dy);
        out.push(fromPose(cloned, translated));
      }
      return out;
    },
    snapshotSelection: (ids) => ({
      items: ids
        .map((id) => ref.current.find((o) => o.id === id))
        .filter((o): o is TNode => !!o),
    }),
  };

  if (getChildren) {
    (adapter as ArrayAdapter<TNode, TPose> & { getChildren: (id: string) => string[] }).getChildren =
      (id) => getChildren(id) ?? [];
  }

  return adapter;
}
