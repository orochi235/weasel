/**
 * A reader of a part each owner gets once: the first read of an owner makes its part with `make`, and every
 * later read of that owner returns the same part. Parts are held weakly, so one goes when its owner does.
 *
 * `make` takes the owner alone. A part that also turns on another argument is not the owner's part: the
 * first caller's argument would decide it for every later one.
 *
 * ```ts
 * export const transportHoldOf = createPart((clock: TrialClock) => createTransportHold(clock));
 * ```
 */
export function createPart<O extends object, P>(make: (owner: O) => P): (owner: O) => P {
  const parts = new WeakMap<O, P>();
  return (owner) => {
    if (parts.has(owner)) return parts.get(owner) as P;
    const part = make(owner);
    parts.set(owner, part);
    return part;
  };
}

let nextSerial = 0;
const serialOf = createPart((_owner: object): number => nextSerial++);

/** A string naming `v` for a cache or memo key: its type and value when primitive, and a serial of its own when an
 *  object or function, so two values share a key only when they are equal primitives or the same object. */
export function identityKeyOf(v: unknown): string {
  if ((typeof v !== 'object' && typeof v !== 'function') || v === null) return `${typeof v}:${String(v)}`;
  return `#${serialOf(v)}`;
}
