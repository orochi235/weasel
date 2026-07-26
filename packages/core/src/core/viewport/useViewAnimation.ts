import { useCallback } from 'react';
import { useViewTween } from './useViewTween';
import { fitViewToBounds } from './fitViewToBounds';
import type { Bounds, FitViewToBoundsOptions, ViewportDims } from './fitViewToBounds';
import type { View } from './view';

/** Options accepted by {@link useViewAnimation}'s `animateToBounds`. */
export interface AnimateToBoundsOptions extends FitViewToBoundsOptions {
  /** Tween duration in ms (forwarded to `animateTo`). */
  duration?: number;
  /** Tween easing (forwarded to `animateTo`). */
  easing?: (t: number) => number;
}

/**
 * Tween the viewport `View` between values. Wraps `useViewTween`'s `animateTo`
 * + `cancel`, and adds an `animateToBounds` convenience that composes
 * `fitViewToBounds` with the existing tween so consumers can say "zoom to this
 * bounds with animation" in one call.
 *
 * `animateToBounds` needs the current `View` and the current viewport
 * dimensions to compute the target — both are passed as arguments so this
 * hook stays a leaf (no canvas-size subscription, no `View` storage).
 */
export function useViewAnimation(setView: (v: View) => void) {
  const { animateTo, cancel } = useViewTween(setView);

  const animateToBounds = useCallback(
    (
      bounds: Bounds,
      currentView: View,
      viewportDims: ViewportDims,
      opts?: AnimateToBoundsOptions,
    ) => {
      const target = fitViewToBounds(bounds, viewportDims, currentView, opts);
      if (target === currentView) return; // helper bailed (zero-area bounds/viewport)
      animateTo(currentView, target, { duration: opts?.duration, easing: opts?.easing });
    },
    [animateTo],
  );

  return { animateTo, animateToBounds, cancel };
}
