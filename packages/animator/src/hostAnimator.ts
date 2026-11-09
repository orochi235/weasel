/**
 * An animator with no React and no frame loop of its own: whoever hosts it drives its frames —
 * a render worker, sent each frame's time by the page, or any loop outside a component.
 */
import { ColorOverrideRegistry } from './colorRegistry';
import { createAnimatorCore } from './engine/core';
import { TrimOverrideRegistry } from './trimRegistry';
import type { Animator } from './types';

/** What a hosted animator asks of its host. */
export interface AnimatorHost {
  /** Now, on the clock the host's frame times are on. */
  now(): number;
  /** Something is running: the host should run a frame. */
  requestFrame(): void;
  /** Nothing is running any more. Default: nothing to do. */
  cancelFrame?(): void;
}

/** An animator and the frame calls its host makes. */
export interface HostedAnimator {
  animator: Animator;
  /** Run one frame at time `t`, on the host's clock. Throws on a `t` that is not finite. */
  tick(t: number): void;
  /** Run one frame at time `t` of an outside clock playing at `rate`, which may have gone back
   *  since the last: running animations then play backward over the difference. Throws on a `t`
   *  or `rate` that is not finite. */
  follow(t: number, rate: number): void;
  /** The host's frames stop for time nobody will see, which is charged to no animation. */
  suspended(): void;
  /** The host's frames are back after time nobody saw, which is charged to no animation. */
  resumed(): void;
  /** Cancel everything and clear the paint overrides. A frame after this does nothing. */
  dispose(): void;
}

/** Host an animator on frames the caller runs. `useAnimator` is the same on a visible frame loop. */
export function hostAnimator(host: AnimatorHost): HostedAnimator {
  let disposed = false;
  const colorOverrides = new ColorOverrideRegistry();
  const trimOverrides = new TrimOverrideRegistry();
  const core = createAnimatorCore({
    now: host.now,
    requestFrame: () => { if (!disposed) host.requestFrame(); },
    cancelFrame: () => host.cancelFrame?.(),
    tripwire: () => disposed,
    colorOverrides,
    trimOverrides,
  });
  return {
    animator: core.api,
    tick: (t) => { if (!disposed) core.tick(t); },
    follow: (t, rate) => { if (!disposed) core.follow(t, rate); },
    suspended: () => core.suspended(),
    resumed: () => core.resumed(),
    dispose() {
      if (disposed) return;
      core.api.cancelAll();
      colorOverrides.clearAll();
      trimOverrides.clearAll();
      disposed = true;
    },
  };
}
