import { easeOut, resolveEasing, type EasingSpec } from '@weasel-js/geom';
import type { AnimationHandle, Animator, Target, TargetSpringOptions } from '@weasel-js/animator';

/** A move of a pose between the document pose it began at and the one it commits. */
interface Ends<TPose> {
  /** The document pose before the move: what an undo of it writes back. */
  start: TPose;
  /** The pose the move commits. */
  to: TPose;
  cancelKey: string;
  /** Called when the move arrives at `to`, never when it arrives back at `start`. */
  onDone?: () => void;
}

/** What {@link rewindingTween} takes. */
export interface RewindingTween<TPose> extends Ends<TPose> {
  /** Where the move appears to start. */
  from: TPose;
  ms: number;
  easing?: EasingSpec;
  interpolate?: (a: TPose, b: TPose, t: number) => TPose;
}

/** What {@link rewindingSpring} takes. */
export interface RewindingSpring<TPose> extends Ends<TPose> {
  from: TPose;
  tuning: Pick<TargetSpringOptions<TPose>, 'preset' | 'stiffness' | 'damping' | 'mass'>;
}

/** A handle that answers for whichever leg of a move is running. */
function following(current: () => AnimationHandle): AnimationHandle {
  return {
    get id() { return current().id; },
    cancel: () => current().cancel(),
    pause: () => current().pause(),
    resume: () => current().resume(),
    setTimeScale: (s) => current().setTimeScale(s),
    timeScale: () => current().timeScale(),
    isPaused: () => current().isPaused(),
  };
}

/** Whether the document holds `pose`, as the target's axes read both. */
function holds<TPose>(target: Target<TPose>, pose: TPose): boolean {
  const doc = target.axes.to(target.committed());
  const want = target.axes.to(pose);
  return doc.every((x, i) => x === want[i]);
}

/**
 * A tween of `target` from `start` to `to` that follows the document when the move is undone
 * and redone mid-flight: once the document holds the pose at its other end, it turns around
 * and travels there along the positions it passed, at the pace it passed them. Any other
 * write still wins at once, as it does for a plain move.
 */
export function rewindingTween<TPose>(
  animator: Animator, target: Target<TPose>, o: RewindingTween<TPose>,
): AnimationHandle {
  const ease = resolveEasing(o.easing ?? easeOut);
  const { ms } = o;
  let current: AnimationHandle;

  /** Travels from `from`, the pose on screen with the move `at` ms along, toward `to` when
   *  `forward` and back toward `start` when not. */
  const leg = (at: number, forward: boolean, from: TPose): void => {
    const first = at === 0 && forward;
    const done = ms > 0 ? ease(at / ms) : 1;
    const span = forward ? ms - at : at;
    const dest = forward ? o.to : o.start;
    // Nothing of the move lies that way: the pose is at that end already.
    if (!first && (span < 1 || (forward ? done >= 1 : done <= 0))) {
      target.stop({ commit: false });
      if (forward) o.onDone?.();
      return;
    }
    // The share of this leg's travel covered `v` of the way through its time.
    const easing = forward
      ? (v: number) => (ease((at + span * v) / ms) - done) / (1 - done)
      : (v: number) => 1 - ease((at * (1 - v)) / ms) / done;
    const mine: AnimationHandle = current = animator.tween<TPose>({
      target,
      from,
      to: dest,
      ms: span,
      easing: first ? ease : easing,
      cancelKey: o.cancelKey,
      interrupt: false,
      interpolate: o.interpolate,
      onDone: forward ? o.onDone : undefined,
      onTick(value) {
        if (holds(target, dest) || !holds(target, forward ? o.start : o.to)) return;
        const elapsed = animator.live().find((row) => row.id === mine.id)?.elapsed ?? 0;
        const now = at + (forward ? 1 : -1) * Math.min(span, elapsed);
        target.stop({ commit: false });
        leg(now, !forward, value);
      },
    });
  };
  leg(0, true, o.from);
  return following(() => current);
}

/**
 * A spring of `target` from `start` to `to` that follows the document as
 * {@link rewindingTween} does: it springs toward the pose at its other end from where it is,
 * at the speed it has.
 */
export function rewindingSpring<TPose>(
  animator: Animator, target: Target<TPose>, o: RewindingSpring<TPose>,
): AnimationHandle {
  let current: AnimationHandle;
  const leg = (forward: boolean, from: TPose): void => {
    const dest = forward ? o.to : o.start;
    current = animator.spring<TPose>({
      target,
      from,
      to: dest,
      ...o.tuning,
      // Under the key it interrupts the leg before it, and starts at that one's velocity.
      cancelKey: o.cancelKey,
      onDone: forward ? o.onDone : undefined,
      onTick(value) {
        if (holds(target, dest) || !holds(target, forward ? o.start : o.to)) return;
        leg(!forward, value);
      },
    });
  };
  leg(true, o.from);
  return following(() => current);
}
