/**
 * The selection-overlay slot, built: `null` when the slot is switched off.
 */
import { useMemo } from 'react';
import type { RenderLayer } from 'core/layers/render';
import { createSelectionOverlayLayer } from 'features/selection/overlay';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { SelectionOverlaySlotConfig } from '../layerSlots';

export function useSelectionOverlayLayer<TPose>(
  /** The slot after `mergeLayersWithDefaults`. */
  slot: SelectionOverlaySlotConfig<TPose> | null | undefined,
  /** Ids whose outline and handles other chrome replaces, on top of the
   *  slot's own `getSuppressedIds`: the node whose anchors are being edited. */
  getOwnSuppressedIds: () => ReadonlySet<string>,
  /** What a slot's `poseById` is projected with when it names no descriptor. */
  poseDescriptor: PoseDescriptor<TPose>,
): RenderLayer<unknown> | null {
  return useMemo(() => {
    if (slot === null) return null;
    const cfg = slot ?? {};
    const callerSuppress = cfg.getSuppressedIds;
    const getSuppressedIds = (): ReadonlySet<string> => {
      const own = getOwnSuppressedIds();
      const caller = callerSuppress?.();
      if (!caller || caller.size === 0) return own;
      if (own.size === 0) return caller;
      const merged = new Set<string>(caller);
      for (const id of own) merged.add(id);
      return merged;
    };
    return createSelectionOverlayLayer<TPose>({
      ...cfg,
      getSuppressedIds,
      // A caller's pose lookup still needs a geometry to project with; without
      // one the layer reads bounds off the chrome state and calls neither.
      ...(cfg.poseById
        ? { getPose: cfg.poseById, poseDescriptor: cfg.poseDescriptor ?? poseDescriptor }
        : {}),
    });
  }, [slot, getOwnSuppressedIds, poseDescriptor]);
}
