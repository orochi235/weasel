import type { IconName } from '../../icons/paths';
import type { ToggleBarVariant } from './ToggleBar';

/** The glyph for each variant, for a picker that shows them. */
export const TOGGLE_BAR_VARIANT_ICONS: Readonly<Record<ToggleBarVariant, IconName>> = {
  default: 'variantSegmented',
  minimal: 'variantSegmentedMinimal',
  flat: 'variantSegmentedFlat',
};
