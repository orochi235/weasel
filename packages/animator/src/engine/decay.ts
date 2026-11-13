import type { DecayOptions, PhysicsOptions, TargetDecayOptions, TargetPhysicsOptions } from '../types';

/** A decay as the coast `physics` runs. Per-second friction v(t) = v0 * friction^t is
 *  m*dv/dt = -c*v with c = -ln(friction), m = 1, k = 0. */
export function decayAsPhysics<T>(o: DecayOptions<T> | TargetDecayOptions<T>): PhysicsOptions<T> | TargetPhysicsOptions<T> {
  const friction = o.friction ?? 0.95;
  if (!(friction > 0 && friction <= 1)) throw new RangeError(`decay: friction is a multiplier in (0, 1] a second, not ${friction}`);
  if (o.target && friction === 1) throw new RangeError('decay: a coast on a target needs friction below 1, which it stops by');
  const shared = {
    from: o.from, to: null, velocity: o.velocity,
    stiffness: 0, damping: -Math.log(friction), mass: 1, restThreshold: o.threshold ?? 0.5,
    onTick: o.onTick, onDone: o.onDone, cancelKey: o.cancelKey, label: o.label,
  };
  if (o.target) return { ...shared, target: o.target, interrupt: o.interrupt, compositor: o.compositor };
  return {
    ...shared,
    from: o.from,
    onTick: o.onTick,
    add: o.add,
    // DecayOptions doesn't carry subtract; derive from add+scale.
    subtract: (a, b) => o.add(a, o.scale(b, -1)),
    scale: o.scale,
    magnitude: o.magnitude,
  };
}
