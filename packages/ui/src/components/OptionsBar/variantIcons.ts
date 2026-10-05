import type { IconName } from '../../icons/paths';
import type { OptionsBarVariant } from './OptionsBar';

/** The glyph for each variant, for a picker that shows them. */
export const OPTIONS_BAR_VARIANT_ICONS: Readonly<Record<OptionsBarVariant, IconName>> = {
  default: 'variantSegmented',
  minimal: 'variantSegmentedMinimal',
};
