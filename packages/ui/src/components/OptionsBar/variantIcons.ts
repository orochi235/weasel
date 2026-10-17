import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import type { OptionsBarVariant } from './OptionsBar';

/** The glyph for each variant, for a picker that shows them. */
export const OPTIONS_BAR_VARIANT_ICONS: Readonly<Record<OptionsBarVariant, IconRef>> = {
  default: icon('variantSegmented'),
  minimal: icon('variantSegmentedMinimal'),
  flat: icon('variantSegmentedFlat'),
};
