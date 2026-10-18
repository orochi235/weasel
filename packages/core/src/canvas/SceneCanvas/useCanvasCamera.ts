import { useInsertionEffect, useMemo, useRef } from 'react';
import { useAnimator } from '@weasel-js/animator/react';
import { useViewAnimationOn, type ViewAnimationApi } from 'core/viewport/useViewAnimation';
import { sameView, type View } from 'core/viewport/view';
import type { Dims } from 'core/layers/render';
import type { SceneCanvasApi } from '../canvasExtension';
import { useCanvasView, type CameraProps, type CanvasViewState } from '../useCanvasView';

/**
 * The canvas's camera: the view `<Canvas>` looks through, the runner behind
 * `animateView`, and the target and animator it runs on.
 */
export function useCanvasCamera(opts: CameraProps & {
  /** The size the camera looks through, which `viewBounds` clamps against.
   *  Read live: a filling canvas learns it only once measured. */
  dims: () => Dims;
  requestRedraw: () => void;
}): {
  viewState: CanvasViewState;
  viewAnimation: ViewAnimationApi;
  camera: SceneCanvasApi['camera'];
} {
  const { view, defaultView, onViewChange, viewBounds, dims, requestRedraw } = opts;
  const animationRef = useRef<ViewAnimationApi | null>(null);
  /** The runner has written a frame since the controlled view last moved. */
  const runnerWroteRef = useRef(false);
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
    dims,
    requestRedraw,
  });

  // The camera runs on its own animator, never the `animator` prop's: that prop
  // is the consumer's scene animator, and their `cancelAll()` or `pause()` must
  // not strand a zoom half-finished or freeze the camera.
  const animator = useAnimator();
  const { viewRef, setViewFromInput, controlled } = viewState;
  const channel = useMemo(
    () => ({
      get: () => viewRef.current,
      set: (next: View) => {
        runnerWroteRef.current = true;
        setViewFromInput(next);
      },
    }),
    [viewRef, setViewFromInput],
  );
  const viewAnimation = useViewAnimationOn(channel, animator);
  useInsertionEffect(() => { animationRef.current = viewAnimation; });

  // A controlled consumer writing `view` in their own state never passes
  // through `onViewChange`. Their handling of a frame cannot be told from such
  // a write by value, since they may clamp or round what they are handed, so it
  // is told by order: a prop that moves with no frame written since it last
  // moved is theirs. One that lands in the same render as a frame's is missed.
  const lastControlledRef = useRef(controlled);
  useInsertionEffect(() => {
    const was = lastControlledRef.current;
    lastControlledRef.current = controlled;
    if (!controlled || !was || sameView(was, controlled)) return;
    if (runnerWroteRef.current) runnerWroteRef.current = false;
    else viewAnimation.stopIfExternal();
  });
  const camera = useMemo(() => ({ target: viewAnimation.viewTarget, animator }), [viewAnimation, animator]);
  return { viewState, viewAnimation, camera };
}
