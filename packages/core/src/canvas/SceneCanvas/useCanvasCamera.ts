import { useInsertionEffect, useMemo, useRef } from 'react';
import { useAnimator } from '@weasel-js/animator';
import { useLatest } from '@weasel-js/react';
import { useViewAnimationOn, type ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { SceneCanvasApi } from '../canvasExtension';
import { useCanvasView, type CameraProps, type CanvasViewState } from '../useCanvasView';

/**
 * The canvas's camera: the view `<Canvas>` looks through, the runner behind
 * `animateView`, and the target and animator it runs on.
 */
export function useCanvasCamera(opts: CameraProps & {
  /** The size the camera looks through, which `viewBounds` clamps against. */
  width: number;
  height: number;
  requestRedraw: () => void;
}): {
  viewState: CanvasViewState;
  viewAnimation: ViewAnimationApi;
  camera: SceneCanvasApi['camera'];
} {
  const { view, defaultView, onViewChange, viewBounds, width, height, requestRedraw } = opts;
  const size = useLatest({ width, height });
  const animationRef = useRef<ViewAnimationApi | null>(null);
  const viewState = useCanvasView({
    view,
    defaultView,
    // Every write to the view is reported here, so it is the runner's one
    // interrupt feed.
    onViewChange: (next) => {
      animationRef.current?.stopIfExternal();
      onViewChange?.(next);
    },
    viewBounds,
    dims: () => size.current,
    requestRedraw,
  });

  // The camera runs on its own animator, never the `animator` prop's: that prop
  // is the consumer's scene animator, and their `cancelAll()` or `pause()` must
  // not strand a zoom half-finished or freeze the camera.
  const animator = useAnimator();
  const { viewRef, setViewFromInput } = viewState;
  const channel = useMemo(
    () => ({ get: () => viewRef.current, set: setViewFromInput }),
    [viewRef, setViewFromInput],
  );
  const viewAnimation = useViewAnimationOn(channel, animator);
  useInsertionEffect(() => { animationRef.current = viewAnimation; });
  const camera = useMemo(() => ({ target: viewAnimation.viewTarget, animator }), [viewAnimation, animator]);
  return { viewState, viewAnimation, camera };
}
