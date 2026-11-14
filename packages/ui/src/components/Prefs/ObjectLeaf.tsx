import type { ReactNode } from 'react';
import { prefAsBox, prefLeafValue, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import type { ControlForm } from '../ActionButton/controlForm';
import { MotifFrame } from '../MotifFrame';
import { PropertyRow } from '../Properties/PropertyRow';
import { rowWidthOf, type RowWidth } from './compound';
import { FORM_FRAMES } from './frames';
import { HiddenBadge, hiddenAttrs } from './hidden';
import { objectFieldContext } from './objectFieldContext';
import { objectRows, type ObjectLeafParts } from './objectRows';
import { offTitle } from './offTitle';
import type { LeafContext } from './PrefsRow';
import s from './Prefs.module.css';

/**
 * One value with its fields hanging off it: each field renders its own control through
 * {@link objectFieldContext}, a field holding nothing showing its default as any form leaf does.
 */
export function ObjectLeaf({
  ctx,
  renderField,
  isGroup,
  rowWidth = rowWidthOf,
}: {
  ctx: LeafContext;
  /** Draws one field, for a row or for a bar. `siblings` is the object it is a field of. */
  renderField: (ctx: LeafContext, siblings: Record<string, unknown> | undefined, surface?: ControlForm) => ReactNode;
  /** Whether a field's row is a group and not a `<label>`. */
  isGroup: (ctx: LeafContext, siblings: Record<string, unknown> | undefined) => boolean;
  /** The room a field's control needs. Default: by its kind alone. */
  rowWidth?: (leaf: PrefLeaf) => RowWidth;
}) {
  const pref = ctx.pref as PrefObject;
  const held = typeof ctx.value === 'object' && ctx.value !== null
    ? (ctx.value as Record<string, unknown>)
    : undefined;
  const off = (path: string): boolean => (ctx.disabledAt ? ctx.disabledAt(path) : ctx.disabled === true);
  const parts: ObjectLeafParts<{ key: string; child: PrefLeaf; field: LeafContext }> = {
    path: ctx.path,
    off,
    cell: (key, child) => ({ key, child, field: objectFieldContext(ctx, key, child, prefLeafValue) }),
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
          disabledReason={child.disabledReason}
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
            motif={section.motif}
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
