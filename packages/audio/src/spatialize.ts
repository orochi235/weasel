export interface Vec2 { x: number; y: number }

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
  /** Horizontal distance mapping to full left/right. Default 500. */
  panWidth?: number;
}

/**
 * Map a source position to a gain and a stereo pan, relative to the listener.
 *
 * Pure — no Web Audio, no state. This is the whole spatial model.
 */
export function spatialize(
  source: Vec2,
  listener: Vec2,
  opts: SpatialOptions = {},
): { gain: number; pan: number } {
  const refDistance = opts.refDistance ?? 1;
  const maxDistance = opts.maxDistance ?? 10000;
  const rolloff = opts.rolloff ?? 'inverse';
  const rolloffFactor = opts.rolloffFactor ?? 1;
  const panWidth = opts.panWidth ?? 500;

  const dx = source.x - listener.x;
  const dy = source.y - listener.y;
  const distance = Math.hypot(dx, dy);

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

  const pan = panWidth <= 0 ? 0 : Math.min(1, Math.max(-1, dx / panWidth));

  return { gain, pan };
}
