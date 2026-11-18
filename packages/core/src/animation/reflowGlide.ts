import { prefersReducedMotion } from '@weasel-js/react';
import type { PoseDescriptor } from '../core/geometry/poseDescriptor';
import type { PoseOverride } from '../core/scene/types';
import { liveAxes } from './poseTarget';
import { createTarget, type Target } from '@weasel-js/animator';
import type { Animator } from '@weasel-js/animator';
import type { ReflowTransitionOptions } from './reflow';

/** One node's glide: the override it shows and the slot it is heading for. */
export interface Glide<TPose> {
  entry: PoseOverride<TPose>;
  /** Where the layout wants the node shown: what its target commits. */
  slot: TPose;
  settling: boolean;
  /** Null for a pose with no axes, which glides by `lerp`. */
  target: Target<TPose> | null;
}

/** How long a glide takes when its options name no duration: none where the reader asked for less motion. */
const defaultMs = (): number => (prefersReducedMotion() ? 0 : 200);

/** A glide resting at `pose`, with an animation target when `descriptor` gives the pose axes.
 *  `shown` runs whenever the target moves the pose on screen. */
export function createGlide<TPose>(
  pose: TPose,
  descriptor: PoseDescriptor<TPose>,
  shown: () => void,
): Glide<TPose> {
  const g: Glide<TPose> = { entry: { pose }, slot: pose, settling: false, target: null };
  const axes = liveAxes(descriptor, () => g.slot);
  if (axes) {
    g.target = createTarget<TPose>({
      axes,
      get: () => g.slot,
      set: (slot) => { g.slot = slot; },
      show: (pose) => {
        g.entry.pose = pose;
        shown();
      },
    });
  }
  return g;
}

/** Start the animation carrying `g` from `from` to `to` under `cancelKey`. */
export function animateGlide<TPose>(
  animator: Animator,
  g: Glide<TPose>,
  from: TPose,
  to: TPose,
  o: ReflowTransitionOptions<TPose>,
  cancelKey: string,
  onDone: () => void,
  shown: () => void,
): void {
  const lerp = o.geometry?.lerp;
  const label = o.label ?? 'reflow';
  if (g.target) {
    // A spring interrupts what is moving the node and takes its velocity; a timed glide adds to it.
    if (o.spring) animator.spring<TPose>({ target: g.target, to, ...o.spring, cancelKey, label, onDone });
    else {
      animator.tween<TPose>({
        target: g.target, to, ms: o.ms ?? defaultMs(), easing: o.easing, cancelKey, interrupt: false, label, onDone,
        interpolate: lerp && ((a, b, t) => lerp(a, b, t)),
      });
    }
    return;
  }
  if (!lerp) throw new Error('useAnimatedReflow: this pose has no axes; supply geometry: { ..., lerp }');
  g.slot = to;
  const onTick = (p: number): void => {
    g.entry.pose = lerp(from, to, p);
    shown();
  };
  // The shared key is what retargets: the new animation interrupts the old.
  if (o.spring) animator.spring<number>({ from: 0, to: 1, ...o.spring, cancelKey, label, onTick, onDone });
  else animator.tween<number>({ from: 0, to: 1, ms: o.ms ?? defaultMs(), easing: o.easing, cancelKey, label, onTick, onDone });
}
