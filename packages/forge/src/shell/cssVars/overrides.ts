import { usePersistedState } from '@weasel-js/labkit';

export type CssOverrides = Readonly<Record<string, string>>;

const NONE: CssOverrides = {};

/** The CSS variable overrides of the trial this is rendered inside, persisted with it. */
export function useCssOverrides() {
  return usePersistedState<CssOverrides>('fg-css-overrides', NONE, { scope: 'trial' });
}
