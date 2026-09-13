import type { StoryContext } from '@weasel-js/forge';
import { useSyncExternalStore } from 'react';

type Globals = StoryContext['globals'];
export type Mode = 'light' | 'dark';

const darkQuery = (): MediaQueryList | null =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

/** An explicit `light` or `dark` stands; anything else, `auto` included, follows the OS. */
export const resolveMode = (picked: unknown, prefersDark: boolean): Mode =>
  picked === 'light' || picked === 'dark' ? picked : prefersDark ? 'dark' : 'light';

/** An `applyGlobals` that hands `apply` the resolved mode, and applies the last globals again when the OS scheme changes. */
export function followScheme(
  apply: (globals: Globals, root: HTMLElement, mode: Mode) => void,
  media: MediaQueryList | null = darkQuery(),
): (globals: Globals, root: HTMLElement) => void {
  let last: { globals: Globals; root: HTMLElement } | null = null;
  const run = () => {
    if (last) apply(last.globals, last.root, resolveMode(last.globals.mode, media?.matches ?? true));
  };
  media?.addEventListener('change', run);
  return (globals, root) => {
    last = { globals, root };
    run();
  };
}

const subscribe = (notify: () => void) => {
  const media = darkQuery();
  media?.addEventListener('change', notify);
  return () => media?.removeEventListener('change', notify);
};
const prefersDark = () => darkQuery()?.matches ?? true;

/** The mode `picked` resolves to, following the OS while it does. */
export function useResolvedMode(picked: unknown): Mode {
  return resolveMode(picked, useSyncExternalStore(subscribe, prefersDark, prefersDark));
}
