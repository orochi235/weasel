import { useId, useMemo, useRef } from 'react';
import { useKitSetting, useLatest, usePrefersReducedMotion } from '@weasel-js/react';
import { useAnimator } from '@weasel-js/animator/react';
import { easeOutCubic } from '@weasel-js/geom';
import type { Animator, EasingSpec, InterpolatorFactory } from '@weasel-js/animator';
import { createTarget, type Target, type TargetAxes } from '@weasel-js/animator';
import { interpolateView } from './interpolateView';
import { fitViewToBounds } from './fitViewToBounds';
import type { Bounds, FitViewToBoundsOptions, ViewportDims } from './fitViewToBounds';
import { normalizeView, type View } from './view';

/** Cancel-key prefix. Each hook instance appends its own id, so two runners
 *  sharing an animator do not cancel each other. */
export const VIEW_ANIMATION_KEY = 'view';

/** How long an animated camera move takes, in ms, where nothing says otherwise. */
export const DEFAULT_VIEW_ANIMATION_MS = 250;

/** How the camera should move. */
export interface ViewAnimationOptions {
  /** Duration in ms. Default the `view.animationMs` kit setting, else `DEFAULT_VIEW_ANIMATION_MS`;
   *  0 under `prefers-reduced-motion`. */
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

/** The camera animation surface. Its own animations run one at a time. */
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
  /**
   * The view as a {@link Target}, for running another animation on it: a shake
   * or a nudge adds to a camera animation in flight, and neither cancels the
   * other. Move it with the animator this runner was given, and without this
   * runner's cancel key. `stop` and an outside write leave such an animation
   * running.
   */
  readonly viewTarget: Target<View>;
}

/** A `View` as the four numbers an animation moves: `x`, `y`, `scale.x`, `scale.y`. */
export const viewAxes: TargetAxes<View> = {
  count: 4,
  names: ['x', 'y', 'scale.x', 'scale.y'],
  to: (v) => [v.x, v.y, v.scale.x, v.scale.y],
  from: (a) => ({ x: a[0]!, y: a[1]!, scale: { x: a[2]!, y: a[3]! } }),
  add: (v, d) => ({ x: v.x + d[0]!, y: v.y + d[1]!, scale: { x: v.scale.x + d[2]!, y: v.scale.y + d[3]! } }),
  write: (v, out, at) => {
    out[at] = v.x;
    out[at + 1] = v.y;
    out[at + 2] = v.scale.x;
    out[at + 3] = v.scale.y;
  },
};

/**
 * Animate the viewport `View`. Runs on the kit's {@link Animator} — pass one to
 * share a canvas's animator, or omit it and the hook makes its own. A caller
 * that always has one should use {@link useViewAnimationOn}, which builds none.
 *
 * Every animation from one instance registers under that instance's cancel key,
 * so starting one cancels whatever *it* had in flight, and each starts from where
 * the last one was rather than a captured value — an interrupted camera never jumps.
 * Two instances on one animator are independent. The view is a target
 * ({@link ViewAnimationApi.viewTarget}), so other animations can add to the camera's.
 */
export function useViewAnimation(view: ViewChannel, animator?: Animator): ViewAnimationApi {
  const own = useAnimator();
  return useViewAnimationOn(view, animator ?? own);
}

/** {@link useViewAnimation} on an animator the caller owns. Constructs no
 *  animator of its own, so the camera runs on exactly the one passed. */
export function useViewAnimationOn(view: ViewChannel, animator: Animator): ViewAnimationApi {
  const key = `${VIEW_ANIMATION_KEY}:${useId()}`;
  const viewRef = useLatest(view);
  const animatorRef = useLatest(animator);
  /** Where this runner's own animation is heading. */
  const targetRef = useRef<View | null>(null);
  const writingRef = useRef(false);
  const setting = useKitSetting('view.animationMs') ?? DEFAULT_VIEW_ANIMATION_MS;
  const msRef = useLatest(usePrefersReducedMotion() ? 0 : setting);

  return useMemo(
    () => createViewAnimation(key, viewRef, animatorRef, targetRef, writingRef, msRef),
    [key, viewRef, animatorRef, msRef],
  );
}

/** The runner behind {@link useViewAnimationOn}. */
function createViewAnimation(
  key: string,
  viewRef: { readonly current: ViewChannel },
  animatorRef: { readonly current: Animator },
  targetRef: { current: View | null },
  writingRef: { current: boolean },
  /** The duration a move takes when its own options name none. */
  msRef: { readonly current: number },
): ViewAnimationApi {
  // The value the target's animations add to. While any is in flight it is kept here, apart
  // from the channel, which holds the folded view; null says to work it out from the channel.
  let committed: View | null = null;
  /** What the animations in flight added to the channel's view when `committed` was dropped. */
  let offset: number[] | null = null;
  const base = (): View => {
    if (committed) return committed;
    const live = viewRef.current.get();
    return offset ? viewAxes.from(viewAxes.to(live).map((n, i) => n - offset![i]!)) : live;
  };
  const write = (v: View): void => {
    writingRef.current = true;
    try { viewRef.current.set(normalizeView(v)); } finally { writingRef.current = false; }
  };
  const viewTarget: Target<View> = createTarget<View>({
    axes: viewAxes,
    get: base,
    set: (v) => { committed = v; offset = null; },
    show: (v) => {
      if (viewTarget.active) {
        if (!committed) { committed = base(); offset = null; }
        write(v);
        return;
      }
      // At rest. A stop or an outside write left the view as it stands; a finish lands it.
      const landed = committed;
      committed = offset = null;
      if (landed) write(landed);
    },
  });

  const isAnimating = () => animatorRef.current.isActive(key);
  const target = () => (isAnimating() ? targetRef.current : null);
  /** Cancels this runner's animation; whatever else moves the view goes on from where it was. */
  const cancel = (): void => {
    animatorRef.current.cancelKey(key);
    targetRef.current = null;
  };
  const stop = () => {
    cancel();
    if (!viewTarget.active) committed = offset = null;
  };

  const animate: ViewAnimationApi['animate'] = (to, opts = {}) => {
    const resolved = normalizeView(typeof to === 'function' ? to(target() ?? base()) : to);
    targetRef.current = resolved;
    animatorRef.current.tween<View>({
      target: viewTarget,
      to: resolved,
      ms: opts.ms ?? msRef.current,
      easing: opts.easing ?? easeOutCubic,
      interpolator: opts.interpolator ?? interpolateView,
      cancelKey: key,
      onDone: () => {
        targetRef.current = null;
        // Ahead of the frame's own write, so `onDone` reads the view it finished on.
        write(viewTarget.read());
        if (!viewTarget.active) committed = offset = null;
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
    stopIfExternal: () => {
      if (writingRef.current) return;
      cancel();
      // The writer read the folded view, so what is still in flight stays on top of its write.
      if (viewTarget.active) {
        const shown = viewAxes.to(viewTarget.read());
        const under = viewAxes.to(base());
        offset = shown.map((n, i) => n - under[i]!);
      } else {
        offset = null;
      }
      committed = null;
    },
    viewTarget,
  };
}
