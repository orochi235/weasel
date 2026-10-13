import { useMemo } from 'react';
import { useAnimator } from '@weasel-js/animator';
import { useViewAnimationOn, type ViewAnimationApi, type ViewChannel } from 'core/viewport/useViewAnimation';
import type { SceneCanvasApi } from '../canvasExtension';

/** The canvas's camera: the runner behind `animateView`, and the target and animator it runs on. */
export function useCanvasCamera(channel: ViewChannel): {
  viewAnimation: ViewAnimationApi;
  camera: SceneCanvasApi['camera'];
} {
  // The camera runs on its own animator, never the `animator` prop's: that prop
  // is the consumer's scene animator, and their `cancelAll()` or `pause()` must
  // not strand a zoom half-finished or freeze the camera.
  const animator = useAnimator();
  const viewAnimation = useViewAnimationOn(channel, animator);
  const camera = useMemo(() => ({ target: viewAnimation.viewTarget, animator }), [viewAnimation, animator]);
  return { viewAnimation, camera };
}
