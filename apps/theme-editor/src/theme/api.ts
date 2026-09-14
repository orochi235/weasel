import { THEME_SOURCES, type ThemeDefinition } from '@weasel-js/theme';
import type { PutResult, StoredTheme } from './store';

export interface ThemeApi {
  list(): Promise<StoredTheme[]>;
  get(name: string): Promise<StoredTheme>;
  put(name: string, definition: ThemeDefinition, baseHash: string | null): Promise<PutResult>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The dev server's theme store, addressed relative to the page so the app's base path carries over. */
export function httpThemeApi(base: string = document.baseURI, fetchImpl: Fetch = (input, init) => fetch(input, init)): ThemeApi {
  const url = (path: string) => new URL(`__theme/${path}`, base).toString();
  const read = async <T>(response: Response): Promise<T> => {
    if (!response.ok && response.status !== 409 && response.status !== 400) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  };
  return {
    list: async () => (await read<{ themes: StoredTheme[] }>(await fetchImpl(url('list'), undefined))).themes,
    get: async (name) => read<StoredTheme>(await fetchImpl(url(name), undefined)),
    put: async (name, definition, baseHash) =>
      read<PutResult>(
        await fetchImpl(url(name), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition, hash: baseHash }),
        }),
      ),
  };
}

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
