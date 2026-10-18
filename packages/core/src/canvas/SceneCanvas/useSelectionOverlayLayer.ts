/**
 * The selection-overlay slot, built, and where it paints its rotate badge.
 * Both are `null` when the slot is switched off, and a pre-built layer has no badge.
 */
import { useMemo } from 'react';
import type { RenderLayer } from 'core/layers/render';
import { createSelectionOverlayLayer, rotationBadgeOf } from 'features/selection/overlay';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { DrawnBoundsScene } from '../drawnBounds';
import { isCustomEntry, type CustomLayerEntry, type SelectionOverlaySlotConfig } from '../layerSlots';

export function useSelectionOverlayLayer<TPose>(
  /** The slot after `mergeLayersWithDefaults`. */
  slot: SelectionOverlaySlotConfig<TPose> | CustomLayerEntry | null | undefined,
  /** Ids whose outline and handles other chrome replaces, on top of the
   *  slot's own `getSuppressedIds`: the node whose anchors are being edited. */
  getOwnSuppressedIds: () => ReadonlySet<string>,
  /** What a slot's `poseById` is projected with when it names no descriptor. */
  poseDescriptor: PoseDescriptor<TPose>,
  /** The nodes a slot's `poseById` answers for, so their chrome sits on the
   *  stroke. Omitted when the canvas measures pose boxes alone. */
  scene?: DrawnBoundsScene,
  /** Whether the handles include the edge midpoints, unless the slot says. */
  edgeHandles?: boolean,
): {
  layer: RenderLayer<unknown> | null;
  rotationBadge: ReturnType<typeof rotationBadgeOf>;
} {
  const badge = slot && !isCustomEntry(slot) ? rotationBadgeOf(slot) : null;
  // Kept by value so the layers and hit-testers keyed on it don't rebuild
  // every render.
  const rotationBadge = useMemo(
    () => badge,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [badge?.distancePx, badge?.sizePx],
  );
  const layer = useMemo(() => {
    if (slot === null) return null;
    if (isCustomEntry(slot)) return slot.layer;
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
      ...(cfg.edgeHandles === undefined && edgeHandles !== undefined ? { edgeHandles } : {}),
      getSuppressedIds,
      // A caller's pose lookup still needs a geometry to project with; without
      // one the layer reads bounds off the chrome state and calls neither.
      ...(cfg.poseById
        ? {
            getPose: cfg.poseById,
            poseDescriptor: cfg.poseDescriptor ?? poseDescriptor,
            ...(cfg.scene ?? scene ? { scene: cfg.scene ?? scene } : {}),
          }
        : {}),
    });
  }, [slot, getOwnSuppressedIds, poseDescriptor, scene, edgeHandles]);
  return { layer, rotationBadge };
}
