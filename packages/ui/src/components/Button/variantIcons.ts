import type { IconName } from '../../icons/paths';
import type { ButtonVariant } from './Button';

/** The glyph for each variant, for a picker that shows them. */
export const BUTTON_VARIANT_ICONS: Readonly<Record<ButtonVariant, IconName>> = {
  primary: 'variantSolid',
  secondary: 'variantOutline',
  ghost: 'variantGhost',
  link: 'variantLink',
};
