import type { IconName } from '../../icons/paths';
import type { ButtonBarVariant } from './ButtonBar';

/** The glyph for each variant, for a picker that shows them. */
export const BUTTON_BAR_VARIANT_ICONS: Readonly<Record<ButtonBarVariant, IconName>> = {
  default: 'variantSegmented',
  minimal: 'variantSegmentedMinimal',
};
