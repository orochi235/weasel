/**
 * Part of the `@weasel-js/core` barrel. Icon names and the registry's types; the
 * registry's React provider and hooks are `@weasel-js/icons/react`.
 *
 * @packageDocumentation
 */

export { toIconRef } from '@weasel-js/icons';
export type {
  IconEntry, IconGlyph, IconRef, IconRegistry, IconTable, IconVariantLoader, IconVariantState,
} from '@weasel-js/icons';
// Carries core's IconName augmentation into the published declarations, so a package built
// against them can write `core:` names.
export type { CoreIconName } from '../icons.gen';
