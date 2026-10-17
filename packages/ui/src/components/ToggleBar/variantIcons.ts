import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import type { ToggleBarVariant } from './ToggleBar';

/** The glyph for each variant, for a picker that shows them. */
export const TOGGLE_BAR_VARIANT_ICONS: Readonly<Record<ToggleBarVariant, IconRef>> = {
  default: icon('variantSegmented'),
  minimal: icon('variantSegmentedMinimal'),
  flat: icon('variantSegmentedFlat'),
};
