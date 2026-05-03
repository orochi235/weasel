import type { MutableRefObject } from 'react';
import type { MoveAdapter, ResizeAdapter } from './types';

/** Configuration for `arrayAdapter`. */
export interface ArrayAdapterConfig<TObject extends { id: string }, TPose> {
  /** Live ref to the current array. Always read via `.current` to avoid stale
   *  closures. Apps typically maintain this with a `useRef` mirrored to the
   *  same `useState` array each render. */
  ref: MutableRefObject<TObject[]>;
  /** Functional setter (typically the second value from `useState`). */
  setItems: (updater: (items: TObject[]) => TObject[]) => void;
  /** Project an object to its pose. Required — the kit can't guess which
   *  fields are pose vs. domain payload. */
  toPose: (obj: TObject) => TPose;
  /** Merge a new pose back into an object. Default: shallow spread
   *  (`{ ...obj, ...pose }`), which works when pose fields sit at the top of
   *  `TObject`. Override for nested-pose layouts. */
  fromPose?: (obj: TObject, pose: TPose) => TObject;
  /** Optional parent lookup. Default returns `null` for every id (flat scene). */
  getParent?: (id: string) => string | null;
  /** Optional reparent mutator. Default is a noop. */
  setParent?: (id: string, parentId: string | null) => void;
  /** Optional children lookup. Default omits the method (no cascade behavior). */
  getChildren?: (id: string) => string[] | undefined;
}

/**
 * Return type of `arrayAdapter`. Satisfies both `MoveAdapter` and
 * `ResizeAdapter` via structural typing. `getObjects` is exposed for
 * convenience (rendering, listAll, etc.). For full `SceneAdapter` compliance
 * spread additional methods (`hitTest`, `setSelection`, `insertObject`, ...)
 * over the result.
 */
export interface ArrayAdapter<TObject extends { id: string }, TPose>
  extends MoveAdapter<TObject, TPose>, ResizeAdapter<TObject, TPose> {
  getObjects(): TObject[];
}

function defaultFromPose<TObject extends { id: string }, TPose>(
  obj: TObject,
  pose: TPose,
): TObject {
  return { ...obj, ...(pose as object) } as TObject;
}

/**
 * Synthesize a `MoveAdapter` + `ResizeAdapter` from a `useState`-array scene.
 * Most demos write near-identical adapter blocks: array-find for `getObject`,
 * array-map for `setPose`, null/noop parent stubs. This factory collapses the
 * boilerplate to a ref + setter + a single `toPose` projection.
 *
 * Override individual methods by spreading:
 * ```
 * const adapter = { ...arrayAdapter({...}), hitTest: (x, y) => ... };
 * ```
 *
 * `applyBatch` is intentionally omitted — hooks fall back to the built-in
 * dispatcher (see `dispatchApplyBatch` in `core/ops`). Apps with custom
 * history integration supply their own via spread.
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
  } = config;

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
  };

  if (getChildren) {
    (adapter as ArrayAdapter<TObject, TPose> & { getChildren: (id: string) => string[] }).getChildren =
      (id) => getChildren(id) ?? [];
  }

  return adapter;
}
