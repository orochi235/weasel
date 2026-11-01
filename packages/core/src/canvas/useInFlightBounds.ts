import { useCallback, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { GestureSource } from './gestureBounds';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/**
 * Where a view boxes the nodes an in-flight gesture names: at the pose a
 * source previews, carried to world, else at the node's effective pose — a transform's poses
 * live in the scene's overrides, not on its handle. Boxed through `boxOf`
 * either way, since a consumer `boundsOf` answers for the document pose only.
 */
export function useInFlightBounds<TPose>(args: {
  gestureSource: GestureSource | undefined;
  /** Read through a ref, so a change mid-gesture rebuilds nothing. */
  previewPoseExtra: ((id: string) => unknown) | undefined;
  boxOf: (id: string, pose: TPose) => Bounds | null;
  /** The node's effective world pose. */
  committedPoseOf: (id: string) => TPose | null;
  /** Where `id` is drawn if it stores `stored`: a previewed pose is in the
   *  frame the node is stored in, as a published override is. Absent means
   *  stored poses are world. */
  worldOfStored?: ((id: string, stored: TPose) => TPose) | undefined;
}): {
  previewPoseOf: (id: string) => TPose | null;
  previewBoundsOf: (id: string) => Bounds | null;
} {
  const { gestureSource, boxOf, committedPoseOf, worldOfStored } = args;
  const previewPoseExtraRef = useLatest(args.previewPoseExtra);
  const previewPoseOf = useCallback((id: string): TPose | null => {
    const p = previewPoseExtraRef.current?.(id);
    if (p == null) return null;
    return worldOfStored ? worldOfStored(id, p as TPose) : (p as TPose);
  }, [previewPoseExtraRef, worldOfStored]);

  // The source's ids, re-read only when its version moves.
  const inFlight = useRef<{ source: GestureSource; version: number; ids: ReadonlySet<string> } | null>(null);
  const isInFlight = useCallback((id: string): boolean => {
    if (!gestureSource) return false;
    const version = gestureSource.getVersion();
    let entry = inFlight.current;
    if (entry === null || entry.source !== gestureSource || entry.version !== version) {
      entry = { source: gestureSource, version, ids: new Set(gestureSource.ids() ?? []) };
      inFlight.current = entry;
    }
    return entry.ids.has(id);
  }, [gestureSource]);

  const previewBoundsOf = useCallback((id: string): Bounds | null => {
    const p = previewPoseOf(id);
    if (p != null) return boxOf(id, p);
    if (!isInFlight(id)) return null;
    const shown = committedPoseOf(id);
    return shown != null ? boxOf(id, shown) : null;
  }, [previewPoseOf, boxOf, isInFlight, committedPoseOf]);

  return { previewPoseOf, previewBoundsOf };
}
