/**
 * CSS Vars addon — manager-side panel.
 *
 * Two tabs:
 *   1. **Theme** — every `--wzl-*` token, from the generated token
 *      manifest.
 *   2. **Story** — every `var(--...)` reference the preview side scrapes
 *      out of the currently-rendered story's computed styles. Catches
 *      component-local vars like `--curve-line`.
 *
 * Both tabs share a row UI: name, current value, text input, optional
 * color picker, reset button. Overrides persist to `localStorage` (not
 * per-story — they're a developer affordance, like browser DevTools
 * inspector edits).
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { addons, types, useChannel } from 'storybook/manager-api';
import { AddonPanel } from 'storybook/internal/components';
// `tokens.generated.ts` is materialized by `preset.ts` on Storybook
// start — see comments there. The manager bundle is built by esbuild,
// which can't resolve the workspace package, so it reads the copy.
import tokens from './tokens.generated';

const ADDON_ID = 'weasel/css-vars';
const PANEL_ID = `${ADDON_ID}/panel`;

const EVT_INTROSPECT_RESULT = 'WEASEL_CSS_VARS/INTROSPECT_RESULT';
const EVT_OVERRIDE = 'WEASEL_CSS_VARS/OVERRIDE';
const EVT_CLEAR_OVERRIDES = 'WEASEL_CSS_VARS/CLEAR_OVERRIDES';
const EVT_REQUEST_RESYNC = 'WEASEL_CSS_VARS/REQUEST_RESYNC';

const STORAGE_KEY = 'weasel:css-vars:overrides';

/**
 * Single-line row: `[name | value]`. Value right-aligns and truncates
 * with ellipsis. Click opens the floating editor (rendered separately
 * via a portal). Hover shows a CSS-only tooltip with ~120ms dwell — no
 * JS state, no native `title` (which has multi-second OS dwell).
 */
const PANEL_CSS = `
.wzl-cssvars-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  width: 100%;
  padding: 4px 12px;
  margin: 0;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: transparent;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  position: relative;
}
.wzl-cssvars-row:hover,
.wzl-cssvars-row[data-editing] {
  background: rgba(255, 255, 255, 0.04);
}
.wzl-cssvars-name {
  flex: 0 0 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}
.wzl-cssvars-dot {
  color: #e08a3c;
  margin-left: 6px;
}
.wzl-cssvars-value {
  flex: 1 1 0;
  min-width: 0;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.7;
}
.wzl-cssvars-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  margin-right: 6px;
  vertical-align: -1px;
}

.wzl-cssvars-tip {
  position: absolute;
  top: 100%;
  left: 12px;
  z-index: 100;
  margin-top: 2px;
  padding: 6px 10px;
  background: #0b0d11;
  color: #e6e7e9;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.45;
  max-width: 320px;
  word-break: break-all;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 80ms ease-out 120ms, transform 80ms ease-out 120ms;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.wzl-cssvars-row:hover .wzl-cssvars-tip {
  opacity: 1;
  transform: translateY(0);
}
.wzl-cssvars-row[data-editing] .wzl-cssvars-tip {
  display: none;
}
.wzl-cssvars-tip-label {
  opacity: 0.55;
  margin-right: 6px;
}

/* Floating editor — portal'd to document.body, position computed
 * on open. */
.wzl-cssvars-editor {
  position: fixed;
  z-index: 200;
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px;
  background: #0b0d11;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
}
.wzl-cssvars-editor-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 3px;
  background: #11141a;
  color: #e6e7e9;
  min-width: 200px;
}
.wzl-cssvars-editor-color {
  width: 28px;
  height: 26px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: transparent;
  cursor: pointer;
}
.wzl-cssvars-editor-btn {
  font-size: 11px;
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 3px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.wzl-cssvars-editor-btn:disabled {
  cursor: default;
  opacity: 0.4;
}
`;

type Overrides = Record<string, string>;

interface IntrospectVar {
  readonly name: string;
  readonly currentValue: string;
}

