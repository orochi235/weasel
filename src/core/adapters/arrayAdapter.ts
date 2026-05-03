import type { MutableRefObject } from 'react';
import type {
  AreaSelectAdapter,
  InsertAdapter,
  MoveAdapter,
  ResizeAdapter,
} from './types';
import type { Op } from '../ops/types';
import { applyOpsTo } from '../applyOps';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Configuration for `arrayAdapter`. */
export interface ArrayAdapterConfig<TObject extends { id: string }, TPose> {
  /** Live ref to the current array. */
  ref: MutableRefObject<TObject[]>;
  /** Functional setter (typically the second value from `useState`). */
  setItems: (updater: (items: TObject[]) => TObject[]) => void;
  /** Project an object to its pose. Required. */
  toPose: (obj: TObject) => TPose;
  /** Merge a new pose back into an object. Default: shallow spread. */
  fromPose?: (obj: TObject, pose: TPose) => TObject;
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
  createDefault?: (bounds: Bounds) => TObject | null;

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
export interface ArrayAdapter<TObject extends { id: string }, TPose>
  extends MoveAdapter<TObject, TPose>,
    ResizeAdapter<TObject, TPose>,
    InsertAdapter<TObject>,
    AreaSelectAdapter {
  getObjects(): TObject[];
  removeObject(id: string): void;
}

function defaultFromPose<TObject extends { id: string }, TPose>(
  obj: TObject,
  pose: TPose,
): TObject {
  return { ...obj, ...(pose as object) } as TObject;
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
 * `applyBatch` is intentionally omitted — hooks fall back to the built-in
 * dispatcher (see `dispatchApplyBatch`). Apps with custom history
 * integration supply their own via spread.
 */
export function arrayAdapter<TObject extends { id: string }, TPose>(
  config: ArrayAdapterConfig<TObject, TPose>,
): ArrayAdapter<TObject, TPose> {
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

  const adapter: ArrayAdapter<TObject, TPose> = {
    getObject: (id) => ref.current.find((o) => o.id === id),
    getObjects: () => ref.current,
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

    insertObject: (obj) => setItems((items) => [...items, obj]),
    removeObject: (id) => setItems((items) => items.filter((o) => o.id !== id)),

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

    applyOps: (ops: Op[]) => applyOpsTo(adapter, ops),

    commitInsert: createDefault ? (b) => createDefault(b) : () => null,
    commitPaste: () => [],
    snapshotSelection: (ids) => ({
      items: ids
        .map((id) => ref.current.find((o) => o.id === id))
        .filter((o): o is TObject => !!o),
    }),
  };

  if (getChildren) {
    (adapter as ArrayAdapter<TObject, TPose> & { getChildren: (id: string) => string[] }).getChildren =
      (id) => getChildren(id) ?? [];
  }

  return adapter;
}
