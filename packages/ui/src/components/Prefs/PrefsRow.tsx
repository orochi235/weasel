import { type ReactNode } from 'react';
import {
  isPrefLeaf,
  prefValueAtPath,
  type PrefGroup,
  type PrefLeaf,
  type PrefObject,
} from '@weasel-js/prefs';
import { PropertyControl } from '../Properties/PropertyField';
import { PropertyRow } from '../Properties/PropertyPanel';
import { prefFieldProps } from './prefField';
import type { PrefFieldChoice } from './schema';
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
  /** Whether this leaf is currently auto — not pinned, computed by the owner. */
  auto: boolean;
  /** Toggle this leaf's auto state. */
  setAuto: (next: boolean) => void;
  /** The form's fields, which a `field` leaf names one of. */
  fields?: readonly PrefFieldChoice[];
}

/**
 * Renders the control cell for one preference leaf. Returning `null`
 * collapses the row.
 */
export type PrefRenderer = (ctx: PrefRenderContext) => ReactNode;

export interface WalkCtx {
  values: unknown;
  onChange: (path: string, value: unknown) => void;
  renderers?: Record<string, PrefRenderer>;
  auto?: ReadonlySet<string>;
  onAutoChange?: (path: string, next: boolean) => void;
  inheritHint?: (path: string) => string | undefined;
  canInherit?: (path: string) => boolean;
  fields?: readonly PrefFieldChoice[];
}

export function PrefRow({ ctx, path, pref }: { ctx: WalkCtx; path: string; pref: PrefLeaf }) {
  const stored = prefValueAtPath(ctx.values, path);
  const inherited = ctx.auto?.has(path) ?? false;
  const { onAutoChange } = ctx;
  const toggles = onAutoChange !== undefined && (ctx.canInherit?.(path) ?? true);
  const setAuto = (next: boolean): void => {
    if (toggles) onAutoChange(path, next);
  };
  const renderCtx: PrefRenderContext = {
    path,
    pref,
    value: stored !== undefined ? stored : pref.default,
    setValue: (v) => ctx.onChange(path, v),
    auto: inherited,
    setAuto,
    ...(ctx.fields ? { fields: ctx.fields } : {}),
  };

  const custom = ctx.renderers?.[pref.kind];
  const control = custom ? custom(renderCtx) : renderBuiltin(renderCtx);
  if (custom && control === null) return null;

  // `block` leaves own their chrome (embedded editors with their own
  // header) — no label/tooltip row.
  if (pref.block) return <>{control}</>;

  return (
    <PropertyRow
      label={pref.name}
      description={pref.description}
      layout="inline"
      className={s.row}
      // The owner passes an inherited leaf's value already resolved, so the
      // control keeps drawing it; editing it pins, through `onChange`.
      auto={inherited}
      autoControl="dimmed"
      onAutoChange={toggles ? setAuto : undefined}
      hint={inherited ? ctx.inheritHint?.(path) : undefined}
    >
      <span className={s.rowControl}>{control}</span>
    </PropertyRow>
  );
}

function renderBuiltin(
  ctx: PrefRenderContext,
  // The object a nested leaf is a field of — what an enum `encoding` and a
  // font's weight and slant read against. Undefined for a top-level leaf.
  siblings?: Record<string, unknown>,
): ReactNode {
  const { pref, value, setValue } = ctx;
  if (pref.kind === 'object') return <ObjectLeaf ctx={ctx} />;
  const field = prefFieldProps(pref, { value, siblings, setValue, fields: ctx.fields });
  if (field === null) {
    // App-defined kind with no `renderers` entry: labeled placeholder, not a
    // crash — a missing wiring should be visible and recoverable.
    return <span className={s.unrenderable}>({pref.kind}: no renderer)</span>;
  }
  switch (field.kind) {
    // A form stores what was settled on: a number once it is entered, a color
    // once its gesture ends.
    case 'number':
      return (
        <PropertyControl
          {...field}
          name={pref.name}
          onInput={settledOnly}
          steppers={field.accepts === undefined}
        />
      );
    case 'color':
      return <PropertyControl {...field} name={pref.name} onInput={settledOnly} />;
    default:
      return <PropertyControl {...field} name={pref.name} />;
  }
}

const settledOnly = (): void => {};

/** One value with its fields hanging off it: each field renders its own
 *  control and commits the parent object whole. */
function ObjectLeaf({ ctx }: { ctx: PrefRenderContext }) {
  const pref = ctx.pref as PrefObject;
  const { value, setValue } = ctx;
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
        <PropertyRow
          key={key}
          label={child.name}
          layout="inline"
              className={s.objectRow}
        >
          <span className={s.rowControl}>
            {renderBuiltin({
              path: `${ctx.path}.${key}`,
              pref: child,
              value: held?.[key],
              setValue: (v) => {
                const base = held ?? pref.fromScalar?.(value) ?? {};
                setValue({ ...base, [key]: v });
              },
              // A field is not pinned on its own — it shares the state of
              // the object leaf it hangs off.
              auto: ctx.auto,
              setAuto: ctx.setAuto,
            }, held)}
          </span>
        </PropertyRow>,
      );
    }
    return out;
  };
  return <div className={s.objectLeaf}>{objectRows(pref.children)}</div>;
}