/** Color-shape detector. Liberal — anything that *looks* like a color
 *  gets a color picker alongside the text input. */
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgb|rgba|hsl|hsla|hwb|oklch|oklab|lab|lch|color)\b/i;
const NAMED_COLORS = new Set([
  'transparent', 'currentcolor', 'red', 'green', 'blue', 'black', 'white',
  'yellow', 'cyan', 'magenta', 'gray', 'grey', 'orange', 'purple', 'pink',
  'brown', 'lime', 'navy', 'teal', 'silver', 'gold',
]);

function isColorish(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (COLOR_RE.test(v)) return true;
  if (NAMED_COLORS.has(v)) return true;
  // color-mix(...) / var(...) that resolves to a color — best-effort
  if (v.startsWith('color-mix(')) return true;
  return false;
}

/**
 * Best-effort coerce arbitrary color string → `#rrggbb` for the native
 * `<input type="color">`. Uses an offscreen canvas; returns null if the
 * browser can't parse the value (e.g. `color-mix()` in older engines).
 */
function toHex(value: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    const out = ctx.fillStyle;
    if (typeof out === 'string' && out.startsWith('#')) return out;
    // Some browsers normalize to `rgb(...)` — convert manually.
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(out));
    if (m) {
      const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
      return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
    }
    return null;
  } catch {
    return null;
  }
}

function loadOverrides(): Overrides {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(o: Overrides): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* quota — non-fatal */
  }
}

interface RowProps {
  readonly name: string;
  readonly defaultValue: string;
  readonly currentValue: string;
  readonly override: string | undefined;
  readonly editing: boolean;
  readonly onOpen: (anchor: DOMRect) => void;
}

function Row({ name, defaultValue, currentValue, override, editing, onOpen }: RowProps): React.ReactElement {
  const displayed = override ?? currentValue ?? defaultValue;
  const colorish = isColorish(displayed) || isColorish(defaultValue);
  const hex = colorish ? toHex(displayed) : null;
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    onOpen(rect);
  };
  return (
    <button
      type="button"
      className="wzl-cssvars-row"
      onClick={handleClick}
      data-editing={editing ? '' : undefined}
    >
      <span className="wzl-cssvars-name">
        {name}
        {override !== undefined && (
          <span className="wzl-cssvars-dot" aria-label="overridden">●</span>
        )}
      </span>
      <span className="wzl-cssvars-value">
        {hex && <span className="wzl-cssvars-swatch" style={{ background: hex }} />}
        {displayed}
      </span>
      <span className="wzl-cssvars-tip" role="tooltip">
        <div>
          <span className="wzl-cssvars-tip-label">current</span>
          {displayed}
        </div>
        <div>
          <span className="wzl-cssvars-tip-label">default</span>
          {defaultValue}
        </div>
      </span>
    </button>
  );
}

interface EditorProps {
  readonly anchor: DOMRect;
  readonly name: string;
  readonly value: string;
  readonly hasOverride: boolean;
  readonly onChange: (value: string) => void;
  readonly onReset: () => void;
  readonly onClose: () => void;
}

