import type { IconName } from '../../icons/paths';
import type { BadgeVariant } from './types';

/** The glyph for each variant, for a picker that shows them. */
export const BADGE_VARIANT_ICONS: Readonly<Record<BadgeVariant, IconName>> = {
  solid: 'variantSolid',
  outline: 'variantOutline',
  subtle: 'variantSubtle',
};
