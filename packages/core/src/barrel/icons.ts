/**
 * Part of the `@weasel-js/core` barrel. The icon registry: its React context
 * and the hooks that read glyphs from it.
 *
 * @packageDocumentation
 */

export {
  IconRegistryProvider,
  IconRegistryProviderIfRoot,
  useIconRegistry,
  useIconGlyph,
  useIconVariant,
} from '../iconRegistry';
export type { IconRegistryProviderProps } from '../iconRegistry';
export { toIconRef } from '@weasel-js/icons';
export type { IconRef, IconTable } from '@weasel-js/icons';
// Carries core's IconName augmentation into the published declarations, so a package built
// against them can write `core:` names.
export type { CoreIconName } from '../icons.gen';
