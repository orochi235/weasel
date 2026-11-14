import { BASES, type BadgeBase } from './bases';
import { EFFECTS, type BadgeEffect } from './effects';
import { SHAPES } from './shapes';
import type { BadgeShape } from './types';

/** Every built-in `shape`, in the order a picker lists them. */
export const BADGE_SHAPES: readonly BadgeShape[] = Object.keys(SHAPES) as BadgeShape[];

/** Every outline a composed badge's `base` can name. */
export const BADGE_BASES: readonly BadgeBase[] = Object.keys(BASES) as BadgeBase[];

/** Every treatment a composed badge's `effects` can name. */
export const BADGE_EFFECTS: readonly BadgeEffect[] = Object.keys(EFFECTS) as BadgeEffect[];

/**
 * How a shape is drawn: `css` is the box's own border and radius, `svg` an outline the shape draws itself, and
 * `composed` a base and effects the shape names, as a badge given `base` and `effects` is drawn.
 */
export type BadgeShapeRendering = 'css' | 'svg' | 'composed';

/** How `shape` is drawn. */
export function badgeShapeRendering(shape: BadgeShape): BadgeShapeRendering {
  const entry = SHAPES[shape];
  if (entry.renderMode === 'css') return 'css';
  return entry.compose ? 'composed' : 'svg';
}

/**
 * Where an effect acts on a composed badge: `offset` moves the outline itself (spikes, puffs), and the rest
 * decorate it, painted under the body (`background`), over it (`foreground`), or cut out of it (`mask`).
 */
export type BadgeEffectZone = 'offset' | 'foreground' | 'background' | 'mask';

/** Where `effect` acts on a composed badge. */
export function badgeEffectZone(effect: BadgeEffect): BadgeEffectZone {
  const entry = EFFECTS[effect];
  return entry.offsetAt ? 'offset' : (entry.zone ?? 'foreground');
}
