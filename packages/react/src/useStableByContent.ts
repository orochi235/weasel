import { useInsertionEffect, useRef } from 'react';

/**
 * `value`, or the one the last committed render returned when `same` says the
 * two are equal — so a caller rebuilding an equivalent object every render
 * hands its readers one identity. Compared against the committed value only:
 * a render React throws away never becomes the one the next render keeps.
 */
export function useStableByContent<T>(value: T, same: (a: T, b: T) => boolean): T {
  const held = useRef(value);
  const out = held.current === value || same(held.current, value) ? held.current : value;
  useInsertionEffect(() => {
    held.current = out;
  });
  return out;
}
