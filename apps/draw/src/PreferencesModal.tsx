/** Preferences modal — kit `PrefsDialog` over the `PREFS` registry.
 *
 *  The kit owns the walk (the navigation rail, label rows, filtering, hidden
 *  filtering, built-in control mapping); this file supplies only what is
 *  WeaselDraw-specific: the values binding (`usePrefsValues` over the
 *  app's prefs store), renderers for the app's two custom kinds
 *  (`registry-enum`, `data`), and the dev-only "Show hidden" switch.
 */
import { useMemo, useState } from 'react';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import { PrefsDialog, type PrefRenderContext } from '@weasel-js/ui/components/Prefs';
import { Select } from '@weasel-js/ui/components/Select';
import { Switch } from '@weasel-js/ui/components/Switch';
import { usePrefsValues } from '@weasel-js/prefs/react';
import {
  drawPrefs,
  PREFS,
  type DrawPrefPath,
  type WeaselDrawPrefData,
  type WeaselDrawPrefRegistryEnum,
} from './prefs';
import type { RegistryEnumSources } from './registry/types';
import { RegistryEnumSourcesContext, RegistrySelect } from './registry/RegistrySelect';
import { SURFACE_ASSETS } from './surfaces/assets';
import { ALL_CHROME, type ChromeItem } from './surfaces/chrome';
import { surfaceOf } from './surfaces/surfaceState';
import type { SurfaceAsset, SurfaceKind, SurfacesValue } from './surfaces/types';

/** Dev mode: the Vite dev server sets `import.meta.env.DEV`. In a
 *  production bundle this is false, so the toggle and any hidden prefs
 *  disappear entirely. */
const isDevMode = (): boolean => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
};

export interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
  /** Per-source option lists for `kind: 'registry-enum'` prefs. Keys
   *  match the `source` field on the pref descriptor. Omitted sources
   *  fall back to a plain text input so a missing wiring is recoverable. */
  registryEnumSources?: RegistryEnumSources;
}

export function PreferencesModal({ open, onClose, registryEnumSources }: PreferencesModalProps) {
  const sources = useMemo(() => registryEnumSources ?? {}, [registryEnumSources]);
  const [dev] = useState(isDevMode);
  const [showHidden, setShowHidden] = useState(false);
  const { values, set, unset, reset } = usePrefsValues(drawPrefs());

  return (
    <RegistryEnumSourcesContext.Provider value={sources}>
      <PrefsDialog
        isOpen={open}
        onOpenChange={(o) => { if (!o) onClose(); }}
        layout="rail"
        rowsAcross={2}
        resizableRail
        filterable
        schema={PREFS}
        values={values}
        onChange={set}
        auto={unset}
        onAutoChange={(path, next) => (next ? reset(path) : set(path, drawPrefs().get(path as DrawPrefPath)))}
        showHidden={showHidden}
        renderers={{
          'registry-enum': RegistryEnumControl,
          data: DataControl,
        }}
        headerExtra={
          dev ? (
            <Switch isSelected={showHidden} onChange={setShowHidden}>
              Show hidden
            </Switch>
          ) : undefined
        }
      />
    </RegistryEnumSourcesContext.Provider>
  );
}

export function RegistryEnumControl(ctx: PrefRenderContext) {
  const pref = ctx.pref as WeaselDrawPrefRegistryEnum;
  return (
    <RegistrySelect
      value={String(ctx.value)}
      onChange={(v) => ctx.setValue(v)}
      source={pref.source}
      filter={pref.filter}
      control={pref.control === 'radio' ? 'radio' : 'select'}
      aria-label={pref.name}
    />
  );
}

RegistryEnumControl.group = (ctx: PrefRenderContext) => (ctx.pref as WeaselDrawPrefRegistryEnum).control === 'radio';

export function DataControl(ctx: PrefRenderContext) {
  // Only `ui.surfaces` has a known shape; any other data pref belongs to other
  // code, so it shows read-only as a placeholder.
  if (ctx.path === 'ui.surfaces') return <SurfacesEditor ctx={ctx} />;
  return <Code emphasis="low" variant="plain" size="xs">(data)</Code>;
}

const SURFACE_NAMES: Record<SurfaceKind, string> = { bar: 'Toolbar', panel: 'Panel', menu: 'Menu' };

/** A row of the editor: a piece of chrome, and its surface asset where it is one. */
type ChromeRow = ChromeItem & { asset?: SurfaceAsset };

const CHROME_ROWS: readonly ChromeRow[] = ALL_CHROME.map((item) => {
  const asset = SURFACE_ASSETS.find((a) => a.id === item.id);
  return asset ? { ...item, asset } : item;
});

export function SurfacesEditor({ ctx }: { ctx: PrefRenderContext }) {
  const pref = ctx.pref as WeaselDrawPrefData;
  const surfaces = (ctx.value ?? {}) as SurfacesValue;
  const update = (id: string, patch: SurfacesValue[string]): void => {
    ctx.setValue({ ...surfaces, [id]: { ...surfaces[id], ...patch } });
  };
  const flag = (field: 'hidden' | 'collapsed', header: string, verb: string): DataGridColumn<ChromeRow> => ({
    id: field,
    header,
    sortable: false,
    className: 'wd-prefs-flag',
    render: ({ id, label, asset }) => field === 'collapsed' && !asset ? null : (
      <Checkbox
        isSelected={!!surfaces[id]?.[field]}
        onChange={(v) => update(id, { [field]: v })}
        aria-label={`${verb} ${label}`}
      />
    ),
  });
  const columns: DataGridColumn<ChromeRow>[] = [
    { id: 'label', header: 'Name', sortable: false },
    {
      id: 'surface',
      header: 'Shown as',
      sortable: false,
      render: ({ asset }) => !asset ? null : asset.surfaces.length < 2 ? SURFACE_NAMES[asset.defaultSurface] : (
        <Select<SurfaceKind>
          variant="bare"
          width="fit"
          aria-label={`Show ${asset.label} as`}
          options={asset.surfaces.map((value) => ({ value, label: SURFACE_NAMES[value] }))}
          selectedKey={surfaceOf(asset, surfaces[asset.id])}
          onSelectionChange={(surface) => update(asset.id, { surface })}
        />
      ),
    },
    flag('hidden', 'Hidden', 'Hide'),
    flag('collapsed', 'Collapsed', 'Collapse'),
  ];
  return (
    <div className="wd-prefs-panels">
      <div className="wd-prefs-panels-title">{pref.name}</div>
      <DataGrid<ChromeRow> rows={CHROME_ROWS} columns={columns} />
    </div>
  );
}
