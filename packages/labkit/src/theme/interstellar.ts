import { defineTheme, type Theme, type ThemeInput, weaselTheme } from '@weasel-js/theme';
import definition from './interstellar.theme.json' with { type: 'json' };

/**
 * labkit's theme: a cosmic dark and a warm parchment light, extending the
 * built-in weasel theme. A pins-only theme definition: nothing in it is
 * derived, so it loads without the engine.
 */
export const interstellarTheme: Theme = defineTheme({
  ...definition,
  extends: weaselTheme,
} as ThemeInput);
