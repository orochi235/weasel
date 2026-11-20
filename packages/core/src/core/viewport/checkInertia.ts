/** @internal Throws a `RangeError` on a `friction` outside (0, 1) or a `minSpeed` that is not positive:
 *  a coast under either never comes to rest. */
export function checkInertia(who: string, { friction, minSpeed }: { friction?: number; minSpeed?: number }): void {
  if (friction !== undefined && !(friction > 0 && friction < 1)) {
    throw new RangeError(`${who}: friction is the share of speed a coast keeps each frame, in (0, 1), not ${friction}`);
  }
  if (minSpeed !== undefined && !(minSpeed > 0)) {
    throw new RangeError(`${who}: minSpeed is the speed a coast stops below, and must be positive, not ${minSpeed}`);
  }
}
