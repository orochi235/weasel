import type { EffectKind } from '@weasel-js/ui/components/EffectList';
import { type BadgeEffect } from '@weasel-js/ui/components/Badge';
import { EFFECTS } from '../effects';

export type EffectZone = 'offset' | 'foreground' | 'background' | 'mask';

/** Where an effect acts: on the outline itself, or as decoration in one of the paint zones. */
export const zoneOf = (type: BadgeEffect): EffectZone => (EFFECTS[type].offsetAt ? 'offset' : (EFFECTS[type].zone ?? 'foreground'));

/** A card's kind is its effect's zone; colors index the theme's tint list. */
export const EFFECT_KINDS: Record<EffectZone, EffectKind> = {
  offset: { label: 'Offset', color: 3 },
  foreground: { label: 'Foreground', color: 2 },
  background: { label: 'Background', color: 9 },
  mask: { label: 'Mask', color: 8 },
};

/** An effect type as a name: `bevel2` reads "Bevel 2". */
export const effectLabel = (type: BadgeEffect): string =>
  type.replace(/^./, (c) => c.toUpperCase()).replace(/(\D)(\d+)$/, '$1 $2');
