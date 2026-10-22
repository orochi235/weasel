import type { Paint } from '@weasel-js/core';
import { withDrafts } from '../Prefs/commitPolicy';
import { prefFieldProps, type PrefFieldState } from '../Prefs/prefField';
import type { PropertyControlProps } from '../Properties/PropertyField';
import type { PropertyPaintFieldProps } from '../Properties/fieldTypes';
import type { PropertyRenderContext } from './renderContext';

/**
 * A leaf as one control's props, writing the way a selection surface commits:
 * what is the same whether the control then sits in a row or in a bar. Null
 * for a leaf that is not one control.
 */
export function leafField(ctx: PropertyRenderContext, nested: boolean): PropertyControlProps | null {
  const state: PrefFieldState = {
    value: ctx.value,
    mixed: ctx.mixed,
    unset: ctx.unset,
    fields: ctx.fields,
    siblings: ctx.siblings,
    setValue: ctx.setValue,
    disabled: ctx.disabled,
    ...perNodeState(ctx),
    // The font pickers read the rest of the font from the leaves beside
    // them: the family's substitution probe runs at the weight and style
    // that will paint, and a weight lists what its family has. A mixed
    // selection has no single one; the probe falls back to 400/normal there.
    fontVariant: {
      weight: ctx.valueAt(siblingPath(ctx.path, 'fontWeight')).value,
      style: ctx.valueAt(siblingPath(ctx.path, 'fontStyle')).value,
    },
    fontFamily: ctx.valueAt(siblingPath(ctx.path, 'fontFamily')).value,
  };
  const { settles } = ctx;
  const settled = prefFieldProps(ctx.pref, state, 'panel', settles);
  const field = settled && ctx.drafts
    ? withDrafts(settled, prefFieldProps(ctx.pref, drafting(state, ctx.drafts), 'panel', settles), 'panel', settles)
    : settled;
  return field?.kind === 'paint' && nested ? nestedPaint(ctx, field) : field;
}

/** `state` writing through a context's drafts. */
function drafting(state: PrefFieldState, drafts: NonNullable<PropertyRenderContext['drafts']>): PrefFieldState {
  return { ...state, setValue: drafts.setValue, ...(state.update ? { update: drafts.update } : {}) };
}

/**
 * What a paint that is a field of an object shows, as a `Fill` or `Stroke`
 * holds one: the paint, `null` for None, or `undefined` when mixed. Absent,
 * from the object or with no object at all, it is None, never unset.
 */
export function nestedPaintValue(ctx: Pick<PropertyRenderContext, 'value' | 'mixed'>): Paint | null | undefined {
  if (ctx.mixed) return undefined;
  return ctx.value === undefined || ctx.value === null ? null : ctx.value as Paint;
}

/** {@link nestedPaintValue} as a control: None removes the field. */
function nestedPaint(ctx: PropertyRenderContext, field: PropertyPaintFieldProps): PropertyPaintFieldProps {
  return {
    ...field,
    value: nestedPaintValue(ctx),
    unset: false,
    onChange: (paint) => ctx.setValue(paint ?? undefined),
  };
}

/** The dotted path of the leaf `key` beside the one at `path`. */
function siblingPath(path: string, key: string): string {
  const dot = path.lastIndexOf('.');
  return dot < 0 ? key : `${path.slice(0, dot + 1)}${key}`;
}

/** What an `encoding` needs to read and write each node against its own
 *  object — nothing for a leaf that is not a field of one. */
export function perNodeState(ctx: PropertyRenderContext): Pick<PrefFieldState, 'perNode' | 'update'> {
  if (ctx.eachSiblings === undefined) return {};
  const siblings = ctx.eachSiblings;
  return {
    perNode: ctx.each.map((value, i) => ({ value, siblings: siblings[i] })),
    update: ctx.update,
  };
}
