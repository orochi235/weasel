import { useMemo } from 'react';
import type { Affordance } from 'affordances/types';
import { targetSizesPx } from 'core/device/targets';
import { useTargetBasePx } from 'core/device/useTargetBasePx';
import { chromeAffordances, type ChromeAffordanceOptions } from '../affordanceAt';

/** {@link chromeAffordances} sized by the device scale on the `targets` kit settings; an explicit `handleHitRadius` wins. */
export function useChromeAffordances(
  opts: Pick<ChromeAffordanceOptions, 'targetScale' | 'handleHitRadius' | 'rotationBadge' | 'getAnchorState' | 'edgeHandles'>,
): Affordance[] {
  const { targetScale, handleHitRadius, rotationBadge, getAnchorState, edgeHandles } = opts;
  const sizes = targetSizesPx(targetScale, useTargetBasePx());
  return useMemo(() => chromeAffordances({
    handleHitRadius: handleHitRadius ?? sizes.handle,
    anchorHitRadius: sizes.anchor,
    rotateBandPx: sizes.rotationDistance,
    rotationBadge,
    edgeHandles,
    ...(getAnchorState ? { getAnchorState } : {}),
  }), [sizes.handle, sizes.anchor, sizes.rotationDistance, handleHitRadius, rotationBadge, getAnchorState, edgeHandles]);
}
