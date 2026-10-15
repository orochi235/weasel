import type { IconName } from '../../icons/generated/paths';
import type { KeyCapVariant } from './Keycap';

/** The glyph for each variant, for a picker that shows them. */
export const KEYCAP_VARIANT_ICONS: Readonly<Record<KeyCapVariant, IconName>> = {
  default: 'variantOutline',
  inverse: 'variantSolid',
};
