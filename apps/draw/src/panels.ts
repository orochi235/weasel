// Right-sidebar panel chrome state, persisted under the `ui.panels` pref so
// the inline chevron / × and the Preferences dialog edit the same map.

import { useCallback } from 'react';
import { readPref, usePref, writePref } from './prefs';

export const PANELS = [
  { id: 'properties', label: 'Properties' },
  { id: 'colors', label: 'Colors' },
  { id: 'layers', label: 'Layers' },
  { id: 'history', label: 'History' },
] as const;

export type PanelId = (typeof PANELS)[number]['id'];
export interface PanelState { hidden?: boolean; collapsed?: boolean }
export type PanelsValue = Record<string, PanelState>;

export interface PanelChrome {
  hidden: boolean;
  collapsed: boolean;
  onToggleCollapse(): void;
  onHide(): void;
}

/** Bind one panel's hidden/collapsed state for kit `SidebarPanel`. */
export function usePanel(id: PanelId): PanelChrome {
  const [panels, setPanels] = usePref('ui.panels');
  const state = panels[id] ?? {};
  const patch = useCallback(
    (fn: (prev: PanelState) => PanelState) => {
      setPanels((prev) => ({ ...prev, [id]: fn(prev[id] ?? {}) }));
    },
    [id, setPanels],
  );
  return {
    hidden: !!state.hidden,
    collapsed: !!state.collapsed,
    onToggleCollapse: () => patch((p) => ({ ...p, collapsed: !p.collapsed })),
    onHide: () => patch((p) => ({ ...p, hidden: true })),
  };
}

const LEGACY_COLLAPSED_KEYS: Partial<Record<PanelId, string>> = {
  layers: 'wd:panel:layers:collapsed',
  history: 'wd:panel:history:collapsed',
};

/** Fold the pre-prefs `wd:panel:*:collapsed` flags into `ui.panels` once,
 *  then delete them. A value already in `ui.panels` wins. */
export function migrateLegacyPanelFlags(storage: Storage | undefined = globalThis.localStorage): void {
  if (!storage) return;
  try {
    let panels: PanelsValue | null = null;
    for (const [id, key] of Object.entries(LEGACY_COLLAPSED_KEYS)) {
      const raw = storage.getItem(key);
      if (raw == null) continue;
      panels ??= { ...readPref('ui.panels') };
      if (panels[id]?.collapsed === undefined) {
        panels[id] = { ...panels[id], collapsed: raw === '1' };
      }
      storage.removeItem(key);
    }
    if (panels) writePref('ui.panels', panels);
  } catch {
    /* storage unavailable — nothing to migrate */
  }
}
