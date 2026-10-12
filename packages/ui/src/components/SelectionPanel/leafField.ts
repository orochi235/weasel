import { withCommitPolicy } from '../Prefs/commitPolicy';
import { prefFieldProps, type PrefFieldState } from '../Prefs/prefField';
import type { PropertyControlProps } from '../Properties/PropertyField';
import type { PropertyRenderContext } from './renderContext';

/**
 * A leaf as one control's props, writing the way a selection surface commits:
 * what is the same whether the control then sits in a row or in a bar. Null
 * for a leaf that is not one control.
 */
export function leafField(ctx: PropertyRenderContext, nested: boolean): PropertyControlProps | null {
  const field = prefFieldProps(ctx.pref, {
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
  });
  // A nested paint writes one field of its parent, and no kit paint field is
  // optional — `Stroke.paint` is required. Removing the whole parent is a
  // different edit than repainting it, so the control must not offer one as
  // the other.
  if (field?.kind === 'paint') return { ...field, allowNone: !nested };
  return field && withCommitPolicy(field, 'panel');
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
