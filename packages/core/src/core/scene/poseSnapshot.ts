/**
 * Comparing a pose against what it was, by value.
 *
 * For readers that cannot be told when a pose moved. A pose override mutates
 * its buffer in place, so holding the pose object and comparing references
 * sees nothing; holding a *copy* of its values and comparing those sees the
 * move without anyone pushing an invalidation.
 *
 * `TPose` is opaque to the kit — a consumer's pose is whatever it declared —
 * so both sides walk plain objects, arrays and typed arrays, and fall back to
 * reference identity for anything else (a class instance, a `Map`). A pose of
 * that shape mutated in place still needs the scene's pushed invalidation,
 * which is unchanged either way.
 */

/** How deep the walk goes before it stops copying and keeps the reference.
 *  A pose is a handful of numbers; nothing legitimate is nested this far. */
const DEPTH = 4;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v) as object | null;
  return proto === Object.prototype || proto === null;
}

function isTypedArray(v: unknown): v is ArrayLike<number> & { slice(): unknown } {
  return ArrayBuffer.isView(v) && !(v instanceof DataView);
}

/** A copy of `value` that later mutation of `value` cannot reach. */
export function snapshotPose<T>(value: T, depth = DEPTH): T {
  if (depth <= 0) return value;
  if (Array.isArray(value)) {
    return value.map((v) => snapshotPose(v, depth - 1)) as unknown as T;
  }
  if (isTypedArray(value)) return value.slice() as unknown as T;
  if (isPlainObject(value)) {
    // Spread first, then replace only the fields that need a copy of their
    // own: a built-up object lands in a different hidden class than the pose
    // it mirrors, which costs the per-frame compare several times over.
    const out: Record<string, unknown> = { ...value };
    for (const key in out) {
      const field = out[key];
      if (typeof field === 'object' && field !== null) out[key] = snapshotPose(field, depth - 1);
    }
    return out as unknown as T;
  }
  return value;
}

/** Whether `value` still holds what {@link snapshotPose} recorded. Allocates
 *  nothing, and takes the plain-object branch first: this runs per dependency
 *  per frame, and a pose is an object of numbers nearly every time. */
export function samePoseValue(snapshot: unknown, value: unknown, depth = DEPTH): boolean {
  if (snapshot === value) return true;
  if (typeof snapshot !== 'object' || snapshot === null
    || typeof value !== 'object' || value === null) return Object.is(snapshot, value);
  if (depth <= 0) return false;

  const proto = Object.getPrototypeOf(snapshot) as object | null;
  if (proto === Object.prototype || proto === null) {
    const other = Object.getPrototypeOf(value) as object | null;
    if (other !== Object.prototype && other !== null) return false;
    const a = snapshot as Record<string, unknown>;
    const b = value as Record<string, unknown>;
    let count = 0;
    for (const key in a) {
      count++;
      const left = a[key];
      const right = b[key];
      if (left === right) {
        if (right === undefined && !(key in b)) return false;
        continue;
      }
      if (!samePoseValue(left, right, depth - 1)) return false;
    }
    // A field `value` gained is a change too, and the key counts are what say so.
    for (const _key in b) if (--count < 0) return false;
    return true;
  }

  if (Array.isArray(snapshot) || isTypedArray(snapshot)) {
    const a = snapshot as ArrayLike<unknown>;
    if (!(Array.isArray(value) || isTypedArray(value))) return false;
    const b = value as ArrayLike<unknown>;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!samePoseValue(a[i], b[i], depth - 1)) return false;
    }
    return true;
  }
  return false;
}
