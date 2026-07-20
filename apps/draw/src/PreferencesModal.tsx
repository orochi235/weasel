/** Preferences modal — kit `PrefsDialog` over the `PREFS` registry.
 *
 *  The kit owns the walk (columns, sub-panels, label rows, hidden
 *  filtering, built-in control mapping); this file supplies only what is
 *  WeaselDraw-specific: the values binding (`usePrefsValues` →
 *  localStorage), renderers for the app's two custom kinds
 *  (`registry-enum`, `object`), and the dev-only "Show hidden" switch.
 */
import { useMemo, useState } from 'react';
import {
  Checkbox,
  PrefsDialog,
  Switch,
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
      selectClassName="wd-prefs-select"
      inputClassName="wd-prefs-input"
    />
  );
}

function ObjectControl(ctx: PrefRenderContext) {
  // `ui.panels` has a known shape; anything else object-kind is data
  // other code paths own — show it read-only rather than guessing.
  if (ctx.path === 'ui.panels') return <PanelsEditor ctx={ctx} />;
  return <span className="wd-prefs-readonly">(object)</span>;
}

type PanelsValue = Record<string, { hidden?: boolean; collapsed?: boolean }>;

// Keys here mirror the panel ids currently rendered in the right sidebar
// (see App.tsx) plus the History panel. Listed explicitly so unconfigured
// panels still appear in the editor and users can toggle them off before
// ever interacting with the panel itself.
const KNOWN_PANELS: { id: string; label: string }[] = [
  { id: 'defaults',  label: 'Defaults' },
  { id: 'selection', label: 'Selection' },
  { id: 'colors',    label: 'Colors' },
  { id: 'layers',    label: 'Layers' },
  { id: 'history',   label: 'History' },
  { id: 'document',  label: 'Document' },
  { id: 'view',      label: 'View' },
];

function PanelsEditor({ ctx }: { ctx: PrefRenderContext }) {
  const pref = ctx.pref as WeaselDrawPrefObject;
  const panels = (ctx.value ?? {}) as PanelsValue;
  const update = (id: string, field: 'hidden' | 'collapsed', next: boolean): void => {
    ctx.setValue({ ...panels, [id]: { ...panels[id], [field]: next } });
  };
  return (
    <div className="wd-prefs-panels">
      <div className="wd-prefs-panels-title">{pref.name}</div>
      <div className="wd-prefs-panels-head">
        <span className="wd-prefs-panels-head-name">Panel</span>
        <span className="wd-prefs-panels-head-flag">Hidden</span>
        <span className="wd-prefs-panels-head-flag">Collapsed</span>
      </div>
      {KNOWN_PANELS.map(({ id, label }) => {
        const state = panels[id] ?? {};
        return (
          <div key={id} className="wd-prefs-panels-row">
            <span className="wd-prefs-panels-row-name">{label}</span>
            <Checkbox
              isSelected={!!state.hidden}
              onChange={(v) => update(id, 'hidden', v)}
              aria-label={`Hide ${label} panel`}
            />
            <Checkbox
              isSelected={!!state.collapsed}
              onChange={(v) => update(id, 'collapsed', v)}
              aria-label={`Collapse ${label} panel`}
            />
          </div>
        );
      })}
    </div>
  );
}
