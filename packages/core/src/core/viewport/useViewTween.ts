import { useCallback, useEffect, useRef } from 'react';
import type { View } from './view';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpView(from: View, to: View, t: number): View {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    scale: {
      x: lerp(from.scale.x, to.scale.x, t),
      y: lerp(from.scale.y, to.scale.y, t),
    },
  };
}

/** Animate the view from where it is to a target view — zoom-to-fit,
 *  zoom-to-selection, and anything else that should glide rather than jump. */
export function useViewTween(setView: (v: View) => void) {
  const setViewRef = useRef(setView);
  setViewRef.current = setView;

  const rafRef = useRef<number | null>(null);
  const tweenRef = useRef<{ from: View; to: View; duration: number; easing: (t: number) => number; startTime: number | null } | null>(null);
  const isAnimatingRef = useRef(false);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    tweenRef.current = null;
    isAnimatingRef.current = false;
  }, []);

  const tick = useCallback((now: number) => {
    const tw = tweenRef.current;
    if (!tw) return;
    if (tw.startTime === null) tw.startTime = now;
    const elapsed = now - tw.startTime;
    const t = tw.easing(Math.min(elapsed / tw.duration, 1));
    setViewRef.current(lerpView(tw.from, tw.to, t));
    if (elapsed >= tw.duration) {
      tweenRef.current = null;
      rafRef.current = null;
      isAnimatingRef.current = false;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const animateTo = useCallback((
    from: View,
    to: View,
    opts?: { duration?: number; easing?: (t: number) => number },
  ) => {
    cancel();
    tweenRef.current = {
      from, to,
      duration: opts?.duration ?? 250,
      easing: opts?.easing ?? easeOutCubic,
      startTime: null,
    };
    isAnimatingRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }, [cancel, tick]);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { animateTo, cancel, isAnimating: isAnimatingRef };
}
