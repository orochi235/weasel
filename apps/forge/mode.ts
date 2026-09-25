import type { GlobalsTarget, StoryContext } from '@weasel-js/forge';
import { useSyncExternalStore } from 'react';

type Globals = StoryContext['globals'];
export type Mode = 'light' | 'dark';

const darkQuery = (): MediaQueryList | null =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

/** An explicit `light` or `dark` stands; anything else, `auto` included, follows the OS. */
export const resolveMode = (picked: unknown, prefersDark: boolean): Mode =>
  picked === 'light' || picked === 'dark' ? picked : prefersDark ? 'dark' : 'light';

/**
 * An `applyGlobals` that hands `apply` the resolved mode, and applies each target's last globals again when the OS
 * scheme changes. One target per root: the workshop applies to every open story's host through this one function.
 */
export function followScheme(
  apply: (globals: Globals, target: GlobalsTarget, mode: Mode) => void,
  media: MediaQueryList | null = darkQuery(),
): (globals: Globals, target: GlobalsTarget) => void {
  const last = new Map<HTMLElement, { globals: Globals; target: GlobalsTarget }>();
  const run = ({ globals, target }: { globals: Globals; target: GlobalsTarget }) =>
    apply(globals, target, resolveMode(globals.mode, media?.matches ?? true));
  media?.addEventListener('change', () => {
    for (const [root, entry] of last) {
      if (root.isConnected) run(entry);
      else last.delete(root);
    }
  });
  return (globals, target) => {
    const entry = { globals, target };
    last.set(target.root, entry);
    run(entry);
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
