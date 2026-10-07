import type { Ref } from 'react';

/**
 * Write `value` into a ref a caller passed in, whichever shape it has: call a
 * callback ref, set an object ref's `current`, ignore `null` or `undefined`.
 *
 * For a component that keeps the element (or handle) for itself and also
 * forwards it to a ref prop — call this from the component's own callback ref.
 */
export function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}
