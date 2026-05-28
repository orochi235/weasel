/**
 * CSS Vars addon — manager-side panel.
 *
 * Two tabs:
 *   1. **Theme** — every `--wzl-*` token harvested from `tokens.css` at
 *      build time (via `virtual:weasel-tokens`).
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
import { addons, types, useChannel } from 'storybook/manager-api';
import { AddonPanel } from 'storybook/internal/components';
// `tokens.generated.ts` is materialized by `preset.ts` on Storybook
// start — see comments there. We import from the generated file rather
// than `virtual:weasel-tokens` because the manager bundle is built by
// esbuild, which doesn't see Vite virtual modules.
import tokens from './tokens.generated';

const ADDON_ID = 'weasel/css-vars';
const PANEL_ID = `${ADDON_ID}/panel`;

const EVT_INTROSPECT_RESULT = 'WEASEL_CSS_VARS/INTROSPECT_RESULT';
const EVT_OVERRIDE = 'WEASEL_CSS_VARS/OVERRIDE';
const EVT_CLEAR_OVERRIDES = 'WEASEL_CSS_VARS/CLEAR_OVERRIDES';
const EVT_REQUEST_RESYNC = 'WEASEL_CSS_VARS/REQUEST_RESYNC';

const STORAGE_KEY = 'weasel:css-vars:overrides';

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
  readonly onChange: (value: string) => void;
  readonly onReset: () => void;
}

function Row({ name, defaultValue, currentValue, override, onChange, onReset }: RowProps): React.ReactElement {
  const displayed = override ?? currentValue ?? defaultValue;
  const colorish = isColorish(displayed) || isColorish(defaultValue);
  const hex = colorish ? toHex(displayed) : null;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 1fr) minmax(120px, 1.2fr) auto auto',
        gap: 8,
        alignItems: 'center',
        padding: '4px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
      }}
    >
      <span
        title={`default: ${defaultValue}`}
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {name}
        {override !== undefined && (
          <span style={{ marginLeft: 6, color: '#e08a3c' }} title="overridden">●</span>
        )}
      </span>
      <input
        type="text"
        value={displayed}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{
          fontFamily: 'inherit',
          fontSize: 12,
          padding: '2px 6px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
          background: '#11141a',
          color: '#e6e7e9',
          minWidth: 0,
        }}
      />
      {colorish && hex ? (
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 28, height: 22, padding: 0, border: '1px solid rgba(0,0,0,0.15)', background: 'transparent', cursor: 'pointer' }}
          title="Pick color"
        />
      ) : (
        <span style={{ width: 28 }} />
      )}
      <button
        type="button"
        onClick={onReset}
        disabled={override === undefined}
        title="Reset to default"
        style={{
          fontSize: 11,
          padding: '2px 8px',
          border: '1px solid rgba(0,0,0,0.15)',
          borderRadius: 3,
          background: 'transparent',
          cursor: override === undefined ? 'default' : 'pointer',
          opacity: override === undefined ? 0.4 : 1,
        }}
      >
        Reset
      </button>
    </div>
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

  if (rows.length === 0) {
    return (
      <div style={{ padding: 24, fontStyle: 'italic', opacity: 0.7 }}>{emptyHint}</div>
    );
  }

  // Group by `group` if requested; else single bucket.
  const buckets = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = grouped ? (r.group ?? 'other') : '';
    const arr = (buckets.get(k) ?? []) as typeof rows;
    buckets.set(k, [...arr, r]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          fontSize: 11,
          opacity: 0.8,
        }}
      >
        <span>{rows.length} variable{rows.length === 1 ? '' : 's'}</span>
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
      <div style={{ overflowY: 'auto', flex: 1 }}>
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
                onChange={(v) => onChange(r.name, v)}
                onReset={() => onReset(r.name)}
              />
            ))}
          </div>
        ))}
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
