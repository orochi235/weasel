import type { ReactNode } from 'react';
import { prefObjectWithField, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import type { LeafSurface } from '../Bar/renderBarLeaf';
import { PropertyRow } from '../Properties/PropertyPanel';
import { drawsRows } from './compound';
import { objectRows, type ObjectLeafParts } from './objectRows';
import type { PrefRenderContext } from './PrefsRow';
import s from './Prefs.module.css';

/** One value with its fields hanging off it: each field renders its own
 *  control and commits the parent object whole. */
export function ObjectLeaf({
  ctx,
  renderField,
  isGroup,
}: {
  ctx: PrefRenderContext;
  /** Draws one field, for a row or for a bar. `siblings` is the object it is a field of. */
  renderField: (ctx: PrefRenderContext, siblings: Record<string, unknown> | undefined, surface?: LeafSurface) => ReactNode;
  /** Whether a field's row is a group and not a `<label>`. */
  isGroup: (ctx: PrefRenderContext, siblings: Record<string, unknown> | undefined) => boolean;
}) {
  const pref = ctx.pref as PrefObject;
  const { value, setValue } = ctx;
  const held = typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
  const fieldCtx = (key: string, child: PrefLeaf): PrefRenderContext => ({
    path: `${ctx.path}.${key}`,
    pref: child,
    value: held?.[key],
    setValue: (v) => setValue(prefObjectWithField(pref, value, key, v)),
    // A field is not pinned on its own — it shares the state of
    // the object leaf it hangs off.
    auto: ctx.auto,
    setAuto: ctx.setAuto,
    ...(ctx.fields ? { fields: ctx.fields } : {}),
  });
  const parts: ObjectLeafParts<{ key: string; child: PrefLeaf; field: PrefRenderContext }> = {
    path: ctx.path,
    cell: (key, child) => ({ key, child, field: fieldCtx(key, child) }),
    rows: (cells) => cells.map(({ key, child, field }) => {
      const stacked = drawsRows(child);
      return (
        <PropertyRow
          key={key}
          label={child.name}
          description={child.description}
          layout={stacked ? 'block' : 'inline'}
          group={isGroup(field, held)}
          className={stacked ? undefined : s.objectRow}
        >
          <span className={s.rowControl}>
            {renderField(field, held)}
          </span>
        </PropertyRow>
      );
    }),
    barCells: (cells) => cells.flatMap(({ key, field }) => {
      const content = renderField(field, held, 'bar');
      return content == null ? [] : [{ kind: 'cell' as const, path: `${ctx.path}.${key}`, content }];
    }),
    lead: (key, section) => (section.description ? [<p key={`desc:${key}`} className={s.paneDesc}>{section.description}</p>] : []),
    frame: (key, section, inner, { labeled }) => {
      if (section.as === 'fragment') return inner;
      const note = parts.lead!(key, section);
      const heading = labeled ? [<h4 key={`group:${key}`} className={s.objectGroup}>{section.name}</h4>] : [];
      if (section.as === 'panel') return [<div key={`panel:${key}`} className={s.panePanel}>{heading}{note}{inner}</div>];
      return [...heading, ...note, ...inner];
    },
  };
  return <div className={s.objectLeaf}>{objectRows(pref.children, parts)}</div>;
}
