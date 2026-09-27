import type { GlobalDeclaration, StoryContext } from '@weasel-js/forge';
// The theme module alone: labkit's barrel is most of what a frame would otherwise load.
import { interstellarTheme } from '@weasel-js/labkit/theme/interstellar';
import { applyTheme, type Theme, weaselTheme } from '@weasel-js/theme';

/** The themes a trial can take, by name; the first is the default. */
export const THEMES: Readonly<Record<string, Theme>> = {
  weasel: weaselTheme,
  interstellar: interstellarTheme,
};

const DEFAULT_THEME = Object.keys(THEMES)[0]!;

const capitalize = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export const THEME_GLOBAL: GlobalDeclaration = {
  label: 'Theme',
  default: DEFAULT_THEME,
  options: Object.keys(THEMES).map((value) => ({ value, label: capitalize(value) })),
};

const DENSITIES = ['compact', 'comfortable', 'roomy'];

/** Themes `root` from the Theme and Density globals, at `mode`; a value nothing is registered under takes the default. */
export function applyTrialTheme(root: HTMLElement, globals: StoryContext['globals'], mode: 'light' | 'dark'): void {
  const theme = THEMES[String(globals.theme)] ?? THEMES[DEFAULT_THEME]!;
  const density = typeof globals.density === 'string' && DENSITIES.includes(globals.density) ? globals.density : 'comfortable';
  applyTheme(root, theme, { mode, density });
}
