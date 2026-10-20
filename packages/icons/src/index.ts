/**
 * `@weasel-js/icons`: icon names, tables and the registry, and the plain shape glyphs under the
 * `shape` namespace. No React, no DOM.
 *
 * @packageDocumentation
 */

import type { ShapeIconNames } from './icons.gen';

/**
 * Every qualified icon name, as keys. Each package's generated `icons.gen.ts`
 * adds its own by declaration merging. Declared here, in the barrel, because an
 * augmentation aimed at a module that only re-exports this would declare a fresh one.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IconName extends ShapeIconNames {}

/** A name some loaded package declares. */
export type QualifiedIconName = Extract<keyof IconName, string>;

export { qualify, scopedIcon, splitIconRef, toIconRef } from './names';
export type { IconRef } from './names';
export type { IconGlyph, IconTable, IconVariantLoader, IconVariantModule } from './table';
export { createIconRegistry, IconNamespaceClaimedError } from './registry';
export type { IconEntry, IconRegistry, IconVariantState } from './registry';
