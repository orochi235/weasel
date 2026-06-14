/** Preferences modal — renders the entire `PREFS` registry as a centered
 *  overlay. Top-level groups become columns; nested sub-groups render as
 *  indented inner panels. Each leaf binds to `usePref(<dotted path>)` so
 *  changes persist immediately to localStorage.
 *
 *  The path argument to `usePref` is computed by walking the tree at
 *  render time, so TS can't infer the literal-string union through the
 *  recursion — we cast to `WeaselDrawPrefPath` at the leaf only. That's the
 *  one type pragmatism the recursive walk requires.
 */
import { useMemo, useState } from 'react';
import { Checkbox, Dialog, Input, NumberField, RangeSlider, Select, Switch } from '@weasel-js/ui';
import {
  PREFS,
  usePref,
  type WeaselDrawPref,
  type WeaselDrawPrefGroup,
  type WeaselDrawPrefBoolean,
  type WeaselDrawPrefNumber,
  type WeaselDrawPrefString,
  type WeaselDrawPrefEnum,
  type WeaselDrawPrefRegistryEnum,
  type WeaselDrawPrefObject,
  type WeaselDrawPrefPath,
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

/** Recursively walk a group, omitting hidden leaves unless `showHidden`.
 *  Returns null when the entire subtree is hidden so empty columns and
 *  empty inner panels disappear too. */
function visibleSubtree(
  node: WeaselDrawPref | WeaselDrawPrefGroup,
  showHidden: boolean,
): WeaselDrawPref | WeaselDrawPrefGroup | null {
  if ('kind' in node) {
    if (node.hidden && !showHidden) return null;
    return node;
  }
  const children: Record<string, WeaselDrawPref | WeaselDrawPrefGroup> = {};
  for (const [k, child] of Object.entries(node.children)) {
    const v = visibleSubtree(child as WeaselDrawPref | WeaselDrawPrefGroup, showHidden);
    if (v) children[k] = v;
  }
  if (Object.keys(children).length === 0) return null;
  return { ...node, children };
}

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
  const filteredRoot = useMemo(
    () => visibleSubtree(PREFS, showHidden) as WeaselDrawPrefGroup | null,
    [showHidden],
  );

  return (
    <RegistryEnumSourcesContext.Provider value={sources}>
      <Dialog
        isOpen={open}
        onOpenChange={(o) => { if (!o) onClose(); }}
        aria-label="Preferences"
        title={
          <span className="wd-prefs-title-row">
            <span>{PREFS.name}</span>
            {dev && (
              <Switch isSelected={showHidden} onChange={setShowHidden}>
                Show hidden
              </Switch>
            )}
          </span>
        }
      >
        <div className="wd-prefs-columns">
          {Object.entries(filteredRoot?.children ?? {}).map(([key, rawChild]) => {
            // Widen here: `PREFS.children` has narrow inferred entries (each
            // top-level child is a distinct group shape from `satisfies`), so
            // TS won't accept the structural narrowing inside the loop.
            const child = rawChild as WeaselDrawPref | WeaselDrawPrefGroup;
            if ('kind' in child) {
              // Top-level leaves are unusual in this registry but render
              // them in their own column for symmetry.
              return (
                <div key={key} className="wd-prefs-column">
                  <PrefRow path={key} pref={child} />
                </div>
              );
            }
            return (
              <div key={key} className="wd-prefs-column">
                <PrefGroupBody group={child} path={key} depth={0} />
              </div>
            );
          })}
        </div>
      </Dialog>
    </RegistryEnumSourcesContext.Provider>
  );
}

interface PrefGroupBodyProps {
  group: WeaselDrawPrefGroup;
  path: string;
  depth: number;
}

function PrefGroupBody({ group, path, depth }: PrefGroupBodyProps) {
  return (
    <div className={depth === 0 ? 'wd-prefs-panel' : 'wd-prefs-subpanel'}>
      <div className="wd-prefs-group-header">
        <h3 className="wd-prefs-group-title">{group.name}</h3>
      </div>
      <div className="wd-prefs-rows">
        {Object.entries(group.children).map(([key, child]) => {
          const childPath = `${path}.${key}`;
          if ('kind' in child) return <PrefRow key={key} path={childPath} pref={child} />;
          return <PrefGroupBody key={key} group={child} path={childPath} depth={depth + 1} />;
        })}
      </div>
    </div>
  );
}

interface PrefRowProps {
  path: string;
  pref: WeaselDrawPref;
}

