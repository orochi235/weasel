import { useMemo, type ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import { Checkbox } from '../Checkbox';
import { ColorField } from '../ColorField';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { RadioGroup, Radio } from '../RadioGroup';
import { RangeSlider } from '../RangeSlider';
import { Select } from '../Select';
import { Switch } from '../Switch';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import {
  isPrefLeaf,
  prefValueAtPath,
  visiblePrefSubtree,
  type PrefBoolean,
  type PrefColor,
  type PrefEnum,
  type PrefGroup,
  type PrefLeaf,
  type PrefNumber,
  type PrefString,
} from './schema';
import s from './Prefs.module.css';

export interface PrefRenderContext {
  /** Dotted path of the leaf within the schema root. */
  path: string;
  /** The schema node. App renderers narrow this to their own kind shape. */
  pref: PrefLeaf;
  /** Current value — `values` at `path`, falling back to `pref.default`. */
  value: unknown;
  setValue: (value: unknown) => void;
}

export type PrefRenderer = (ctx: PrefRenderContext) => ReactNode;

export interface PrefsFormProps {
  /** Root of the schema tree. Core `ToolPrefGroup`s assign structurally. */
  schema: PrefGroup;
  /** Nested value tree (shape mirrors the schema). Sparse is fine —
   *  missing leaves fall back to their schema `default`. */
  values?: unknown;
  /** Change callback with the leaf's dotted path. Values apply live;
   *  there is no dirty/commit state. */
  onChange: (path: string, value: unknown) => void;
  /**
   * Per-kind renderers for app-defined kinds. Entries also override the
   * built-in kinds when keys collide. A renderer owns the control cell
   * (the label/tooltip row chrome stays with the form, unless the leaf
   * sets `block`); returning `null` collapses the row entirely. Unknown
   * kinds with no renderer show a labeled placeholder instead of
   * crashing.
   */
  renderers?: Record<string, PrefRenderer>;
  /** Reveal `hidden` leaves (dev tooling). Default false. */
  showHidden?: boolean;
  className?: string;
}

/**
 * Schema-driven preferences form. Top-level groups render as columns,
 * nested groups as indented sub-panels, leaves as label + control rows.
 * Storage-agnostic: pair with `PrefsDialog` for the modal composition,
 * and persist however the app likes via `onChange`.
 */
export function PrefsForm(props: PrefsFormProps) {
  const { schema, values, onChange, renderers, showHidden = false, className } = props;
  const visibleRoot = useMemo(
    () => visiblePrefSubtree(schema, showHidden),
    [schema, showHidden],
  );
  const ctx: WalkCtx = { values, onChange, renderers };
  return (
    <div className={[s.columns, className].filter(Boolean).join(' ')}>
      {Object.entries(visibleRoot?.children ?? {}).map(([key, child]) => (
        <div key={key} className={s.column}>
          {isPrefLeaf(child) ? (
            // Top-level leaves are unusual but legal — give each its own
            // column for symmetry with grouped siblings.
            <PrefRow ctx={ctx} path={key} pref={child} />
          ) : (
            <GroupBody ctx={ctx} group={child} path={key} depth={0} />
          )}
        </div>
      ))}
    </div>
  );
}

interface WalkCtx {
  values: unknown;
  onChange: (path: string, value: unknown) => void;
  renderers?: Record<string, PrefRenderer>;
}

function GroupBody({ ctx, group, path, depth }: {
  ctx: WalkCtx;
  group: PrefGroup;
  path: string;
  depth: number;
}) {
  return (
    <div className={depth === 0 ? s.panel : s.subpanel}>
      <div className={s.groupHeader}>
        <h3 className={s.groupTitle}>{group.name}</h3>
        {group.description !== undefined && (
          <p className={s.groupDesc}>{group.description}</p>
        )}
      </div>
      <div className={s.rows}>
        {Object.entries(group.children).map(([key, child]) => {
          const childPath = `${path}.${key}`;
          return isPrefLeaf(child) ? (
            <PrefRow key={key} ctx={ctx} path={childPath} pref={child} />
          ) : (
            <GroupBody key={key} ctx={ctx} group={child} path={childPath} depth={depth + 1} />
          );
        })}
      </div>
    </div>
  );
}

function PrefRow({ ctx, path, pref }: { ctx: WalkCtx; path: string; pref: PrefLeaf }) {
  const stored = prefValueAtPath(ctx.values, path);
  const renderCtx: PrefRenderContext = {
    path,
    pref,
    value: stored !== undefined ? stored : pref.default,
    setValue: (v) => ctx.onChange(path, v),
  };

  const custom = ctx.renderers?.[pref.kind];
  const control = custom ? custom(renderCtx) : renderBuiltin(renderCtx);
  if (custom && control === null) return null;

  // `block` leaves own their chrome (embedded editors with their own
  // header) — no label/tooltip row.
  if (pref.block) return <>{control}</>;

  return (
    <label className={s.row}>
      <span className={s.rowLabel}>
        {pref.name}
        {pref.description ? (
          // Help affordance carries the description tooltip. A tooltip
          // trigger must be interactive (keyboard-reachable), so this is
          // a real button — a bare label span would be neither focusable
          // nor announced.
          <TooltipTrigger>
            <Focusable>
              <button type="button" className={s.help} aria-label={`About ${pref.name}`}>
                ⓘ
              </button>
            </Focusable>
            <Tooltip>{pref.description}</Tooltip>
          </TooltipTrigger>
        ) : null}
      </span>
      <span className={s.rowControl}>{control}</span>
    </label>
  );
}

function renderBuiltin(ctx: PrefRenderContext): ReactNode {
  const { pref, value, setValue } = ctx;
  switch (pref.kind) {
    case 'boolean': {
      const p = pref as PrefBoolean;
      const checked = Boolean(value);
      return p.control === 'switch' ? (
        <Switch isSelected={checked} onChange={setValue} aria-label={p.name} />
      ) : (
        <Checkbox isSelected={checked} onChange={setValue} aria-label={p.name} />
      );
    }
    case 'number': {
      const p = pref as PrefNumber;
      const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
      if (p.control === 'slider') {
        return (
          <RangeSlider
            value={n}
            onChange={(v) => setValue(typeof v === 'number' ? v : v[0])}
            minValue={p.min}
            maxValue={p.max}
            step={p.step ?? 1}
            aria-label={p.name}
          />
        );
      }
      return (
        <NumberField
          value={n}
          onChange={setValue}
          minValue={p.min}
          maxValue={p.max}
          step={p.step ?? 1}
          aria-label={p.name}
        />
      );
    }
    case 'string': {
      const p = pref as PrefString;
      const text = typeof value === 'string' ? value : '';
      if (p.control === 'textarea') {
        return (
          <textarea
            className={s.textarea}
            value={text}
            onChange={(e) => setValue(e.target.value)}
            aria-label={p.name}
            rows={3}
          />
        );
      }
      return <Input value={text} onChange={setValue} aria-label={p.name} />;
    }
    case 'enum': {
      const p = pref as PrefEnum;
      const selected = typeof value === 'string' ? value : p.default;
      if (p.control === 'radio') {
        return (
          <RadioGroup
            value={selected}
            onChange={(v) => setValue(v)}
            aria-label={p.name}
          >
            {p.options.map((o) => (
              <Radio key={o.value} value={o.value}>{o.label}</Radio>
            ))}
          </RadioGroup>
        );
      }
      return (
        <Select<string>
          options={p.options.map((o) => ({ value: o.value, label: o.label }))}
          selectedKey={selected}
          onSelectionChange={(v) => setValue(v)}
          aria-label={p.name}
        />
      );
    }
    case 'color': {
      const p = pref as PrefColor;
      const hex = typeof value === 'string' ? value : p.default;
      return (
        <ColorField
          value={hex}
          alpha={p.alpha}
          onChange={setValue}
          aria-label={p.name}
        />
      );
    }
    default:
      // Unknown kind with no renderer entry: labeled placeholder, not a
      // crash — a missing wiring should be visible and recoverable.
      return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
}
