import { linear } from '@weasel-js/geom';
import type { Target } from '../../target';
import type { AnimationHandle, AnimationKind } from '../../types';
import type { AnimationContext } from '../context';
import { startOffsetPhysics } from '../offsetPhysics';
import { startOffsetTween } from '../offsetTween';
import type { Motion } from './motion';

/** What a taken-back run's continuation keeps of the call that started it. */
export interface Carried<T> {
  target: Target<T>;
  cancelKey?: string;
  label?: string;
  /** A spring or a coast, with its constants and destination, which carries on as physics
   *  going forward. */
  physics?: {
    kind: AnimationKind;
    to: readonly number[] | null;
    stiffness: number;
    damping: number;
    mass: number;
    restThreshold: number;
  };
}

/**
 * The rest of a handed-off run as a main-thread animation on the same target, from `local` ms
 * into `motion`. Going forward a spring or a coast carries on as physics from where it stands at
 * the speed it had, which is the same motion; a tween carries on along the rest of its path.
 * Going backward either runs its path back to its start. Under the run's `cancelKey`, taken
 * without interrupting, so a key reaches both.
 */
export function continueOnMainThread<T>(
  ctx: AnimationContext, c: Carried<T>, motion: Motion, local: number, backward: boolean, onDone: () => void,
): AnimationHandle {
  const { target } = c;
  const ax = target.axes;
  const at = (t: number): T => ax.from(motion.at(t));
  const shared = { target, cancelKey: c.cancelKey, interrupt: false, label: c.label, onDone } as const;
  const p = c.physics;
  // The destination's move goes back into the continuation, where a hold covers it, as it
  // covered the run's: the committed value steps back to where the run stands.
  const dest = target.committed();
  if (!backward) target.commit(at(local));
  if (!backward && p) {
    return startOffsetPhysics(ctx, {
      ...shared,
      to: p.to ? ax.from(p.to) : null,
      from: at(local),
      velocity: ax.from(motion.velocity(local)),
      stiffness: p.stiffness, damping: p.damping, mass: p.mass, restThreshold: p.restThreshold,
    }, p.kind);
  }
  if (!backward) {
    const left = Math.max(motion.ms - local, 1);
    return startOffsetTween(ctx, {
      ...shared, to: dest, ms: left, easing: linear,
      interpolator: () => (u) => at(local + u * left),
    });
  }
  const back = Math.max(local, 1);
  // The destination stays committed, as under a run played back on the main thread.
  return ctx.starting(true, () => startOffsetTween(ctx, {
    ...shared, to: dest, ms: back, easing: linear,
    interpolator: () => (u) => at(u * back),
  }));
}
