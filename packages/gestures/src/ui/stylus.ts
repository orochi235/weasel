import type { PointerSampleStylus } from './inputEvent';

/**
 * The stylus fields `src` carries, as a spread-able partial: a sample that
 * carries none of them adds no `undefined`-valued keys to what it is spread into.
 */
export function stylusOf(src: PointerSampleStylus): PointerSampleStylus {
  return {
    ...(typeof src.pressure === 'number' ? { pressure: src.pressure } : {}),
    ...(typeof src.tiltX === 'number' ? { tiltX: src.tiltX } : {}),
    ...(typeof src.tiltY === 'number' ? { tiltY: src.tiltY } : {}),
  };
}
