import { useCommand } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';

/** The in-repo dev pages, hash-routed in main.tsx, in switcher order. */
export const DEV_ROUTES: ReadonlyArray<{ href: string; label: string }> = [
  { href: '#/dev/toolkits', label: 'Toolkit Builder' },
  { href: '#/dev/registry', label: 'Bundle Inspector' },
  { href: '#/dev/assets', label: 'Assets' },
];

export const DEBUG_OPEN = 'debug.open';

/** Debug, opening onto one row per dev page. */
export const DEBUG_MENU: PrefGroup = pref.group(
  'Debug',
  { pages: pref.action(DEBUG_OPEN) },
  { as: 'menu', description: 'Debug surfaces' },
);

const DEBUG_VARIANTS = DEV_ROUTES.map(({ href, label }) => ({
  key: href.slice(href.lastIndexOf('/') + 1),
  label,
  params: { href },
}));

/** Register `debug.open`, which opens a dev page in a new tab, with a variant per page. */
export function useDebugCommands(): void {
  useCommand(DEBUG_OPEN, 'Open debug surface', (params) => {
    const href = params?.href;
    if (typeof href !== 'string') return;
    window.open(`${window.location.pathname}${window.location.search}${href}`, '_blank', 'noopener');
  }, { variants: DEBUG_VARIANTS, tags: ['debug', 'dev'] });
}