function Editor({ anchor, name, value, hasOverride, onChange, onReset, onClose }: EditorProps): React.ReactElement {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const colorish = isColorish(value);
  const hex = colorish ? toHex(value) : null;

  // Position below the anchor row. The editor is `position: fixed`, so
  // anchor.left/bottom (viewport-relative) is exactly what we want. We
  // clamp the right edge to keep it on-screen when a row sits near the
  // viewport's right border (e.g. inside the pinned 320px secondary
  // panel slot).
  const style: React.CSSProperties = React.useMemo(() => {
    const top = anchor.bottom + 4;
    const minWidth = 320;
    const maxLeft = window.innerWidth - minWidth - 8;
    const left = Math.min(anchor.left, Math.max(8, maxLeft));
    return { top, left };
  }, [anchor]);

  React.useEffect(() => {
    const onDocPointerDown = (e: MouseEvent): void => {
      if (!rootRef.current) return;
      const target = e.target as Node | null;
      if (rootRef.current.contains(target)) return;
      // Clicking another row should not flash-close — let the row's own
      // onClick handler retarget the editor to the new anchor.
      if (target instanceof Element && target.closest('.wzl-cssvars-row')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div ref={rootRef} className="wzl-cssvars-editor" style={style} role="dialog" aria-label={`Edit ${name}`}>
      <input
        className="wzl-cssvars-editor-text"
        type="text"
        value={value}
        autoFocus
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      {colorish && hex !== null && (
        <input
          className="wzl-cssvars-editor-color"
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick color"
        />
      )}
      <button
        type="button"
        className="wzl-cssvars-editor-btn"
        onClick={onReset}
        disabled={!hasOverride}
      >
        Reset
      </button>
      <button
        type="button"
        className="wzl-cssvars-editor-btn"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
    </div>,
    document.body,
  );
}

interface ListProps {
  readonly rows: readonly { name: string; defaultValue: string; currentValue: string; group?: string }[];
  readonly overrides: Overrides;
  readonly onChange: (name: string, value: string) => void;
  readonly onReset: (name: string) => void;
  readonly onResetAll: () => void;
  readonly emptyHint: string;
  readonly grouped: boolean;
}

function List({ rows, overrides, onChange, onReset, onResetAll, emptyHint, grouped }: ListProps): React.ReactElement {
  const hasOverrides = rows.some((r) => overrides[r.name] !== undefined);
  const [editing, setEditing] = React.useState<{ name: string; anchor: DOMRect } | null>(null);
  const [query, setQuery] = React.useState('');
  const editingRow = editing ? rows.find((r) => r.name === editing.name) ?? null : null;

  if (rows.length === 0) {
    return (
      <div style={{ padding: 24, fontStyle: 'italic', opacity: 0.7 }}>{emptyHint}</div>
    );
  }

  // Filter on name OR current value — searching by color hex or `var(...)`
  // target is often as useful as searching by token name.
  const q = query.trim().toLowerCase();
  const filtered = q === ''
    ? rows
    : rows.filter((r) =>
        r.name.toLowerCase().includes(q) || r.currentValue.toLowerCase().includes(q),
      );

  // Group by `group` if requested; else single bucket.
  const buckets = new Map<string, typeof filtered>();
  for (const r of filtered) {
    const k = grouped ? (r.group ?? 'other') : '';
    const arr = (buckets.get(k) ?? []) as typeof filtered;
    buckets.set(k, [...arr, r]);
  }

  const countText = q === ''
    ? `${rows.length} variable${rows.length === 1 ? '' : 's'}`
    : `${filtered.length} / ${rows.length} variable${rows.length === 1 ? '' : 's'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '6px 12px',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
          <span>{countText}</span>
          <button
            type="button"
            onClick={onResetAll}
            disabled={!hasOverrides}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              border: '1px solid rgba(0,0,0,0.15)',
              borderRadius: 3,
              background: 'transparent',
              cursor: hasOverrides ? 'pointer' : 'default',
              opacity: hasOverrides ? 1 : 0.4,
            }}
          >
            Reset all
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && query !== '') { e.stopPropagation(); setQuery(''); } }}
            placeholder="Filter by name or value…"
            spellCheck={false}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              padding: '4px 24px 4px 8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              background: '#11141a',
              color: '#e6e7e9',
            }}
          />
          {query !== '' && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear filter"
              title="Clear"
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 18,
                height: 18,
                border: 'none',
                borderRadius: 3,
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                opacity: 0.7,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, fontStyle: 'italic', opacity: 0.6 }}>
            No matches for &ldquo;{query}&rdquo;.
          </div>
        )}
        {Array.from(buckets.entries()).map(([group, items]) => (
          <div key={group}>
            {grouped && group && (
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  opacity: 0.6,
                  background: 'rgba(0,0,0,0.03)',
                }}
              >
                {group}
              </div>
            )}
            {items.map((r) => (
              <Row
                key={r.name}
                name={r.name}
                defaultValue={r.defaultValue}
                currentValue={r.currentValue}
                override={overrides[r.name]}
                editing={editing?.name === r.name}
                onOpen={(anchor) => setEditing({ name: r.name, anchor })}
              />
            ))}
          </div>
        ))}
      </div>
      {editing && editingRow && (
        <Editor
          anchor={editing.anchor}
          name={editing.name}
          value={overrides[editing.name] ?? editingRow.currentValue ?? editingRow.defaultValue}
          hasOverride={overrides[editing.name] !== undefined}
          onChange={(v) => onChange(editing.name, v)}
          onReset={() => onReset(editing.name)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Panel(): React.ReactElement {
  const [tab, setTab] = React.useState<'theme' | 'story'>('theme');
  const [overrides, setOverrides] = React.useState<Overrides>(() => loadOverrides());
  const [storyVars, setStoryVars] = React.useState<readonly IntrospectVar[]>([]);
  // Computed values for theme tokens — kept in state so re-render after
  // override apply reflects the new resolved value.
  const [themeComputed, setThemeComputed] = React.useState<Record<string, string>>({});

  const emit = useChannel({
    [EVT_INTROSPECT_RESULT]: (payload: { vars: IntrospectVar[]; themeComputed?: Record<string, string> }) => {
      setStoryVars(payload.vars ?? []);
      if (payload.themeComputed) setThemeComputed(payload.themeComputed);
    },
  });

  // On mount: send the persisted overrides to the preview side so the
  // injected `<style>` reflects them immediately. Also ask the preview
  // to re-introspect so we get fresh `themeComputed` + storyVars.
  React.useEffect(() => {
    if (Object.keys(overrides).length > 0) {
      emit(EVT_OVERRIDE, { overrides });
    }
    emit(EVT_REQUEST_RESYNC, {});
    // Intentionally fire-once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyOverride = React.useCallback(
    (name: string, value: string) => {
      setOverrides((prev) => {
        const next = { ...prev, [name]: value };
        saveOverrides(next);
        emit(EVT_OVERRIDE, { overrides: next });
        return next;
      });
    },
    [emit],
  );

  const resetOne = React.useCallback(
    (name: string) => {
      setOverrides((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        saveOverrides(next);
        emit(EVT_OVERRIDE, { overrides: next });
        return next;
      });
    },
    [emit],
  );

  const resetAll = React.useCallback(() => {
    setOverrides({});
    saveOverrides({});
    emit(EVT_CLEAR_OVERRIDES, {});
  }, [emit]);

  const themeRows = React.useMemo(
    () =>
      tokens.map((t) => ({
        name: t.name,
        defaultValue: t.defaultValue,
        currentValue: themeComputed[t.name] ?? t.defaultValue,
        group: t.group,
      })),
    [themeComputed],
  );

  const storyRows = React.useMemo(
    () =>
      storyVars.map((v) => ({
        name: v.name,
        defaultValue: v.currentValue,
        currentValue: v.currentValue,
      })),
    [storyVars],
  );

  return (
    <div
      className="wzl-cssvars-root"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', containerType: 'inline-size' }}
    >
      <style>{PANEL_CSS}</style>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        {(['theme', 'story'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: tab === t ? '2px solid #1ea7fd' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: tab === t ? 600 : 400,
              color: 'inherit',
            }}
          >
            {t === 'theme' ? 'Theme' : 'Story'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'theme' ? (
          <List
            rows={themeRows}
            overrides={overrides}
            onChange={applyOverride}
            onReset={resetOne}
            onResetAll={resetAll}
            emptyHint="No tokens found."
            grouped
          />
        ) : (
          <List
            rows={storyRows}
            overrides={overrides}
            onChange={applyOverride}
            onReset={resetOne}
            onResetAll={resetAll}
            emptyHint="No CSS vars referenced yet. Render a story, then switch back to this tab."
            grouped={false}
          />
        )}
      </div>
    </div>
  );
}

addons.register(ADDON_ID, () => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'CSS Vars',
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => (
      <AddonPanel active={!!active}>
        <Panel />
      </AddonPanel>
    ),
  });
});
