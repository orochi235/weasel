import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import type { CodeVariant } from './Code';

/** The glyph for each variant, for a picker that shows them. */
export const CODE_VARIANT_ICONS: Readonly<Record<CodeVariant, IconRef>> = {
  subtle: icon('variantSubtle'),
  plain: icon('variantPlain'),
};
