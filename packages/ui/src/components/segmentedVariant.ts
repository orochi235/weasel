import type { IconRef } from '@weasel-js/icons';
import { icon } from '../icons.gen';

/** Visual treatment of a segmented bar. */
export type SegmentedVariant = 'default' | 'minimal' | 'flat';

/** The glyph for each segmented-bar variant, for a picker that shows them. */
export const SEGMENTED_VARIANT_ICONS: Readonly<Record<SegmentedVariant, IconRef>> = {
  default: icon('variantSegmented'),
  minimal: icon('variantSegmentedMinimal'),
  flat: icon('variantSegmentedFlat'),
};
