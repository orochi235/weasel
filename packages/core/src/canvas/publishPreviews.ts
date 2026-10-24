/**
 * `publishPreviews` — what in-flight handles propose, published to the scene.
 *
 * A handle answering `previewPose` / `previewData` shows its proposal in the
 * preview ghost, which nothing else reads. Publishing it as the scene's pose
 * and data overrides is what lets the scene's other readers see it: a path
 * effect over a path whose anchors are being dragged, text laid along it, a
 * second view of the same scene.
 */
import { isPlainObject } from '@weasel-js/registry';
import type { Dispatcher, OngoingHandle } from '@weasel-js/routing';
import type { NodeId, Scene, ShownOverride } from 'core/scene/types';

type Fields = Record<string, unknown>;

/** One id's previewed data and the function showing it, kept while the handle answers the same data. */
interface ShownData<TData> {
  /** What the node stored when its preview began: what the handle's data was worked out from. */
  origin: unknown;
  value: unknown;
  data: (stored: TData) => TData;
}

/**
 * Publish every in-flight handle's `previewPose` and `previewData` to
 * `scene`'s overrides each time `dispatcher` notifies, through one hold, and
 * release them when the handles end. Returns the unsubscribe, which also
 * releases what is still published.
 *
 * Previewed data is shown as the fields it changes from what the node stored
 * when its preview began, laid over what the node stores now: a write made
 * mid-gesture, or its undo, shows through, as it will be kept when the edit
 * commits against the node as it then stands. Data that is not a plain
 * object is shown as it is.
 *
 * A handle with `previewHidesSource: false` previews a copy rather than its
 * source, so it is left out. An id another writer's override already holds —
 * a transform's own frame — is left to that writer. The dispatcher notifies
 * after a handle's `onEnd`, so a commit has landed before its preview goes.
 */
export function publishPreviews<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  dispatcher: Pick<Dispatcher, 'getInFlightHandles' | 'subscribe'>,
): () => void {
  const hold = scene.overrides.hold();
  const shownData = new Map<NodeId, ShownData<TData>>();

  const dataFor = (id: NodeId, value: unknown): ((stored: TData) => TData) => {
    const held = shownData.get(id);
    if (held !== undefined && held.value === value) return held.data;
    const origin = held !== undefined ? held.origin : scene.get(id)?.data;
    const data = changesOver(origin, value) as (stored: TData) => TData;
    shownData.set(id, { origin, value, data });
    return data;
  };

  const publish = (): void => {
    const frame = new Map<NodeId, ShownOverride<TPose, TData>>();
    for (const handle of dispatcher.getInFlightHandles()) {
      if (handle.previewHidesSource === false) continue;
      collect(handle, frame, (id) => scene.get(id) !== undefined, dataFor);
    }
    for (const id of shownData.keys()) {
      if (frame.get(id)?.data === undefined) shownData.delete(id);
    }
    if (frame.size === 0) hold.drop();
    else hold.show(frame);
  };

  const unsubscribe = dispatcher.subscribe(publish);
  publish();
  return () => {
    unsubscribe();
    hold.drop();
    shownData.clear();
  };
}

/** `(stored) => value`'s changes from `origin` laid over `stored`. */
function changesOver(origin: unknown, value: unknown): (stored: unknown) => unknown {
  if (!isPlainObject(origin) || !isPlainObject(value)) return () => value;
  const changed = new Set<string>();
  for (const key of new Set([...Object.keys(origin), ...Object.keys(value)])) {
    if (origin[key] !== value[key]) changed.add(key);
  }
  return (stored) => {
    if (stored === origin || !isPlainObject(stored)) return value;
    const out: Fields = { ...stored };
    for (const key of changed) {
      if (key in value) out[key] = value[key];
      else delete out[key];
    }
    return out;
  };
}

/** `handle`'s proposals into `frame`, first answer per id winning. */
function collect<TPose, TData>(
  handle: OngoingHandle,
  frame: Map<NodeId, ShownOverride<TPose, TData>>,
  exists: (id: NodeId) => boolean,
  dataFor: (id: NodeId, value: unknown) => (stored: TData) => TData,
): void {
  const ids = handle.previewIds?.();
  if (!ids) return;
  for (const raw of ids) {
    const id = raw as NodeId;
    if (frame.has(id) || !exists(id)) continue;
    const pose = handle.previewPose?.(raw);
    const data = handle.previewData?.(raw);
    if (pose == null && data == null) continue;
    frame.set(id, {
      ...(pose == null ? {} : { pose: pose as TPose }),
      ...(data == null ? {} : { data: dataFor(id, data) }),
    });
  }
}