function PrefRow({ path, pref }: PrefRowProps) {
  // Object-kind prefs render as their own embedded sub-panel (the editor
  // supplies its own header). Skip the label/control row wrapper so the
  // editor can stretch full-width inside its parent column.
  if (pref.kind === 'object') {
    return <PrefInput path={path} pref={pref} />;
  }
  return (
    <label className="wd-prefs-row" title={pref.description}>
      <span className="wd-prefs-row-label">{pref.name}</span>
      <span className="wd-prefs-row-control">
        <PrefInput path={path} pref={pref} />
      </span>
    </label>
  );
}

function PrefInput({ path, pref }: { path: string; pref: WeaselDrawPref }) {
  // The path is statically known at the call site (built by walking the
  // tree from a literal-typed root), but TS can't propagate that through
  // the recursion. Cast once, at the boundary into `usePref`.
  switch (pref.kind) {
    case 'boolean':
      return <BooleanInput path={path} pref={pref} />;
    case 'number':
      return <NumberInput path={path} pref={pref} />;
    case 'string':
      return <StringInput path={path} pref={pref} />;
    case 'enum':
      return <EnumInput path={path} pref={pref} />;
    case 'registry-enum':
      return <RegistryEnumInput path={path} pref={pref} />;
    case 'object':
      return <ObjectInput path={path} pref={pref} />;
  }
}

function BooleanInput({ path, pref: _pref }: { path: string; pref: WeaselDrawPrefBoolean }) {
  const [value, setValue] = usePref(path as WeaselDrawPrefPath) as unknown as [
    boolean,
    (v: boolean) => void,
  ];
  return <Checkbox isSelected={value} onChange={setValue} />;
}

function NumberInput({ path, pref }: { path: string; pref: WeaselDrawPrefNumber }) {
  const [value, setValue] = usePref(path as WeaselDrawPrefPath) as unknown as [
    number,
    (v: number) => void,
  ];
  if (pref.expression === 'slider') {
    return (
      <RangeSlider
        value={Number.isFinite(value) ? value : 0}
        onChange={(v) => setValue(typeof v === 'number' ? v : v[0])}
        minValue={pref.min}
        maxValue={pref.max}
        step={pref.step ?? 1}
      />
    );
  }
  return (
    <NumberField
      value={Number.isFinite(value) ? value : 0}
      onChange={setValue}
      minValue={pref.min}
      maxValue={pref.max}
      step={pref.step ?? 1}
    />
  );
}

function StringInput({ path, pref: _pref }: { path: string; pref: WeaselDrawPrefString }) {
  const [value, setValue] = usePref(path as WeaselDrawPrefPath) as unknown as [
    string,
    (v: string) => void,
  ];
  return <Input value={value} onChange={setValue} />;
}

function EnumInput({ path, pref }: { path: string; pref: WeaselDrawPrefEnum }) {
  const [value, setValue] = usePref(path as WeaselDrawPrefPath) as unknown as [
    string,
    (v: string) => void,
  ];
  return (
    <Select<string>
      options={pref.options.map((o) => ({ value: o.value, label: o.label }))}
      selectedKey={value}
      onSelectionChange={setValue}
    />
  );
}

function RegistryEnumInput({ path, pref }: { path: string; pref: WeaselDrawPrefRegistryEnum }) {
  const [value, setValue] = usePref(path as WeaselDrawPrefPath) as unknown as [
    string,
    (v: string) => void,
  ];
  return (
    <RegistrySelect
      value={value}
      onChange={setValue}
      source={pref.source}
      filter={pref.filter}
      selectClassName="wd-prefs-select"
      inputClassName="wd-prefs-input"
    />
  );
}

function ObjectInput({ path, pref }: { path: string; pref: WeaselDrawPrefObject }) {
  // Object-kind prefs need bespoke UI. `ui.panels` has a known shape
  // (Record<string, { hidden?, collapsed? }>) so render it as an embedded
  // sub-panel — one row per known panel with hide / collapse toggles.
  if (path === 'ui.panels') return <PanelsEditor pref={pref} />;
  return <span className="wd-prefs-readonly">(object)</span>;
}

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

function PanelsEditor({ pref }: { pref: WeaselDrawPrefObject }) {
  const [panels, setPanels] = usePref('ui.panels');
  const update = (
    id: string,
    field: 'hidden' | 'collapsed',
    next: boolean,
  ): void => {
    setPanels((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: next },
    }));
  };
  return (
    <div className="wd-prefs-subpanel wd-prefs-subpanel-inline">
      <div className="wd-prefs-group-header">
        <h3 className="wd-prefs-group-title">{pref.name}</h3>
      </div>
      <div className="wd-prefs-rows">
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
    </div>
  );
}
