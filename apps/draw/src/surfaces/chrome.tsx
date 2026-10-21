import type { ReactNode } from 'react';
import { SURFACE_ASSETS } from './assets';
import { useChromeCommands } from './surfaceState';

/** A piece of the editor's chrome that the View menu shows and hides. Its hidden flag is `ui.surfaces[id].hidden`,
 *  the same one a panel's Hide button writes. */
export interface ChromeItem {
  id: string;
  label: string;
}

/** The chrome that is not a surface asset: always drawn in one place. */
export const FIXED_CHROME = {
  tools: { id: 'tools', label: 'Tools' },
  pathTools: { id: 'pathTools', label: 'Path tools' },
  statusBar: { id: 'statusBar', label: 'Status bar' },
} as const satisfies Record<string, ChromeItem>;

const item = ({ id, label }: ChromeItem): ChromeItem => ({ id, label });

/** Everything the View menu toggles, in screen order: the command strip's assets, the two left palettes, the right
 *  sidebar's panels, then the status bar. */
export const CHROME_ITEMS: readonly ChromeItem[] = [
  ...SURFACE_ASSETS.filter((a) => a.defaultSurface !== 'panel').map(item),
  FIXED_CHROME.tools,
  FIXED_CHROME.pathTools,
  ...SURFACE_ASSETS.filter((a) => a.defaultSurface === 'panel').map(item),
  FIXED_CHROME.statusBar,
];

/** The id of the action that shows or hides chrome `id`. */
export const chromeActionId = (id: string): string => `view.show.${id}`;

/** `children`, unless chrome `id` is hidden. */
export function ShowChrome({ id, children }: { id: string; children: ReactNode }) {
  return useChromeCommands().chromeHidden(id) ? null : <>{children}</>;
}
