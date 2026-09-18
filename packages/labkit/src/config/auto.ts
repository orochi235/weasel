/**
 * Written at a config path to mean "do not pin this — let the instrument
 * decide". Accepted by `setConfig`, by a trial's `configSeed`, and by
 * `.initial()` in a schema. It is normalized into the trial's set of unpinned
 * paths on the way into the store and is never itself stored, so a serialized
 * trial contains no sentinel and the last pinned value survives.
 */
export const auto: unique symbol = Symbol('weasel.auto');

/** The type of the `auto` sentinel, for widening a value parameter. */
export type Auto = typeof auto;

export function isAuto(value: unknown): value is Auto {
  return value === auto;
}
