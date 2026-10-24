import { defineTheme, type Theme, type ThemeInput, weaselTheme } from '../theme.ts';
import definition from './win9x.theme.json' with { type: 'json' };

/**
 * Windows 95 and 98: gray faces edged in two-pixel bevels, square corners, a
 * navy-to-blue title strip, and the system's sans at its small sizes. The
 * faces themselves are not bundled, so the stack falls through to Tahoma.
 * Opens in light mode; the dark one is this theme's own invention.
 *
 * A pins-only definition over the built-in theme. Pair it with
 * `<DefaultMotif group={motifs.titlebar()}>` from `@weasel-js/ui` to title
 * every group as a window.
 */
export const win9xTheme: Theme = defineTheme({
  ...definition,
  extends: weaselTheme,
} as ThemeInput);
