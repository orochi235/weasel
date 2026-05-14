/** Preferences modal — renders the entire `PREFS` registry as a centered
 *  overlay. Top-level groups become columns; nested sub-groups render as
 *  indented inner panels. Each leaf binds to `usePref(<dotted path>)` so
 *  changes persist immediately to localStorage.
 *
 *  The path argument to `usePref` is computed by walking the tree at
 *  render time, so TS can't infer the literal-string union through the
 *  recursion — we cast to `SwillPrefPath` at the leaf only. That's the
 *  one type pragmatism the recursive walk requires.
 */
import { useEffect } from 'react';
import {
  PREFS,
  usePref,
  type SwillPref,
  type SwillPrefGroup,
  type SwillPrefBoolean,
  type SwillPrefNumber,
  type SwillPrefString,
  type SwillPrefEnum,
  type SwillPrefObject,
  type SwillPrefPath,
} from './prefs';

export interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
}

export function PreferencesModal({ open, onClose }: PreferencesModalProps) {
  // Esc closes. Bound on the document while open so the modal works even
  // when focus is inside one of its inputs (where the app-level Cmd-,
  // keybinding's `skipInEditable` would suppress it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="swill-prefs-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Preferences"
      onClick={(e) => {
        // Click on the backdrop (not bubbled from the modal box) closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="swill-prefs-modal">
        <div className="swill-prefs-header">
          <h2 className="swill-prefs-title">{PREFS.name}</h2>
          <button
            type="button"
            className="swill-prefs-close"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close preferences"
          >
            ×
          </button>
        </div>
        <div className="swill-prefs-columns">
          {Object.entries(PREFS.children).map(([key, rawChild]) => {
            // Widen here: `PREFS.children` has narrow inferred entries (each
            // top-level child is a distinct group shape from `satisfies`), so
            // TS won't accept the structural narrowing inside the loop.
            const child = rawChild as SwillPref | SwillPrefGroup;
            if ('kind' in child) {
              // Top-level leaves are unusual in this registry but render
              // them in their own column for symmetry.
              return (
                <div key={key} className="swill-prefs-column">
                  <PrefRow path={key} pref={child} />
                </div>
              );
            }
            return (
              <div key={key} className="swill-prefs-column">
                <PrefGroupBody group={child} path={key} depth={0} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface PrefGroupBodyProps {
  group: SwillPrefGroup;
  path: string;
  depth: number;
}

function PrefGroupBody({ group, path, depth }: PrefGroupBodyProps) {
  return (
    <div className={depth === 0 ? 'swill-prefs-panel' : 'swill-prefs-subpanel'}>
      <div className="swill-prefs-group-header">
        <h3 className="swill-prefs-group-title">{group.name}</h3>
        {group.description && <p className="swill-prefs-group-desc">{group.description}</p>}
      </div>
      <div className="swill-prefs-rows">
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
  pref: SwillPref;
}

function PrefRow({ path, pref }: PrefRowProps) {
  // Object-kind prefs render as their own embedded sub-panel (the editor
  // supplies its own header). Skip the label/control row wrapper so the
  // editor can stretch full-width inside its parent column.
  if (pref.kind === 'object') {
    return <PrefInput path={path} pref={pref} />;
  }
  return (
    <label className="swill-prefs-row" title={pref.description}>
      <span className="swill-prefs-row-label">{pref.name}</span>
      <span className="swill-prefs-row-control">
        <PrefInput path={path} pref={pref} />
      </span>
    </label>
  );
}

function PrefInput({ path, pref }: { path: string; pref: SwillPref }) {
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
    case 'object':
      return <ObjectInput path={path} pref={pref} />;
  }
}

function BooleanInput({ path, pref: _pref }: { path: string; pref: SwillPrefBoolean }) {
  const [value, setValue] = usePref(path as SwillPrefPath) as unknown as [
    boolean,
    (v: boolean) => void,
  ];
  return (
    <input
      type="checkbox"
      className="swill-prefs-checkbox"
      checked={value}
      onChange={(e) => setValue(e.target.checked)}
    />
  );
}

function NumberInput({ path, pref }: { path: string; pref: SwillPrefNumber }) {
  const [value, setValue] = usePref(path as SwillPrefPath) as unknown as [
    number,
    (v: number) => void,
  ];
  return (
    <input
      type="number"
      className="swill-prefs-input"
      value={Number.isFinite(value) ? value : 0}
      min={pref.min}
      max={pref.max}
      step={pref.step ?? 1}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        setValue(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}

function StringInput({ path, pref: _pref }: { path: string; pref: SwillPrefString }) {
  const [value, setValue] = usePref(path as SwillPrefPath) as unknown as [
    string,
    (v: string) => void,
  ];
  return (
    <input
      type="text"
      className="swill-prefs-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

function EnumInput({ path, pref }: { path: string; pref: SwillPrefEnum }) {
  const [value, setValue] = usePref(path as SwillPrefPath) as unknown as [
    string,
    (v: string) => void,
  ];
  return (
    <select
      className="swill-prefs-select"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    >
      {pref.options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ObjectInput({ path, pref }: { path: string; pref: SwillPrefObject }) {
  // Object-kind prefs need bespoke UI. `ui.panels` has a known shape
  // (Record<string, { hidden?, collapsed? }>) so render it as an embedded
  // sub-panel — one row per known panel with hide / collapse toggles.
  if (path === 'ui.panels') return <PanelsEditor pref={pref} />;
  return <span className="swill-prefs-readonly">(object)</span>;
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

function PanelsEditor({ pref }: { pref: SwillPrefObject }) {
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
    <div className="swill-prefs-subpanel swill-prefs-subpanel-inline">
      <div className="swill-prefs-group-header">
        <h3 className="swill-prefs-group-title">{pref.name}</h3>
        <p className="swill-prefs-group-desc">{pref.description}</p>
      </div>
      <div className="swill-prefs-rows">
        <div className="swill-prefs-panels-head">
          <span className="swill-prefs-panels-head-name">Panel</span>
          <span className="swill-prefs-panels-head-flag">Hidden</span>
          <span className="swill-prefs-panels-head-flag">Collapsed</span>
        </div>
        {KNOWN_PANELS.map(({ id, label }) => {
          const state = panels[id] ?? {};
          return (
            <div key={id} className="swill-prefs-panels-row">
              <span className="swill-prefs-panels-row-name">{label}</span>
              <input
                type="checkbox"
                className="swill-prefs-checkbox"
                checked={!!state.hidden}
                onChange={(e) => update(id, 'hidden', e.target.checked)}
                aria-label={`Hide ${label} panel`}
              />
              <input
                type="checkbox"
                className="swill-prefs-checkbox"
                checked={!!state.collapsed}
                onChange={(e) => update(id, 'collapsed', e.target.checked)}
                aria-label={`Collapse ${label} panel`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
