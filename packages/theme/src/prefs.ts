/**
 * `@weasel-js/theme/prefs` — a theme as a `@weasel-js/prefs` schema, and a
 * store over it back as a theme. On its own entry so the main one never loads
 * the prefs package.
 *
 * @packageDocumentation
 */
export {
  THEME_PREFS_AXIS,
  themeAxisOf,
  themeAxisPath,
  themePrefsReferences,
  themePrefsSchema,
  themeTokenOf,
  type ThemePrefsReference,
} from './prefs/schema.ts';
export {
  themeFromPrefs,
  themePrefsPins,
  themePrefsSelection,
  themePrefsValues,
  type ThemePrefsSource,
  type ThemePrefsValuesSource,
} from './prefs/pins.ts';
