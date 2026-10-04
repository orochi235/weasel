export interface VectorOps<T> {
  add(a: T, b: T): T;
  subtract(a: T, b: T): T;
  scale(v: T, k: number): T;
}

/** One semi-implicit Euler step of a damped spring toward `target`, or of pure damping when
 *  `target` is null. Returns the new value and velocity. */
export function stepSpring<T>(
  ops: VectorOps<T>,
  value: T, velocity: T, target: T | null,
  k: number, damping: number, mass: number, dt: number,
): { value: T; velocity: T } {
  const ref = target ?? value;
  const displacement = ops.subtract(value, ref);
  const springForce = ops.scale(displacement, target == null ? 0 : -k);
  const dampingForce = ops.scale(velocity, -damping);
  const accel = ops.scale(ops.add(springForce, dampingForce), 1 / mass);
  const v = ops.add(velocity, ops.scale(accel, dt));
  return { value: ops.add(value, ops.scale(v, dt)), velocity: v };
}
