import { stateOf } from '../target';
import type { AnimationKind, PhysicsHandle, TargetPhysicsOptions } from '../types';
import type { AnimationContext, AnimationSeed } from './context';
import { absorb, axesFor, bump, minus, norm, plus, travel } from './offsets';
import { resolveSpringConstants } from './physicsAnimation';

/**
 * A spring or a coast on a target. A spring commits its destination as it starts and its voice
 * is what is left to travel. A coast has no destination: its voice is how far it has gone, which
 * it commits when it stops.
 */
export function startOffsetPhysics<T>(
  ctx: AnimationContext,
  o: TargetPhysicsOptions<T>,
  kind: AnimationKind,
): PhysicsHandle<T> {
  const { codec } = ctx;
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
  const seed = {
    id, kind, cancelKey: o.cancelKey, label: o.label, target: s, keepExisting: o.interrupt === false,
  } as AnimationSeed;
  if (o.cancelKey != null && !seed.keepExisting) {
    // Read ahead of the interrupt, which stops the voice whose velocity this is.
    velocity ??= ctx.holder(o.cancelKey, s as never)?.velocity.slice() ?? null;
    ctx.interrupt(o.cancelKey, seed);
  }
  const committed = ax.to(s.get());
  const start = travel(ax, given ?? committed, dest ?? committed);

  ctx.targets.attach(s as never);
  if (o.to != null) s.set(o.to);
  ctx.seedClock();
  s.slot = codec.spring({
    id, on: s, axes: ax.count,
    from: start, to: dest && zeros(), velocity: velocity ?? zeros(),
    stiffness, damping, mass,
  });
  bump(s as never, start, 1);

  let left = false;
  const leave = (keep: boolean): void => {
    if (left) return;
    left = true;
    const own = codec.own(id);
    if (own) {
      if (keep) absorb(s, own.value);
      bump(s as never, own.value, -1);
    }
    codec.stop(id);
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
  seed.tick = () => {
    if (ctx.tripwire()) { leave(true); return true; }
    const own = codec.own(id)!;
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
      const own = codec.own(id)!;
      if (next == null) {
        if (dest == null) return;
        dest = null;
        codec.recue(id, own.value, own.velocity, null);
        return;
      }
      const to = axesFor(ax, next, 'setTarget');
      if (!(stiffness > 0)) throw new Error(`${kind}: setTarget needs a positive stiffness`);
      // The committed value moves under the voice, which shifts by as much the other way.
      const shifted = plus(own.value, travel(ax, ax.to(s.get()), to));
      s.set(next);
      dest = to;
      codec.recue(id, shifted, own.velocity, zeros());
      bump(s as never, minus(shifted, own.value), 1);
    },
    setVelocity(v) {
      if (left) return;
      codec.push(id, axesFor(ax, v, 'setVelocity'));
    },
  };
}
