/**
 * `publishPreviews` — what in-flight handles propose, published to the scene.
 *
 * A handle answering `previewPose` / `previewData` shows its proposal in the
 * preview ghost, which nothing else reads. Publishing it as the scene's pose
 * and data overrides is what lets the scene's other readers see it: a path
 * effect over a path whose anchors are being dragged, text laid along it, a
 * second view of the same scene.
 */
import type { Dispatcher, OngoingHandle } from '@weasel-js/routing';
import type { NodeId, PoseOverride, Scene } from 'core/scene/types';

type Shown<TPose, TData> = Pick<PoseOverride<TPose, TData>, 'pose' | 'data'>;

/**
 * Publish every in-flight handle's `previewPose` and `previewData` to
 * `scene`'s overrides each time `dispatcher` notifies, through one hold, and
 * release them when the handles end. Returns the unsubscribe, which also
 * releases what is still published.
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
  /** Per id, the last data a handle previewed and the function showing it, so
   *  the function only changes when the data does. */
  const shownData = new Map<NodeId, { value: unknown; data: (stored: TData) => TData }>();

  const dataFor = (id: NodeId, value: unknown): ((stored: TData) => TData) => {
    const held = shownData.get(id);
    if (held !== undefined && held.value === value) return held.data;
    const data = (): TData => value as TData;
    shownData.set(id, { value, data });
    return data;
  };

  const publish = (): void => {
    const frame = new Map<NodeId, Shown<TPose, TData>>();
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

/** `handle`'s proposals into `frame`, first answer per id winning. */
function collect<TPose, TData>(
  handle: OngoingHandle,
  frame: Map<NodeId, Shown<TPose, TData>>,
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
