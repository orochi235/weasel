import { useId, useMemo, useRef } from 'react';
import { useAnimator } from '../../animation/useAnimator';
import { easeOutCubic } from '../../animation/easings';
import type { Animator, EasingSpec, InterpolatorFactory } from '../../animation/types';
import { interpolateView } from './interpolateView';
import { fitViewToBounds } from './fitViewToBounds';
import type { Bounds, FitViewToBoundsOptions, ViewportDims } from './fitViewToBounds';
import type { View } from './view';

/** Cancel-key prefix. Each hook instance appends its own id, so two runners
 *  sharing an animator do not cancel each other. */
export const VIEW_ANIMATION_KEY = 'view';

const DEFAULT_MS = 250;

/** How the camera should move. */
export interface ViewAnimationOptions {
  /** Duration in ms. Default 250. */
  ms?: number;
  /** Easing curve. Default `easeOutCubic`. */
  easing?: EasingSpec;
  /** Replace the kit's log-scale / fixed-anchor curve. */
  interpolator?: InterpolatorFactory<View>;
  /** Fires when the target is reached. Not called on cancel. */
  onDone?: () => void;
}

/** Options accepted by {@link ViewAnimationApi.animateToBounds}. */
export interface AnimateToBoundsOptions extends FitViewToBoundsOptions, ViewAnimationOptions {}

/** What the runner reads and writes. On `<SceneCanvas>` this is the same
 *  channel `view.set` uses, so a camera animation on an uncontrolled canvas
 *  costs no React render. */
export interface ViewChannel {
  get(): View;
  set(v: View): void;
}

/** The camera animation surface. One animation at a time. */
export interface ViewAnimationApi {
  /** Glide from the live view to `to`. A thunk receives the pending target when
   *  one is in flight, so successive discrete steps compound. */
  animate(to: View | ((base: View) => View), opts?: ViewAnimationOptions): void;
  /** `fitViewToBounds` composed with `animate`. */
  animateToBounds(bounds: Bounds, dims: ViewportDims, opts?: AnimateToBoundsOptions): void;
  /** Cancel. The view stays where it is — no jump to the target. */
  stop(): void;
  isAnimating(): boolean;
  /** Where the in-flight animation is heading, or null when none is. */
  target(): View | null;
  /** Cancel unless the write that prompted this came from the runner's own
   *  per-frame write. Feed it from every channel that can move the camera. */
  stopIfExternal(): void;
}

/**
 * Animate the viewport `View`. Runs on the kit's {@link Animator} — pass one to
 * share a canvas's animator, or omit it and the hook makes its own.
 *
 * Every animation from one instance registers under that instance's cancel key,
 * so starting one cancels whatever *it* had in flight, and each starts from the
 * *live* view rather than a captured value — an interrupted camera never jumps.
 * Two instances on one animator are independent.
 */
export function useViewAnimation(view: ViewChannel, animator?: Animator): ViewAnimationApi {
  const own = useAnimator();
  const key = `${VIEW_ANIMATION_KEY}:${useId()}`;
  const viewRef = useRef(view);
  viewRef.current = view;
  const animatorRef = useRef<Animator>(animator ?? own);
  animatorRef.current = animator ?? own;
  const targetRef = useRef<View | null>(null);
  const writingRef = useRef(false);

  return useMemo<ViewAnimationApi>(() => {
    const isAnimating = () => animatorRef.current.isActive(key);
    const target = () => (isAnimating() ? targetRef.current : null);
    const stop = () => {
      animatorRef.current.cancelKey(key);
      targetRef.current = null;
    };

    const animate: ViewAnimationApi['animate'] = (to, opts = {}) => {
      const from = viewRef.current.get();
      const resolved = typeof to === 'function' ? to(target() ?? from) : to;
      stop();
      targetRef.current = resolved;
      animatorRef.current.tween<View>({
        from,
        to: resolved,
        ms: opts.ms ?? DEFAULT_MS,
        easing: opts.easing ?? easeOutCubic,
        interpolator: opts.interpolator ?? interpolateView,
        cancelKey: key,
        onTick: (v) => {
          writingRef.current = true;
          try { viewRef.current.set(v); } finally { writingRef.current = false; }
        },
        onDone: () => {
          targetRef.current = null;
          opts.onDone?.();
        },
      });
    };

    return {
      animate,
      animateToBounds: (bounds, dims, opts = {}) => {
        const current = viewRef.current.get();
        const fitted = fitViewToBounds(bounds, dims, current, opts);
        if (fitted === current) return; // helper bailed (zero-area bounds/viewport)
        animate(fitted, opts);
      },
      stop,
      isAnimating,
      target,
      stopIfExternal: () => { if (!writingRef.current) stop(); },
    };
  }, [key]);
}
