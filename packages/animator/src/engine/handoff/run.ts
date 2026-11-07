import type { ElementAnimation, ElementBinding } from '../../elementTarget';
import type { TargetState } from '../../target';
import type { AnimationHandle } from '../../types';
import type { AnimationSeed } from '../context';
import type { Handoffs, Placed } from './handoffs';
import { keptSamples, sampleTimes, type Motion } from './motion';

/** At most this many keyframes a run: a long one is sampled more coarsely. */
const MOST_KEYFRAMES = 600;

/** What a run does as it ends, is canceled, or is taken back, which differs by kind. */
export interface RunEnds {
  /** Where it commits on ending at its end; null where its destination is committed already. */
  endCommit(motion: Motion): number[] | null;
  /** Starts the rest of the run on the main thread from `local` ms into `motion`, playing
   *  backward when `backward`. `onDone` ends this run. */
  takeBack(motion: Motion, local: number, backward: boolean, onDone: () => void): AnimationHandle;
  onDone?: () => void;
}

/** A run handed to the compositor: its motion, the browser animation showing it, and the
 *  main-thread animation that carries on from it once it is taken back. */
export interface Run {
  readonly motion: Motion;
  /** ms into its motion its own clock stands. */
  local(): number;
  /** The animation carrying on from it on the main thread, once taken back. */
  readonly child: AnimationHandle | null;
  /** Starts its motion over as `motion` from where its clock stands. */
  replace(motion: Motion): void;
}

function animate(binding: ElementBinding, s: TargetState, motion: Motion): ElementAnimation {
  const ms = Math.max(motion.ms, 1);
  const times = sampleTimes(ms, binding.sampleRate, MOST_KEYFRAMES);
  const rows = times.map((t) => motion.at(t));
  const frames = keptSamples(times, rows).map((k) => ({ ...binding.style(s.axes.from(rows[k]!)), offset: times[k]! / ms }));
  return binding.element.animate(frames, { duration: ms, fill: 'both', easing: 'linear' });
}

/** Puts `next` in `old`'s place among the runs kept on the animator's clock, and cancels `old`. */
function swap(hs: Handoffs, old: Placed, next: Placed): void {
  old.animation.cancel();
  hs.remove(old);
  hs.add(next);
  hs.place(next);
}

/**
 * Hands `motion` on `s` to the compositor as the animation `seed` registers, and fills in the
 * seed's tick, cancel, and rate hooks. The caller registers the seed, then calls `start` with
 * the handle.
 */
export function launch(
  hs: Handoffs, s: TargetState, binding: ElementBinding, first: Motion, seed: AnimationSeed, ends: RunEnds,
): Run & { start(): void } {
  const { ctx, table } = hs.host;
  const { id } = seed;
  let motion = first;
  let placed: Placed = { id, animation: animate(binding, s, motion), offset: 0 };
  let child: AnimationHandle | null = null;
  let gone = false;
  /** The browser animation reached its end, or its start played backward. */
  let finished = false;
  /** Asks for the frame that ends the run once the browser animation has: the run asks for no
   *  frames until then. Its own clock decides whether it has ended, since the browser's counts
   *  time the animator's does not, such as time hidden. */
  const onFinish = (animation: ElementAnimation): void => {
    animation.onfinish = () => {
      if (gone || animation !== placed.animation) return;
      finished = true;
      ctx.defer(id, 0);
      ctx.wake();
    };
  };
  onFinish(placed.animation);

  const entry = () => table.animations.get(id);
  const local = (): number => {
    const a = entry();
    return Math.min(motion.ms, Math.max(0, (a ? table.clockOf(a) : 0) - placed.offset));
  };
  /** Lets go of the target and the browser animation, showing `value` inline first. */
  const letGo = (value: readonly number[] | null): void => {
    if (gone) return;
    gone = true;
    if (value) binding.write(s.axes.from(value));
    placed.animation.cancel();
    hs.remove(placed);
    if (s.handoff === handoff) s.handoff = null;
    const a = entry();
    if (a) a.compositor = false;
  };
  const end = (atStart: boolean): true => {
    const at = atStart ? motion.at(0) : ends.endCommit(motion);
    if (at && !s.discard) s.set(s.axes.from(at));
    letGo(at ?? s.axes.to(s.get()));
    ctx.reportEnd(id);
    ends.onDone?.();
    return true;
  };
  const release = (): void => {
    if (gone) return;
    const a = entry();
    const backward = a ? table.rateOf(a) < 0 : false;
    const at = local();
    letGo(null);
    child = ends.takeBack(motion, at, backward, () => {
      if (!ctx.has(id)) return;
      ctx.reportEnd(id);
      ends.onDone?.();
      ctx.finish(id);
    });
    if (a?.paused) child.pause();
    if (a && a.timeScale !== 1) child.setTimeScale(a.timeScale);
    ctx.defer(id, Infinity);
  };
  const handoff = {
    read: () => motion.at(local()),
    release,
    stop: () => { table.retire(id); },
  };

  seed.compositor = true;
  seed.idle = true;
  seed.due = motion.ms;
  seed.velocity = () => (gone ? s.axes.to(s.get()).map(() => 0) : motion.velocity(local()));
  seed.tick = (nowMs, scale) => {
    if (child) return false;
    if (ctx.tripwire()) { letGo(motion.at(local())); return true; }
    const at = nowMs - placed.offset;
    if (scale < 0 && at <= 0) return end(true);
    if (at >= motion.ms) return end(false);
    // The browser ended ahead of the animator's clock: placed back, it finishes again.
    if (finished) { finished = false; hs.place(placed); ctx.defer(id, motion.ms - at); }
    return false;
  };
  seed.onCancel = () => {
    if (child) { child.cancel(); return; }
    if (gone) return;
    const value = motion.at(local());
    if (!s.discard) s.set(s.axes.from(value));
    letGo(s.discard ? s.axes.to(s.get()) : value);
  };
  seed.onRate = (paused, timeScale) => {
    if (child) {
      if (paused) child.pause(); else child.resume();
      child.setTimeScale(timeScale);
    } else if (!gone) hs.place(placed);
  };
  s.handoff = handoff;

  return {
    get motion() { return motion; },
    local,
    get child() { return child; },
    start() { hs.add(placed); hs.place(placed); },
    replace(next) {
      if (gone) return;
      const a = entry();
      const offset = a ? table.clockOf(a) : 0;
      const old = placed;
      motion = next;
      placed = { id, animation: animate(binding, s, motion), offset };
      finished = false;
      onFinish(placed.animation);
      swap(hs, old, placed);
      ctx.defer(id, motion.ms);
    },
  };
}
