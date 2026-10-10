/** Preferences modal — kit `PrefsDialog` over the `PREFS` registry.
 *
 *  The kit owns the walk (the navigation rail, label rows, filtering, hidden
 *  filtering, built-in control mapping); this file supplies only what is
 *  WeaselDraw-specific: the values binding (`usePrefsValues` over the
 *  app's prefs store), renderers for the app's two custom kinds
 *  (`registry-enum`, `data`), and the dev-only "Show hidden" switch.
 */
import { useMemo, useState } from 'react';
import {
  Checkbox,
  Code,
  DataGrid,
  PrefsDialog,
  Switch,
  type DataGridColumn,
  type PrefRenderContext,
} from '@weasel-js/ui';
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
import { PANELS, type PanelsValue } from './panels';

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
      aria-label={pref.name}
    />
  );
}

export function DataControl(ctx: PrefRenderContext) {
  // Only `ui.panels` has a known shape; any other data pref belongs to other
  // code, so it shows read-only as a placeholder.
  if (ctx.path === 'ui.panels') return <PanelsEditor ctx={ctx} />;
  return <Code status="muted" variant="plain" size="xs">(data)</Code>;
}

type PanelRow = (typeof PANELS)[number];

export function PanelsEditor({ ctx }: { ctx: PrefRenderContext }) {
  const pref = ctx.pref as WeaselDrawPrefData;
  const panels = (ctx.value ?? {}) as PanelsValue;
  const update = (id: string, field: 'hidden' | 'collapsed', next: boolean): void => {
    ctx.setValue({ ...panels, [id]: { ...panels[id], [field]: next } });
  };
  const flag = (field: 'hidden' | 'collapsed', header: string, verb: string): DataGridColumn<PanelRow> => ({
    id: field,
    header,
    sortable: false,
    render: ({ id, label }) => (
      <Checkbox
        isSelected={!!panels[id]?.[field]}
        onChange={(v) => update(id, field, v)}
        aria-label={`${verb} ${label} panel`}
      />
    ),
  });
  const columns: DataGridColumn<PanelRow>[] = [
    { id: 'label', header: 'Panel', sortable: false },
    flag('hidden', 'Hidden', 'Hide'),
    flag('collapsed', 'Collapsed', 'Collapse'),
  ];
  return (
    <div className="wd-prefs-panels">
      <div className="wd-prefs-panels-title">{pref.name}</div>
      <DataGrid<PanelRow> rows={PANELS} columns={columns} />
    </div>
  );
}
