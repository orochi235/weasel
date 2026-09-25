/** Preferences modal — kit `PrefsDialog` over the `PREFS` registry.
 *
 *  The kit owns the walk (the navigation rail, label rows, filtering, hidden
 *  filtering, built-in control mapping); this file supplies only what is
 *  WeaselDraw-specific: the values binding (`usePrefsValues` →
 *  localStorage), renderers for the app's two custom kinds
 *  (`registry-enum`, `object`), and the dev-only "Show hidden" switch.
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
import {
  PREFS,
  usePrefsValues,
  type WeaselDrawPrefGroup,
  type WeaselDrawPrefObject,
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
  const dev = useMemo(isDevMode, []);
  const [showHidden, setShowHidden] = useState(false);
  const [values, setAt] = usePrefsValues();

  return (
    <RegistryEnumSourcesContext.Provider value={sources}>
      <PrefsDialog
        isOpen={open}
        onOpenChange={(o) => { if (!o) onClose(); }}
        layout="rail"
        filterable
        schema={PREFS as WeaselDrawPrefGroup}
        values={values}
        onChange={setAt}
        showHidden={showHidden}
        renderers={{
          'registry-enum': RegistryEnumControl,
          object: ObjectControl,
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

function RegistryEnumControl(ctx: PrefRenderContext) {
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

function ObjectControl(ctx: PrefRenderContext) {
  // `ui.panels` has a known shape; anything else object-kind is data
  // other code paths own — show it read-only rather than guessing.
  if (ctx.path === 'ui.panels') return <PanelsEditor ctx={ctx} />;
  return <Code status="muted" variant="plain" size="xs">(object)</Code>;
}

type PanelRow = (typeof PANELS)[number];

export function PanelsEditor({ ctx }: { ctx: PrefRenderContext }) {
  const pref = ctx.pref as WeaselDrawPrefObject;
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
