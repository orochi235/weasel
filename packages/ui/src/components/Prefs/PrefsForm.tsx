import { useMemo, type ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import { Checkbox } from '../Checkbox';
import { ColorField } from '../ColorField';
import { solidColorOf } from '../paintValue';
import { Input } from '../Input';
import { NumberField } from '../NumberField';
import { RadioGroup, Radio } from '../RadioGroup';
import { RangeSlider } from '../RangeSlider';
import { Select } from '../Select';
import { Switch } from '../Switch';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import { isBuiltinToolPref } from '@weasel-js/core';
import {
  isPrefLeaf,
  prefValueAtPath,
  visiblePrefSubtree,
  type PrefGroup,
  type PrefLeaf,
} from './schema';
import s from './Prefs.module.css';

/** What a {@link PrefRenderer} is given for the leaf it is rendering. */
export interface PrefRenderContext {
  /** Dotted path of the leaf within the schema root. */
  path: string;
  /** The schema node. App renderers narrow this to their own kind shape. */
  pref: PrefLeaf;
  /** Current value — `values` at `path`, falling back to `pref.default`. */
  value: unknown;
  setValue: (value: unknown) => void;
}

/**
 * Renders the control cell for one preference leaf. Returning `null`
 * collapses the row.
 */
export type PrefRenderer = (ctx: PrefRenderContext) => ReactNode;

/** Props for {@link PrefsForm}. */
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

function renderBuiltin(
  ctx: PrefRenderContext,
  // The object a nested leaf is a field of — what an enum `encoding` reads
  // and writes against. Undefined for a top-level leaf, which has none.
  siblings?: Record<string, unknown>,
): ReactNode {
  const { pref, value, setValue } = ctx;
  if (!isBuiltinToolPref(pref)) {
    // App-defined kind with no `renderers` entry: labeled placeholder, not a
    // crash — a missing wiring should be visible and recoverable.
    return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
  switch (pref.kind) {
    case 'boolean': {
      const checked = Boolean(value);
      return pref.control === 'switch' ? (
        <Switch isSelected={checked} onChange={setValue} aria-label={pref.name} />
      ) : (
        <Checkbox isSelected={checked} onChange={setValue} aria-label={pref.name} />
      );
    }
    case 'number': {
      const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
      if (pref.control === 'slider') {
        return (
          <RangeSlider
            value={n}
            onChange={(v) => setValue(typeof v === 'number' ? v : v[0])}
            minValue={pref.min}
            maxValue={pref.max}
            step={pref.step ?? 1}
            aria-label={pref.name}
          />
        );
      }
      return (
        <NumberField
          value={n}
          onChange={setValue}
          minValue={pref.min}
          maxValue={pref.max}
          step={pref.step ?? 1}
          aria-label={pref.name}
        />
      );
    }
    case 'string': {
      const text = typeof value === 'string' ? value : '';
      if (pref.control === 'textarea') {
        return (
          <textarea
            className={s.textarea}
            value={text}
            onChange={(e) => setValue(e.target.value)}
            aria-label={pref.name}
            rows={3}
          />
        );
      }
      return <Input value={text} onChange={setValue} aria-label={pref.name} />;
    }
    case 'enum': {
      const encoding = pref.encoding;
      // An encoded leaf stores something other than the option string (a dash
      // array), so reading the raw value selects nothing and writing one
      // replaces the stored form with the option string.
      const option = encoding
        ? encoding.read(value, siblings)
        : typeof value === 'string'
          ? value
          : pref.default;
      const choose = (next: string): void =>
        setValue(encoding ? encoding.write(next, siblings) : next);
      if (pref.control === 'radio') {
        return (
          <RadioGroup value={option ?? null} onChange={choose} aria-label={pref.name}>
            {pref.options.map((o) => (
              <Radio key={o.value} value={o.value} isDisabled={o.disabled}>
                {o.label}
              </Radio>
            ))}
          </RadioGroup>
        );
      }
      return (
        <Select<string>
          options={pref.options.map((o) => ({
            value: o.value,
            label: o.label,
            isDisabled: o.disabled,
          }))}
          selectedKey={option ?? null}
          onSelectionChange={choose}
          aria-label={pref.name}
        />
      );
    }
    case 'color': {
      const hex = typeof value === 'string' ? value : pref.default;
      return (
        <ColorField
          value={hex}
          alpha={pref.alpha}
          onChange={setValue}
          aria-label={pref.name}
        />
      );
    }
    case 'paint': {
      // A whole `FillStyle`. A gradient or pattern has no single color to
      // show, so the field goes blank rather than claiming one, and an edit
      // writes a whole solid union member rather than grafting a `color` key
      // onto the gradient.
      const solid = solidColorOf(value) ?? solidColorOf(pref.default);
      return (
        <ColorField
          value={solid}
          alpha={pref.alpha}
          onChange={(color) => setValue({ fill: 'solid', color })}
          aria-label={pref.name}
        />
      );
    }
    case 'object': {
      // One value with its fields hanging off it: each child renders its own
      // control and commits the parent object whole.
      const p = pref;
      const held = typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : undefined;
      const objectRows = (children: Record<string, PrefLeaf | PrefGroup>): ReactNode[] => {
        const out: ReactNode[] = [];
        for (const [key, child] of Object.entries(children)) {
          if (!isPrefLeaf(child)) {
            const inner = objectRows(child.children);
            if (inner.length === 0) continue;
            out.push(<h4 key={`group:${key}`} className={s.objectGroup}>{child.name}</h4>, ...inner);
            continue;
          }
          out.push(
            <label key={key} className={s.objectRow}>
              <span className={s.objectLabel}>{child.name}</span>
              {renderBuiltin({
                path: `${ctx.path}.${key}`,
                pref: child,
                value: held?.[key],
                setValue: (v) => {
                  const base = held ?? p.fromScalar?.(value) ?? {};
                  setValue({ ...base, [key]: v });
                },
              }, held)}
            </label>,
          );
        }
        return out;
      };
      return <div className={s.objectLeaf}>{objectRows(p.children)}</div>;
    }
    default: {
      // Not reachable while every built-in kind has an arm — and a new kind
      // that lacks one is a compile error here, never a blank row.
      const _exhaustive: never = pref;
      throw new Error(
        `PrefsForm: no control for built-in pref kind "${(_exhaustive as { kind: string }).kind}"`,
      );
    }
  }
}
