// Each surface asset's chrome, persisted under the `ui.surfaces` pref so the
// inline switch, chevron, and ×, the View menu, and the Preferences dialog edit the same map.

import { useCallback } from 'react';
import type { PrefOrder } from '@weasel-js/prefs';
import type { AppCommands } from '../appCommands';
import { drawPrefs, removeOnceStored, usePref, whenWritable } from '../prefs';
import { SURFACE_ASSETS } from './assets';
import type { PanelChrome, SurfaceAsset, SurfaceKind, SurfaceState, SurfacesValue } from './types';

/** The surface `asset` is drawn on: the one chosen for it, while it still allows that one, else its default. */
export function surfaceOf(asset: SurfaceAsset, state: SurfaceState | undefined): SurfaceKind {
  const chosen = state?.surface;
  return chosen !== undefined && asset.surfaces.includes(chosen) ? chosen : asset.defaultSurface;
}

/** One asset as the surfaces draw it. */
export interface SurfaceBinding {
  asset: SurfaceAsset;
  surface: SurfaceKind;
  chrome: PanelChrome;
  /** The stored order of the asset's items, if the user has set one. */
  order: PrefOrder | undefined;
  onReorder: (order: PrefOrder) => void;
}

/** Every asset in `assets`, in order, bound to its persisted chrome. */
export function useSurfaces(assets: readonly SurfaceAsset[] = SURFACE_ASSETS): SurfaceBinding[] {
  const [value, setValue] = usePref('ui.surfaces');
  const patch = useCallback(
    (id: string, fn: (prev: SurfaceState) => SurfaceState) => {
      setValue((prev) => ({ ...prev, [id]: fn(prev[id] ?? {}) }));
    },
    [setValue],
  );
  return assets.map((asset) => {
    const state = value[asset.id] ?? {};
    const { id } = asset;
    return {
      asset,
      surface: surfaceOf(asset, state),
      order: state.order,
      onReorder: (order) => patch(id, (p) => ({ ...p, order })),
      chrome: {
        hidden: !!state.hidden,
        collapsed: !!state.collapsed,
        onToggleCollapse: () => patch(id, (p) => ({ ...p, collapsed: !p.collapsed })),
        onHide: () => patch(id, (p) => ({ ...p, hidden: true })),
      },
    };
  });
}

/** Whether chrome `id` is hidden, and its toggle, over `ui.surfaces`: what the View menu's rows read and run. */
export function useChromeCommands(): Pick<AppCommands, 'chromeHidden' | 'toggleChrome'> {
  const [value, setValue] = usePref('ui.surfaces');
  const toggleChrome = useCallback(
    (id: string) => setValue((prev) => ({ ...prev, [id]: { ...prev[id], hidden: !prev[id]?.hidden } })),
    [setValue],
  );
  return { chromeHidden: (id: string) => !!value[id]?.hidden, toggleChrome };
}

/** Move asset `id` to `surface`, shown again if it was hidden. Stable for the store's life. */
export function useSetSurface(): (id: string, surface: SurfaceKind) => void {
  const [, setValue] = usePref('ui.surfaces');
  return useCallback(
    (id: string, surface: SurfaceKind) => setValue((prev) => ({ ...prev, [id]: { ...prev[id], surface, hidden: false } })),
    [setValue],
  );
}

const LEGACY_COLLAPSED_KEYS: Record<string, string> = {
  layers: 'wd:panel:layers:collapsed',
  history: 'wd:panel:history:collapsed',
};

/** Fold the pre-prefs `wd:panel:*:collapsed` flags into `ui.surfaces` once,
 *  and delete them once the new value is on disk. A value already in
 *  `ui.surfaces` wins. A store that cannot persist leaves the flags alone. */
export function migrateLegacyPanelFlags(
  target = drawPrefs(),
  storage: Storage | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  whenWritable(target, () => {
    const found: string[] = [];
    let surfaces: SurfacesValue | null = null;
    try {
      for (const [id, key] of Object.entries(LEGACY_COLLAPSED_KEYS)) {
        const raw = storage.getItem(key);
        if (raw == null) continue;
        found.push(key);
        surfaces ??= { ...target.get('ui.surfaces') };
        if (surfaces[id]?.collapsed === undefined) {
          surfaces[id] = { ...surfaces[id], collapsed: raw === '1' };
        }
      }
    } catch {
      return;
    }
    if (!surfaces) return;
    target.set('ui.surfaces', surfaces);
    removeOnceStored(target, () => {
      for (const key of found) storage.removeItem(key);
    });
  });
}
