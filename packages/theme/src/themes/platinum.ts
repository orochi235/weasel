import { defineTheme, type Theme, type ThemeInput, weaselTheme } from '../theme.ts';
import classic from './mac-classic.theme.json' with { type: 'json' };
import platinum from './platinum.theme.json' with { type: 'json' };

/**
 * What every classic Mac OS look shares, whatever its era: the system faces
 * and their sizes, square windows and fields, centered window titles, and flat
 * control faces. It names no color, so on its own it draws in the built-in
 * theme's; an era's theme extends it with colors and edges.
 */
export const classicMacTheme: Theme = defineTheme({
  ...classic,
  extends: weaselTheme,
} as ThemeInput);

/**
 * Mac OS 8 and 9's Platinum appearance: light gray faces with a black outline
 * and a soft two-tone edge, white fields, and pinstriped window titles. The
 * faces themselves are not bundled, so the stack falls through to what the
 * machine has. Opens in light mode; the dark one is this theme's own invention.
 *
 * Pair it with `<DefaultMotif group={motifs.titlebar()}>` from `@weasel-js/ui`
 * to title every group as a window.
 */
export const platinumTheme: Theme = defineTheme({
  ...platinum,
  extends: classicMacTheme,
} as ThemeInput);
