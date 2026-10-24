/**
 * One field of an object leaf as an unrendered cell: the context its control
 * reads and writes through, and the control drawn for a row or for a bar.
 */
import type { ReactNode } from 'react';
import { prefObjectBase, prefObjectWithField, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import { resolveIcon } from '../../icons/resolveIcon';
import { MIXED, nodeLeafValue, sharedValue } from './model';
import type { LeafCell } from './cells';
import type { PropertyRenderContext, PropertyRenderer } from './renderContext';
import { renderBuiltin } from './renderLeaf';
import s from './SelectionPanel.module.css';

/** The object leaf a field belongs to, as its fields read it. */
export interface ObjectFieldOwner {
  /** The object leaf's own context. */
  ctx: PropertyRenderContext;
  /** The object the selection shares, when it shares one. */
  held: Record<string, unknown> | undefined;
  /** Each node's object, in selection order. */
  eachObject: readonly (Record<string, unknown> | undefined)[];
  /** The paired row of each field that shares one, by the field's full path. */
  pairs: ReadonlyMap<string, { key: string; label: string }>;
  renderers?: Record<string, PropertyRenderer>;
  selectionKey: string;
}

/** The context of the field `key` of `owner`: its value across the nodes, and an edit that commits the parent object. */
function fieldContext({ ctx, held, eachObject }: Pick<ObjectFieldOwner, 'ctx' | 'held' | 'eachObject'>, key: string, child: PrefLeaf): PropertyRenderContext {
  const pref = ctx.pref as PrefObject;
  const childPath = `${ctx.path}.${key}`;
  // Nodes whose objects differ still agree or disagree field by field: two
  // styles at different sizes are both upright, and saying "mixed" for
  // every field of them hides that.
  // A field the object omits reads as the child says absence does. One of an object the node does not hold
  // has nothing behind it, whatever the child says.
  const fieldOf = (o: Record<string, unknown> | undefined): unknown => (o === undefined ? undefined : nodeLeafValue(child, o[key]));
  const each = eachObject.map(fieldOf);
  const shared = ctx.mixed ? sharedValue(each) : fieldOf(held);
  const field = shared === MIXED ? { value: undefined, mixed: true } : { value: shared, mixed: false };
  // Each node's own object, with this one field changed. Deriving it per
  // node is what keeps a multi-selection edit from writing one node's
  // object over all the others.
  type Update = PropertyRenderContext['update'];
  const through = (parent: Update): Update => (fn) =>
    parent((prev) => {
      const base = prefObjectBase(pref, prev);
      return prefObjectWithField(pref, base, key, fn(fieldOf(base), base));
    });
  const update = through(ctx.update);
  const draft = ctx.drafts && through(ctx.drafts.update);
  return {
    path: childPath,
    ...(ctx.fields ? { fields: ctx.fields } : {}),
    pref: child,
    value: field.mixed ? undefined : field.value,
    mixed: field.mixed,
    unset: !field.mixed && field.value === undefined,
    siblings: held,
    each,
    eachSiblings: eachObject,
    valueAt: ctx.valueAt,
    selectionKey: ctx.selectionKey,
    update,
    setValue: (v) => update(() => v),
    ...(draft ? { drafts: { update: draft, setValue: (v: unknown) => draft(() => v) } } : {}),
    // The walk names every field of a disabled leaf but the one its own `enableIf` reads, which stays live.
    disabled: ctx.disabledAt ? ctx.disabledAt(childPath) : ctx.disabled === true,
    disabledAt: ctx.disabledAt,
    hidden: ctx.hidden === true || ctx.hiddenAt?.(childPath) === true,
    hiddenAt: ctx.hiddenAt,
    entryAt: ctx.entryAt,
    settles: ctx.settles,
    // Inherit replaces the whole fill or stroke, and the paint is where it is offered.
    ...(key === 'paint' && ctx.inherit ? { inherit: ctx.inherit } : {}),
  };
}

/** The control of one field: its bar form, or its row form with the glyph that names it where no label does. */
function renderField(
  { renderers, selectionKey, pairs }: Pick<ObjectFieldOwner, 'renderers' | 'selectionKey' | 'pairs'>,
  child: PrefLeaf,
  childCtx: PropertyRenderContext,
  surface: LeafSurface,
): ReactNode {
  const custom = renderers?.[childCtx.path] ?? renderers?.[child.kind];
  if (surface === 'bar') {
    return custom
      ? withBarLabel(child, custom(childCtx))
      : renderBuiltin(childCtx, child.name, renderers, { selectionKey, nested: true, surface });
  }
  const rendered = custom
    ? custom(childCtx)
    : renderBuiltin(childCtx, child.name, renderers, { selectionKey, nested: true });
  if (rendered == null) return null;
  // Neither a paired row nor a block one gives a field its own label
  // column, so the glyph is all that names it on screen. The control
  // already carries `name` as its accessible name, which leaves the
  // glyph decorative.
  const unlabeled = pairs.has(childCtx.path) || child.block === true;
  const glyph = unlabeled ? resolveIcon(child.icon) : undefined;
  if (!glyph) return rendered;
  return (
    <span className={s.namedField}>
      {glyph}
      {rendered}
    </span>
  );
}

/** One field as an unrendered cell: its row form, or its bar form in a section drawn as a bar. */
export function objectFieldCell(owner: ObjectFieldOwner, key: string, child: PrefLeaf, surface: LeafSurface): LeafCell {
  const childCtx = fieldContext(owner, key, child);
  const pair = owner.pairs.get(childCtx.path);
  return {
    key: childCtx.path,
    leaf: child,
    ctx: childCtx,
    ariaLabel: child.name,
    ...(pair ? { pair } : {}),
    render: () => renderField(owner, child, childCtx, surface),
  };
}
