import { THEME_SOURCES, type ThemeDefinition } from '@weasel-js/theme';
import type { StoredTheme, ThemeApi } from '@weasel-js/theme/engine';

export { httpThemeApi, type ThemeApi } from '@weasel-js/theme/engine';

/** The built themes, read-only: what a static build of the app, with no dev server behind it, can offer. */
export function bundledThemeApi(): ThemeApi {
  const themes: StoredTheme[] = Object.values(THEME_SOURCES).map((definition) => ({
    name: definition.name,
    hash: '',
    emits: true,
    definition: definition as ThemeDefinition,
  }));
  return {
    list: async () => themes,
    get: async (name) => {
      const theme = themes.find((t) => t.name === name);
      if (!theme) throw new Error(`no theme "${name}"`);
      return theme;
    },
    put: async () => ({ status: 'invalid', message: 'Saving needs the dev server: run `npm run dev:theme-editor`.' }),
  };
}
