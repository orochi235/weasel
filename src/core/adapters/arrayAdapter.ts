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
} from 'features/paths/polygonHitTestRect';
import type { Op } from '../ops/types';
import { applyOpsTo } from '../applyOps';
import type { Bounds } from '../viewport/fitViewToBounds';

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
    commitPaste: () => [],
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
