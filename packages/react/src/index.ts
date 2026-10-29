export { assignRef } from './assignRef';
export { __resetAdoptedCss, adoptCss, adoptCssOnce, styleRootOf } from './adoptCss';
export type { AdoptedCss, StyleRoot } from './adoptCss';
export { isDev } from '@weasel-js/registry';
export { useCanvasFocus } from './useCanvasFocus';
export type { UseCanvasFocusOptions, CanvasFocusReturn } from './useCanvasFocus';
export { useLatest } from './useLatest';
export { useNearViewport } from './useNearViewport';
export { prefersReducedMotion, usePrefersReducedMotion } from './reducedMotion';
export { useVisibleRaf } from './useVisibleRaf';
export type { VisibleRaf, VisibleRafOptions, VisibleRafTarget } from './useVisibleRaf';
export { useStableByContent, sameList } from './useStableByContent';
export { createKitSettingsStore, NO_KIT_SETTINGS } from './kitSettings';
export type { KitSettingAt, KitSettingLeaf, KitSettingPath, KitSettingsOverrides, KitSettingsStore, WritableKitSettingsStore } from './kitSettings';
export { KitSettingsProvider, useKitSetting, useKitSettings } from './useKitSetting';

/**
 * The kit's settings, one key per area: behavior a user sets once for every
 * component, such as how long a tree waits between typeahead keys. A package
 * adds its area by augmenting this interface from its own source:
 *
 * ```ts
 * declare module '@weasel-js/react' {
 *   interface KitSettings { tree: { typeaheadMs: number } }
 * }
 * ```
 *
 * Declared here in the barrel, not in `kitSettings.ts`: an augmentation
 * merges through one re-export hop, and a package re-exporting this one adds
 * a second.
 *
 * Every leaf is a number, string or boolean. Nothing here holds a default:
 * a reader falls back to its own constant when no provider sets the value.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface KitSettings {}

/**
 * The `targets` area's leaves — hit and snap radii — which more than one
 * package adds to. Each augments this interface with its own keys and declares
 * `targets: KitTargetSettings` in its `KitSettings` augmentation: two packages
 * declaring `targets` as different object types do not merge.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface KitTargetSettings {}
