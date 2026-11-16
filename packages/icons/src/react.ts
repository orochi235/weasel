/**
 * @weasel-js/icons/react — the icon registry's React side: a provider holding a registry for the
 * tree below it, and the hooks that read glyphs from the one in scope. React is an optional peer of
 * this package; the main entry never loads it.
 *
 * @packageDocumentation
 */
export {
  IconRegistryProvider, IconRegistryProviderIfRoot, IconRegistryScope, useIconRegistry,
} from './react/IconRegistryProvider';
export type { IconRegistryProviderProps } from './react/IconRegistryProvider';
export { useIconGlyph } from './react/useIconGlyph';
export { useIconVariant } from './react/useIconVariant';
