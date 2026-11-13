import { easeOutQuad, resolveEasing } from '@weasel-js/geom';
import type { ElementBinding } from '../../elementTarget';
import { stateOf, type TargetState } from '../../target';
import type {
  AnimationHandle, AnimationKind, PhysicsHandle, TargetPhysicsOptions, TargetTweenOptions,
} from '../../types';
import type { AnimationSeed } from '../context';
import { axesFor, plus, travel } from '../offsets';
import { constantsFor } from '../offsetPhysics';
import { eligible, free, refuse } from './eligible';
import type { Handoffs } from './handoffs';
import { physicsMotion, tweenMotion, type Motion } from './motion';
import { launch } from './run';
import { continueOnMainThread, type Carried } from './takeBack';

interface Begun {
  s: TargetState;
  binding: ElementBinding;
  seed: AnimationSeed;
}

/** Interrupts what holds the call's key and makes its seed, where the call can be handed off;
 *  null where it must run on the main thread. */
function begin(
  hs: Handoffs,
  o: TargetTweenOptions<unknown> | TargetPhysicsOptions<unknown>,
  kind: AnimationKind,
  ahead?: (s: TargetState) => void,
): Begun | null {
  const { ctx } = hs.host;
  const s = stateOf(o.target) as TargetState;
  const binding = eligible(hs.host, s, o);
  if (!binding) return null;
  const interrupts = o.interrupt !== false;
  const seed = {
    id: ctx.nextId(), kind, cancelKey: o.cancelKey, label: o.label, target: s, keepExisting: !interrupts,
  } as AnimationSeed;
  ahead?.(s);
  if (o.cancelKey != null && interrupts) ctx.interrupt(o.cancelKey, seed);
  if (!free(hs.host, s)) return refuse(o, 'something started on its target as the interrupted animation stopped');
  return { s, binding, seed };
}

/** A tween on an element target, handed to the compositor; null where it cannot be. */
export function handOffTween<T>(hs: Handoffs, o: TargetTweenOptions<T>): AnimationHandle | null {
  if (!(o.ms > 0)) return (o.compositor ?? 'off') === 'off' ? null : refuse(o, 'it has no duration');
  const begun = begin(hs, o as TargetTweenOptions<unknown>, 'tween');
  if (!begun) return null;
  const { ctx } = hs.host;
  const { s, binding, seed } = begun;
  const ax = s.axes as TargetState<T>['axes'];
  const fromValue = o.from ?? (s.get() as T);
  const from = axesFor(ax, fromValue, 'from');
  const to = axesFor(ax, o.to, 'to');
  const blend = o.interpolator ? o.interpolator(fromValue, o.to)
    : o.interpolate ? (u: number) => o.interpolate!(fromValue, o.to, u) : null;
  const motion = tweenMotion({
    ms: o.ms,
    easing: resolveEasing(o.easing ?? easeOutQuad),
    from,
    delta: travel(ax, to, from),
    path: blend && ((e) => ax.to(blend(e))),
  });
  s.set(o.to);
  if (ctx.atEnd()) seed.startAt = o.ms;
  seed.progress = (now) => Math.min(1, Math.max(0, now / o.ms));
  ctx.seedClock();
  const run = launch(hs, s, binding, motion, seed, {
    endCommit: () => null,
    takeBack: (m, local, backward, done) =>
      continueOnMainThread(ctx, { target: o.target, cancelKey: o.cancelKey, label: o.label }, m, local, backward, done),
    onDone: o.onDone,
  });
  const handle = ctx.register(seed);
  run.start();
  return handle;
}

/** A spring, a coast, or physics on an element target, handed to the compositor; null where it
 *  cannot be. */
export function handOffPhysics<T>(hs: Handoffs, o: TargetPhysicsOptions<T>, kind: AnimationKind): PhysicsHandle<T> | null {
  const { ctx } = hs.host;
  let velocity: number[] | null = null;
  const begun = begin(hs, o as TargetPhysicsOptions<unknown>, kind, (s) => {
    // Read ahead of the interrupt, which stops the animation whose velocity this is.
    if (o.velocity !== undefined) velocity = axesFor(s.axes, o.velocity, 'velocity');
    else if (o.cancelKey != null && o.interrupt !== false) velocity = ctx.velocityUnder(o.cancelKey, s);
  });
  if (!begun) return null;
  const { s, binding, seed } = begun;
  const ax = s.axes as TargetState<T>['axes'];
  let dest = o.to == null ? null : axesFor(ax, o.to, 'to');
  const constants = constantsFor(o, kind, dest != null);
  const restThreshold = o.restThreshold ?? 0.01;
  const start = o.from === undefined ? ax.to(s.get() as T) : axesFor(ax, o.from, 'from');
  // From the destination's side of each angle axis, so the spring turns the short way round.
  const motionFrom = (at: readonly number[], v: readonly number[]): Motion => physicsMotion({
    start: dest ? plus(dest, travel(ax, at, dest)) : at, velocity: v, to: dest, ...constants, threshold: restThreshold,
  });
  const motion = motionFrom(start, velocity ?? start.map(() => 0));
  if (motion.ms <= 0) {
    if (o.compositor === 'require') refuse(o, 'it starts at rest');
    return null;
  }
  if (o.to != null) s.set(o.to);
  ctx.seedClock();
  const carried = (): Carried<T> => ({
    target: o.target, cancelKey: o.cancelKey, label: o.label,
    physics: { kind, to: dest, ...constants, restThreshold },
  });
  const run = launch(hs, s, binding, motion, seed, {
    // A coast commits where it stops; a spring's destination is committed already.
    endCommit: (m) => (dest ? null : m.at(m.ms)),
    takeBack: (m, local, backward, done) => continueOnMainThread(ctx, carried(), m, local, backward, done),
    onDone: o.onDone,
  });
  const handle = ctx.register(seed);
  run.start();
  const here = (): [number[], number[]] => [run.motion.at(run.local()), run.motion.velocity(run.local())];
  return {
    ...handle,
    setTarget(next) {
      const child = run.child as PhysicsHandle<T> | null;
      if (child) { child.setTarget?.(next); return; }
      if (!ctx.has(seed.id)) return;
      const [at, v] = here();
      if (next == null) {
        if (dest == null) return;
        dest = null;
        // The committed value stops where the spring had brought it; the coast carries the rest.
        s.set(ax.from(at));
      } else {
        if (!(constants.stiffness > 0)) throw new Error(`${kind}: setTarget needs a positive stiffness`);
        dest = axesFor(ax, next, 'setTarget');
        s.set(next);
      }
      run.replace(motionFrom(at, v));
    },
    setVelocity(v) {
      const child = run.child as PhysicsHandle<T> | null;
      if (child) { child.setVelocity?.(v); return; }
      if (!ctx.has(seed.id)) return;
      run.replace(motionFrom(here()[0], axesFor(ax, v, 'setVelocity')));
    },
  };
}
