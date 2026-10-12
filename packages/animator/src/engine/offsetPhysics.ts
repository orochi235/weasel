import { stateOf } from '../target';
import type { AnimationKind, PhysicsHandle, TargetPhysicsOptions } from '../types';
import type { AnimationContext, AnimationSeed } from './context';
import { absorb, axesFor, comeOut, commitOffset, goBehind, minus, norm, plus, takeUp, times, travel } from './offsets';
import { resolveSpringConstants } from './physicsAnimation';
import { createSpringVoices } from './springVoices';

const any = (a: readonly number[]): boolean => a.some((x) => x !== 0);

/**
 * A spring or a coast on a target. A spring commits its destination as it starts and its voices
 * are what is left to travel. A coast has no destination: its voice is how far it has gone, which
 * it commits when it stops.
 */
export function startOffsetPhysics<T>(
  ctx: AnimationContext,
  o: TargetPhysicsOptions<T>,
  kind: AnimationKind,
): PhysicsHandle<T> {
  const s = stateOf(o.target);
  const ax = s.axes;
  const { stiffness, damping, mass } = resolveSpringConstants(o);
  let dest = o.to == null ? null : axesFor(ax, o.to, 'to');
  if (!(damping > 0) || !(mass > 0) || (dest && !(stiffness > 0))) {
    throw new Error(`${kind}: an animation on a target needs positive damping and mass, and stiffness to reach \`to\``);
  }
  const given = o.from === undefined ? null : axesFor(ax, o.from, 'from');
  let velocity = o.velocity === undefined ? null : axesFor(ax, o.velocity, 'velocity');
  const restThreshold = o.restThreshold ?? 0.01;
  const zeros = (): number[] => new Array<number>(ax.count).fill(0);

  const id = ctx.nextId();
  const interrupts = o.interrupt !== false;
  const seed = {
    id, kind, cancelKey: o.cancelKey, label: o.label, target: s, keepExisting: !interrupts,
  } as AnimationSeed;
  if (o.cancelKey != null && interrupts) {
    // Read ahead of the interrupt, which stops the voices whose velocity this is.
    velocity ??= ctx.velocityUnder(o.cancelKey, s as never);
    ctx.interrupt(o.cancelKey, seed);
  }
  const before = ax.to(s.get());
  const committed = dest ? takeUp(s) : before;
  const start = travel(ax, given ?? committed, dest ?? committed);
  /** The move the destination makes in the committed value; the rest of `start` rides on top. */
  const move = dest ? travel(ax, before, dest) : zeros();

  ctx.targets.attach(s as never);
  if (o.to != null) s.set(o.to);
  ctx.seedClock();
  const voices = createSpringVoices(ctx.codec, s as never, { id, nextId: ctx.nextId, stiffness, damping, mass });
  if (any(move)) voices.move(move);
  const top = minus(start, move);
  if (!any(move) || any(top) || (velocity && any(velocity))) voices.rest(top, velocity ?? zeros(), dest == null);
  const behind = goBehind(s, voices.moved);

  let left = false;
  const leave = (commit: boolean): void => {
    if (left) return;
    left = true;
    const moved = voices.moved();
    const shown = comeOut(s, behind, moved);
    if (commit) commitOffset(s, voices.own().value, moved, shown);
    voices.stop();
    ctx.targets.detach(s as never);
  };
  const finish = (): void => {
    // A coast commits where it stopped; a spring drops what is left under the threshold.
    leave(dest == null);
    ctx.reportEnd(id);
    o.onDone?.();
  };

  let ticked = false;
  seed.onCancel = () => leave(true);
  seed.onRate = (paused, timeScale) => voices.rate(paused ? 0 : timeScale);
  seed.velocity = () => voices.own().velocity;
  seed.tick = () => {
    if (ctx.tripwire()) { leave(true); return true; }
    const own = voices.own();
    // A coast too slow to move ends at once rather than emit a tick and wait a frame.
    if (!ticked && dest == null && norm(own.velocity) < restThreshold) {
      finish();
      return true;
    }
    ticked = true;
    o.onTick?.(ax.from(plus(dest ?? ax.to(s.get()), own.value)));
    if (!ctx.has(id)) return true;
    if (norm(own.velocity) >= restThreshold || (dest && norm(own.value) >= restThreshold)) return false;
    if (dest) o.onTick?.(ax.from(dest));
    if (!ctx.has(id)) return true;
    finish();
    return true;
  };
  const base = ctx.register(seed);

  return {
    ...base,
    setTarget(next) {
      if (left) return;
      const own = voices.own();
      if (next == null) {
        if (dest == null) return;
        // The committed value stops where the spring had brought it; the coast carries the rest.
        const moved = voices.moved();
        absorb(s, behind.kept ? times(moved, behind.kept) : moved);
        dest = null;
        voices.rest(minus(own.value, moved), own.velocity, true);
        voices.settleMove();
        return;
      }
      const to = axesFor(ax, next, 'setTarget');
      if (!(stiffness > 0)) throw new Error(`${kind}: setTarget needs a positive stiffness`);
      // The committed value moves under the voices, which shift by as much the other way.
      const shift = travel(ax, ax.to(s.get()), to);
      s.set(next);
      if (dest == null) voices.rest(own.value, own.velocity, false);
      dest = to;
      voices.move(shift);
      ctx.targets.showNow(s as never);
    },
    setVelocity(v) {
      if (left) return;
      voices.push(axesFor(ax, v, 'setVelocity'));
    },
  };
}
