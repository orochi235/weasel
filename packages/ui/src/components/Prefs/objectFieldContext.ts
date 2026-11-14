import { prefObjectBase, prefObjectField, prefObjectWithField, sharedReading, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import type { LeafContext } from '../PrefsSource/types';
import { leafAtValues } from './leafAtValues';

const asObject = (v: unknown): Record<string, unknown> | undefined =>
  (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined);

/**
 * The context of the field `key` of the object leaf `ctx` draws, on any params surface. A field reads as the
 * surface reads a leaf (`shown`): a form shows an absent field's default, a selection panel shows it unset unless
 * the field is `absentIsDefault`. Targets whose objects differ still agree or disagree field by field. An edit
 * derives each target's own object with this one field changed, so a multi-target edit never writes one
 * target's object over the others; where the targets are one values map that cannot tell them apart (a form's
 * `mixed`), the field is written at its own path.
 */
export function objectFieldContext(
  ctx: LeafContext,
  key: string,
  child: PrefLeaf,
  shown: (leaf: PrefLeaf, held: unknown) => unknown,
): LeafContext {
  const pref = ctx.pref as PrefObject;
  const path = `${ctx.path}.${key}`;
  const held = asObject(ctx.value);
  const eachObject = ctx.each.map(asObject);
  // A field of an object the target does not hold has nothing behind it, whatever the field says absence means.
  const fieldOf = (o: Record<string, unknown> | undefined): unknown => (o === undefined ? undefined : shown(child, prefObjectField(o, key)));
  const each = eachObject.map(fieldOf);
  // A values map standing for several holds no one object: what it marks mixed is all it says.
  const shared = ctx.mixedAt?.(path) === true || (ctx.mixed === true && each.length === 0)
    ? { mixed: true, value: undefined }
    : ctx.mixed === true ? sharedReading(each) : { mixed: false, value: fieldOf(held) };
  const { value } = shared;
  const split = ctx.mixed === true || ctx.mixedAt?.(ctx.path, true) === true;
  const { setValueAt } = ctx;
  type Update = LeafContext['update'];
  const through = (parent: Update): Update => (fn) =>
    parent((prev) => {
      const base = prefObjectBase(pref, prev);
      return prefObjectWithField(pref, base, key, fn(fieldOf(base), base));
    });
  const atOwnPath = split ? setValueAt : undefined;
  const update: Update = atOwnPath ? (fn) => atOwnPath(path, fn(value, held)) : through(ctx.update);
  const draft = !atOwnPath && ctx.drafts ? through(ctx.drafts.update) : undefined;
  return {
    path,
    pref: ctx.values === undefined ? child : leafAtValues(child, ctx.values),
    source: ctx.source,
    value,
    mixed: shared.mixed,
    unset: !shared.mixed && value === undefined,
    each,
    siblings: held,
    eachSiblings: eachObject,
    update,
    setValue: (v) => update(() => v),
    ...(draft ? { drafts: { update: draft, setValue: (v: unknown) => draft(() => v) } } : {}),
    mixedAt: ctx.mixedAt,
    setValueAt,
    // A field is not pinned on its own: it shares the state of the object leaf it hangs off.
    ...(ctx.auto !== undefined ? { auto: ctx.auto } : {}),
    setAuto: ctx.setAuto,
    values: ctx.values,
    ...(ctx.fields ? { fields: ctx.fields } : {}),
    ...(ctx.selectionKey !== undefined ? { selectionKey: ctx.selectionKey } : {}),
    // The walk names every field of a disabled leaf but the one its own `enableIf` reads, which stays live.
    disabled: ctx.disabledAt ? ctx.disabledAt(path) : ctx.disabled === true,
    disabledAt: ctx.disabledAt,
    active: ctx.activeAt?.(path) === true,
    activeAt: ctx.activeAt,
    hidden: ctx.hidden === true || ctx.hiddenAt?.(path) === true,
    hiddenAt: ctx.hiddenAt,
    entryAt: ctx.entryAt,
    settles: ctx.settles,
    textWaitMs: ctx.textWaitMs,
    // Inherit replaces the whole fill or stroke, and the paint is where it is offered.
    ...(key === 'paint' && ctx.inherit ? { inherit: ctx.inherit } : {}),
  };
}
