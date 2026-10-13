/**
 * The soonest a damped spring toward 0 can be at rest, in ms from where it stands at `value`
 * and `velocity`: under `threshold` in both, each as a length over the axes.
 *
 * Damping takes energy out no faster than `2 * damping / mass` of it a second, and at rest the
 * energy is under what `threshold` in both would hold, so the spring cannot be at rest before
 * its energy has had time to fall that far. Never later than the rest itself, and sooner by
 * more the less the spring is damped. With a `stiffness` of 0 it is a coast, at rest once it
 * is slow, and the answer is when that is.
 */
export function earliestRest(
  value: readonly number[],
  velocity: readonly number[],
  stiffness: number,
  damping: number,
  mass: number,
  threshold: number,
): number {
  let energy = 0;
  for (let i = 0; i < value.length; i++) energy += stiffness * value[i]! ** 2 + mass * velocity[i]! ** 2;
  const atRest = (stiffness + mass) * threshold ** 2;
  if (!(energy > atRest)) return 0;
  return ((1000 * mass) / (2 * damping)) * Math.log(energy / atRest);
}
