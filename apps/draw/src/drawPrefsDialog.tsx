/** What WeaselDraw adds to `<EditorShell>`'s preferences dialog: renderers for the app's two custom kinds
 *  (`registry-enum`, `data`), its layout, and the dev-only "Show hidden" switch. The shell binds the values. */
import { useMemo, useState } from 'react';
import type { EditorPrefsDialogProps } from '@weasel-js/editor';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Code } from '@weasel-js/ui/components/Code';
import { DataGrid, type DataGridColumn } from '@weasel-js/ui/components/DataGrid';
import type { PrefRenderContext } from '@weasel-js/ui/components/Prefs';
import { Select } from '@weasel-js/ui/components/Select';
import { Switch } from '@weasel-js/ui/components/Switch';
import type { WeaselDrawPrefData, WeaselDrawPrefRegistryEnum } from './prefs';
import { RegistrySelect } from './registry/RegistrySelect';
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

const RENDERERS = { 'registry-enum': RegistryEnumControl, data: DataControl };

/** The dialog props draw hands `<EditorShell prefsDialog>`. A `registry-enum` pref reads its options from the
 *  `RegistryEnumSourcesContext` above the shell. */
export function useDrawPrefsDialog(): EditorPrefsDialogProps {
  const [dev] = useState(isDevMode);
  const [showHidden, setShowHidden] = useState(false);
  return useMemo(() => ({
    rowsAcross: 2,
    resizableRail: true,
    filterable: true,
    showHidden,
    renderers: RENDERERS,
    headerExtra: dev ? <Switch isSelected={showHidden} onChange={setShowHidden}>Show hidden</Switch> : undefined,
  }), [dev, showHidden]);
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
