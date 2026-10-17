import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import type { KeyCapVariant } from './Keycap';

/** The glyph for each variant, for a picker that shows them. */
export const KEYCAP_VARIANT_ICONS: Readonly<Record<KeyCapVariant, IconRef>> = {
  default: icon('variantOutline'),
  inverse: icon('variantSolid'),
};
