import type { ReactNode } from 'react';
import { prefAsBox, prefObjectWithField, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import type { LeafSurface } from '../Bar/renderBarLeaf';
import { MotifFrame } from '../MotifFrame';
import { PropertyRow } from '../Properties/PropertyRow';
import { rowWidthOf, type RowWidth } from './compound';
import { FORM_FRAMES } from './frames';
import { HiddenBadge, hiddenAttrs } from './hidden';
import { leafAtValues } from './leafAtValues';
import { objectRows, type ObjectLeafParts } from './objectRows';
import { offTitle } from './offTitle';
import type { PrefRenderContext } from './PrefsRow';
import s from './Prefs.module.css';

/**
 * One value with its fields hanging off it: each field renders its own control and commits the parent object
 * whole. Where the form's `mixed` names the object or anything under it, no one object stands for every value
 * behind it, and a field is written at its own path.
 */
export function ObjectLeaf({
  ctx,
  renderField,
  isGroup,
  rowWidth = rowWidthOf,
}: {
  ctx: PrefRenderContext;
  /** Draws one field, for a row or for a bar. `siblings` is the object it is a field of. */
  renderField: (ctx: PrefRenderContext, siblings: Record<string, unknown> | undefined, surface?: LeafSurface) => ReactNode;
  /** Whether a field's row is a group and not a `<label>`. */
  isGroup: (ctx: PrefRenderContext, siblings: Record<string, unknown> | undefined) => boolean;
  /** The room a field's control needs. Default: by its kind alone. */
  rowWidth?: (leaf: PrefLeaf) => RowWidth;
}) {
  const pref = ctx.pref as PrefObject;
  const { value, setValue } = ctx;
  const held = typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
  const { mixedAt, setValueAt } = ctx;
  const split = setValueAt !== undefined && (ctx.mixed === true || mixedAt?.(ctx.path, true) === true);
  const fieldCtx = (key: string, child: PrefLeaf): PrefRenderContext => {
    const path = `${ctx.path}.${key}`;
    const mixed = ctx.mixed === true || mixedAt?.(path) === true;
    return {
      path,
      pref: leafAtValues(child, ctx.values),
      value: mixed ? undefined : held?.[key],
      mixed,
      setValue: split ? (v) => setValueAt(path, v) : (v) => setValue(prefObjectWithField(pref, value, key, v)),
      mixedAt,
      setValueAt,
      // A field is not pinned on its own — it shares the state of
      // the object leaf it hangs off.
      auto: ctx.auto,
      setAuto: ctx.setAuto,
      values: ctx.values,
      ...(ctx.fields ? { fields: ctx.fields } : {}),
      // The walk names every field of a disabled leaf but the one its own `enableIf` reads, which stays live.
      disabled: ctx.disabledAt ? ctx.disabledAt(path) : ctx.disabled === true,
      disabledAt: ctx.disabledAt,
      hidden: ctx.hidden === true || ctx.hiddenAt?.(path) === true,
      hiddenAt: ctx.hiddenAt,
      entryAt: ctx.entryAt,
      settles: ctx.settles,
    };
  };
  const off = (path: string): boolean => (ctx.disabledAt ? ctx.disabledAt(path) : ctx.disabled === true);
  const parts: ObjectLeafParts<{ key: string; child: PrefLeaf; field: PrefRenderContext }> = {
    path: ctx.path,
    off,
    cell: (key, child) => ({ key, child, field: fieldCtx(key, child) }),
    rows: (cells) => cells.map(({ key, child, field }) => {
      const width = rowWidth(child);
      const stacked = width !== 'column';
      // The leaf's own mark covers its fields; a field hidden on its own carries one.
      const marked = field.hidden === true && ctx.hidden !== true;
      const row = (
        <PropertyRow
          key={key}
          label={child.name}
          description={child.description}
          layout={stacked ? 'block' : 'inline'}
          group={isGroup(field, held)}
          disabled={field.disabled}
          hint={marked ? <HiddenBadge /> : undefined}
          className={stacked ? undefined : s.objectRow}
        >
          <span className={width === 'filled' ? `${s.rowControl} ${s.rowControlFilled}` : s.rowControl}>
            {renderField(field, held)}
          </span>
        </PropertyRow>
      );
      return marked ? <div key={key} {...hiddenAttrs(true)}>{row}</div> : row;
    }),
    barCells: (cells) => cells.flatMap(({ key, field }) => {
      const content = renderField(field, held, 'bar');
      return content == null ? [] : [{ kind: 'cell' as const, path: `${ctx.path}.${key}`, content }];
    }),
    lead: (key, section) => (section.description ? [<p key={`desc:${key}`} className={s.paneDesc}>{section.description}</p>] : []),
    frame: (key, section, inner, { labeled, path }) => {
      if (section.as === 'fragment') return inner;
      if (prefAsBox(section.as)) {
        return [
          <MotifFrame
            key={`panel:${key}`}
            fallback={FORM_FRAMES.labeled}
            title={labeled ? section.name : undefined}
            note={section.description}
            level={4}
            className={`${s.panePanel} ${s.objectPanel}`}
            disabled={off(path)}
          >
            {inner}
          </MotifFrame>,
        ];
      }
      const heading = labeled ? [<h4 key={`group:${key}`} className={s.objectGroup}>{offTitle(section.name, off(path))}</h4>] : [];
      return [...heading, ...parts.lead!(key, section), ...inner];
    },
  };
  return <div className={s.objectLeaf}>{objectRows(pref.children, parts)}</div>;
}
