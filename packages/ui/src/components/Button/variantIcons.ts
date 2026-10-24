import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import type { ButtonVariant } from './Button';

/** The glyph for each variant, for a picker that shows them. */
export const BUTTON_VARIANT_ICONS: Readonly<Record<ButtonVariant, IconRef>> = {
  solid: icon('variantSolid'),
  ghost: icon('variantGhost'),
  link: icon('variantLink'),
};
