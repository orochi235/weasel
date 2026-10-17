import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import type { BadgeVariant } from './types';

/** The glyph for each variant, for a picker that shows them. */
export const BADGE_VARIANT_ICONS: Readonly<Record<BadgeVariant, IconRef>> = {
  solid: icon('variantSolid'),
  outline: icon('variantOutline'),
  subtle: icon('variantSubtle'),
};
