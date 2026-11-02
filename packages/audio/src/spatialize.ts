/** A world position or direction, in the consumer's own units. `z` is absent
 *  in a 2D scene and read as 0. */
export interface SpatialPoint { x: number; y: number; z?: number }

/** @deprecated Use `SpatialPoint`, which also takes an optional `z`. */
export type Vec2 = SpatialPoint;

/** Distance and pan model for `spatialize`, in the same units as the
 *  positions. */
export interface SpatialOptions {
  /** Distance within which gain stays at 1. Default 1. The inverse model needs
   *  this above 0: at 0 it cliffs gain from 1 to 0 at any nonzero distance. */
  refDistance?: number;
  /** Distance at which linear rolloff reaches 0. Ignored by inverse. Default
   *  10000. At or below `refDistance` it gives the same 1-to-0 cliff, there. */
  maxDistance?: number;
  /** Default 'inverse' — the natural-sounding one. */
  rolloff?: 'inverse' | 'linear';
  /** How sharply gain falls. Default 1. */
  rolloffFactor?: number;
  /** Offset along `right` mapping to full left/right. Default 500. */
  panWidth?: number;
  /** The listener's right, as a direction; its length is ignored. Default
   *  `{ x: 1, y: 0, z: 0 }`. Pan is the source's offset along it. */
  right?: SpatialPoint;
}

/**
 * Map a source position to a gain and a stereo pan, relative to the listener.
 * Gain falls with the full 3D distance; pan is the offset along the listener's
 * right, over `panWidth`.
 *
 * Pure — no Web Audio, no state. This is the whole spatial model.
 */
export function spatialize(
  source: SpatialPoint,
  listener: SpatialPoint,
  opts: SpatialOptions = {},
): { gain: number; pan: number } {
  const refDistance = opts.refDistance ?? 1;
  const maxDistance = opts.maxDistance ?? 10000;
  const rolloff = opts.rolloff ?? 'inverse';
  const rolloffFactor = opts.rolloffFactor ?? 1;
  const panWidth = opts.panWidth ?? 500;

  const dx = source.x - listener.x;
  const dy = source.y - listener.y;
  const dz = (source.z ?? 0) - (listener.z ?? 0);
  // hypot(dx, dy, 0) rounds differently from hypot(dx, dy) in ~1% of inputs.
  const distance = dz === 0 ? Math.hypot(dx, dy) : Math.hypot(dx, dy, dz);

  let gain: number;
  if (distance <= refDistance) {
    gain = 1;
  } else if (rolloff === 'linear') {
    const span = maxDistance - refDistance;
    gain = span <= 0 ? 0 : 1 - rolloffFactor * ((distance - refDistance) / span);
  } else {
    gain = refDistance / (refDistance + rolloffFactor * (distance - refDistance));
  }
  gain = Math.min(1, Math.max(0, gain));

  const lateral = lateralOffset(dx, dy, dz, opts.right);
  const pan = panWidth <= 0 ? 0 : Math.min(1, Math.max(-1, lateral / panWidth));

  return { gain, pan };
}

/** The offset projected onto the unit `right`; 0 for a zero-length `right`. */
function lateralOffset(dx: number, dy: number, dz: number, right?: SpatialPoint): number {
  if (!right) return dx;
  const rz = right.z ?? 0;
  const len = Math.hypot(right.x, right.y, rz);
  if (len === 0) return 0;
  return (dx * right.x + dy * right.y + dz * rz) / len;
}
