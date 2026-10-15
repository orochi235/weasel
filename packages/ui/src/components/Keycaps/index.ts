export { KeyCap, inferKeycapKind } from './Keycap';
export type { KeyCapProps, KeyCapVariant, KeycapKind } from './Keycap';
export { KeySequence } from './Keycaps';
export type { KeySequenceJoins, KeySequenceProps, KeySpec } from './Keycaps';
export { keyGlyph } from './keyGlyph';
export { keySpecsFromMods, keySpecFromKey, detectPlatform } from './keySpecsFromMods';
export { keySpecsFromLegend } from './keySpecsFromLegend';
export { ShortcutKeys } from './ShortcutKeys';
export { keySpecsFromShortcut } from './keySpecsFromShortcut';
export { keySpecsFromChord } from './keySpecsFromChord';
export type {
  LogicalMod,
  LogicalModSpec,
  Platform,
  LegendStyle,
  KeySpecsFromModsOptions,
  KeyLabels,
} from './keySpecsFromMods';
export { KEYCAP_VARIANT_ICONS } from './variantIcons';
