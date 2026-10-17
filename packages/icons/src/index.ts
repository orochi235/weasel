/**
 * `@weasel-js/icons`: icon names, tables and the registry. No React, no DOM, no glyphs.
 *
 * @packageDocumentation
 */

/**
 * Every qualified icon name, as keys. Each package's generated `icons.gen.ts`
 * adds its own by declaration merging. Declared here, in the barrel, because an
 * augmentation aimed at a module that only re-exports this would declare a fresh one.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IconName {}

/** A name some loaded package declares. */
export type QualifiedIconName = Extract<keyof IconName, string>;

export { qualify, scopedIcon, splitIconRef, toIconRef } from './names';
export type { IconRef } from './names';
export type { IconGlyph, IconTable, IconVariantLoader, IconVariantModule } from './table';
export { createIconRegistry, IconNamespaceClaimedError } from './registry';
export type { IconEntry, IconRegistry, IconVariantState } from './registry';
