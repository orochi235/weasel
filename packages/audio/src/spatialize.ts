import { checkFinite, checkPoint } from './param';

/** A world position or direction, in the consumer's own units. `z` is absent
 *  in a 2D scene and read as 0. */
export interface SpatialPoint { x: number; y: number; z?: number }

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

/** Throws a `RangeError` on a listener at a point, or with options, that are not finite. */
export function checkListener(at: SpatialPoint, opts: SpatialOptions = {}): void {
  checkPoint('listener', at);
  checkFinite('listener refDistance', opts.refDistance);
  checkFinite('listener maxDistance', opts.maxDistance);
  checkFinite('listener rolloffFactor', opts.rolloffFactor);
  checkFinite('listener panWidth', opts.panWidth);
  checkPoint('listener right', opts.right);
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

  let dx = source.x - listener.x;
  let dy = source.y - listener.y;
  let dz = (source.z ?? 0) - (listener.z ?? 0);
  // hypot(dx, dy, 0) rounds differently from hypot(dx, dy) in ~1% of inputs.
  let distance = dz === 0 ? Math.hypot(dx, dy) : Math.hypot(dx, dy, dz);
  let scale = 1;
  if (!Number.isFinite(distance)) {
    // An offset past the double range: halved, its pan still projects, where Infinity - Infinity would be NaN.
    dx = source.x / 2 - listener.x / 2;
    dy = source.y / 2 - listener.y / 2;
    dz = (source.z ?? 0) / 2 - (listener.z ?? 0) / 2;
    distance = Infinity;
    scale = 2;
  }

  let gain: number;
  if (distance <= refDistance) {
    gain = 1;
  } else if (rolloff === 'linear') {
    // Halved, so neither difference overflows.
    const span = maxDistance / 2 - refDistance / 2;
    gain = span <= 0 ? 0
      : rolloffFactor === 0 ? 1
      : 1 - rolloffFactor * ((distance / 2 - refDistance / 2) / span);
  } else {
    const fall = rolloffFactor === 0 ? 0 : rolloffFactor * (distance - refDistance);
    gain = refDistance === 0 ? 0 : refDistance / (refDistance + fall);
  }
  gain = Math.min(1, Math.max(0, gain));

  const lateral = scale * lateralOffset(dx, dy, dz, opts.right);
  const pan = panWidth <= 0 ? 0 : Math.min(1, Math.max(-1, lateral / panWidth));

  return { gain, pan };
}

/** The offset projected onto the unit `right`; 0 for a zero-length `right`. */
function lateralOffset(dx: number, dy: number, dz: number, right?: SpatialPoint): number {
  if (!right) return dx;
  // Scaled to its largest component first, so a long `right` cannot overflow its length or the products.
  const big = Math.max(Math.abs(right.x), Math.abs(right.y), Math.abs(right.z ?? 0));
  if (big === 0) return 0;
  const [rx, ry, rz] = [right.x / big, right.y / big, (right.z ?? 0) / big];
  return (dx * rx + dy * ry + dz * rz) / Math.hypot(rx, ry, rz);
}
