import { easeOutQuad, resolveEasing } from '@weasel-js/geom';
import type { ElementBinding } from '../../elementTarget';
import { stateOf, type TargetState } from '../../target';
import type {
  AnimationHandle, AnimationKind, PhysicsHandle, TargetPhysicsOptions, TargetTweenOptions,
} from '../../types';
import type { AnimationSeed } from '../context';
import { axesFor, plus, travel } from '../offsets';
import { constantsFor, startOffsetPhysics } from '../offsetPhysics';
import { startOffsetTween } from '../offsetTween';
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
 *  null where it must run on the main thread. `ahead` reads and checks the call's own input
 *  first, so a call refused for it leaves what holds its key running. A number is the id the
 *  interrupt named, where the call must then run on the main thread under it. */
function begin(
  hs: Handoffs,
  o: TargetTweenOptions<unknown> | TargetPhysicsOptions<unknown>,
  kind: AnimationKind,
  ahead: (s: TargetState) => void,
): Begun | number | null {
  const { ctx } = hs.host;
  const s = stateOf(o.target) as TargetState;
  const binding = eligible(hs.host, s, o);
  if (!binding) return null;
  ahead(s);
  const interrupts = o.interrupt !== false;
  const seed = {
    id: ctx.nextId(), kind, cancelKey: o.cancelKey, label: o.label, target: s, keepExisting: !interrupts,
  } as AnimationSeed;
  if (o.cancelKey != null && interrupts) ctx.interrupt(o.cancelKey, seed);
  if (!free(hs.host, s)) {
    refuse(o, 'something started on its target as the interrupted animation stopped');
    return seed.id;
  }
  return { s, binding, seed };
}

/** A tween on an element target, handed to the compositor; null where it cannot be. */
export function handOffTween<T>(hs: Handoffs, o: TargetTweenOptions<T>): AnimationHandle | null {
  if (!(o.ms > 0 && o.ms < Infinity)) {
    return (o.compositor ?? 'off') === 'off' ? null : refuse(o, o.ms > 0 ? 'it never ends' : 'it has no duration');
  }
  let to: number[] = [];
  let easing: (u: number) => number = easeOutQuad;
  const begun = begin(hs, o as TargetTweenOptions<unknown>, 'tween', (s) => {
    to = axesFor(s.axes, o.to, 'to');
    if (o.from !== undefined) axesFor(s.axes, o.from, 'from');
    easing = resolveEasing(o.easing ?? easeOutQuad);
  });
  if (begun === null) return null;
  const { ctx } = hs.host;
  if (typeof begun === 'number') return startOffsetTween(ctx, o, begun);
  const { s, binding, seed } = begun;
  const ax = s.axes as TargetState<T>['axes'];
  const fromValue = o.from ?? (s.get() as T);
  const from = axesFor(ax, fromValue, 'from');
  const blend = o.interpolator ? o.interpolator(fromValue, o.to)
    : o.interpolate ? (u: number) => o.interpolate!(fromValue, o.to, u) : null;
  const motion = tweenMotion({
    ms: o.ms,
    easing,
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
  let dest: number[] | null = null;
  let given: number[] | null = null;
  let constants = {} as ReturnType<typeof constantsFor>;
  const begun = begin(hs, o as TargetPhysicsOptions<unknown>, kind, (s) => {
    dest = o.to == null ? null : axesFor(s.axes, o.to, 'to');
    constants = constantsFor(o, kind, dest != null);
    given = o.from === undefined ? null : axesFor(s.axes, o.from, 'from');
    // Read ahead of the interrupt, which stops the animation whose velocity this is.
    if (o.velocity !== undefined) velocity = axesFor(s.axes, o.velocity, 'velocity');
    else if (o.cancelKey != null && o.interrupt !== false) velocity = ctx.velocityUnder(o.cancelKey, s);
  });
  if (begun === null) return null;
  if (typeof begun === 'number') return startOffsetPhysics(ctx, o, kind, { id: begun, velocity });
  const { s, binding, seed } = begun;
  const ax = s.axes as TargetState<T>['axes'];
  const restThreshold = o.restThreshold ?? 0.01;
  const start = given ?? ax.to(s.get() as T);
  // From the destination's side of each angle axis, so the spring turns the short way round.
  const motionFrom = (at: readonly number[], v: readonly number[]): Motion => physicsMotion({
    start: dest ? plus(dest, travel(ax, at, dest)) : at, velocity: v, to: dest, ...constants, threshold: restThreshold,
  });
  const motion = motionFrom(start, velocity ?? start.map(() => 0));
  if (motion.ms <= 0) {
    if (o.compositor === 'require') refuse(o, 'it starts at rest');
    // Its interrupt has run, naming this id: the main thread takes both, and the velocity read.
    return startOffsetPhysics(ctx, o, kind, { id: seed.id, velocity });
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
