import type { IconName } from '../../icons/paths';
import type { CodeVariant } from './Code';

/** The glyph for each variant, for a picker that shows them. */
export const CODE_VARIANT_ICONS: Readonly<Record<CodeVariant, IconName>> = {
  subtle: 'variantSubtle',
  plain: 'variantPlain',
};
