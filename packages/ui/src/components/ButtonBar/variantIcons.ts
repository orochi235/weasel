import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import type { ButtonBarVariant } from './ButtonBar';

/** The glyph for each variant, for a picker that shows them. */
export const BUTTON_BAR_VARIANT_ICONS: Readonly<Record<ButtonBarVariant, IconRef>> = {
  default: icon('variantSegmented'),
  minimal: icon('variantSegmentedMinimal'),
  flat: icon('variantSegmentedFlat'),
};
