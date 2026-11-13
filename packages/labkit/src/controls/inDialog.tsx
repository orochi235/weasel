import { isPlainObject } from '@weasel-js/core';
import {
  type PrefLeaf,
  type PrefList,
  type PrefMap,
  type PrefNumber,
  type PrefObject,
  type PrefUnion,
  prefSectionLeaves,
  prefVariantOf,
  resolvePrefUnit,
} from '@weasel-js/prefs';
import { qty, withUnit } from '@weasel-js/quantity';
import { prefFieldProps } from '@weasel-js/ui/components/Prefs';
import { stepDisplay } from '@weasel-js/ui/components/Properties';
import { leafCanAuto } from '../config/autoConfig';
import type { ControlRenderer, InDialogOptions } from '../config/types';
import { DraftDialogRow } from './DraftDialogRow';
import { extra } from './fields';

export type { InDialogOptions };

const written = (entry: unknown): unknown =>
  entry !== null && typeof entry === 'object' ? JSON.stringify(entry) : entry;

/** A value as one line, knowing nothing of the leaf it belongs to. */
export function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.map(written).join(', ');
  if (value === undefined || value === null || value === '') return 'None';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** `value` as `leaf`'s field writes it — through its `display` or its unit, after its `suffix`, and infinity as
 *  the word its `endless` end gives it — or `undefined` where the leaf says nothing of how it shows. */
export function numberText(leaf: PrefNumber, value: number): string | undefined {
  const suffix = extra<string>(leaf, 'suffix');
  if (
    suffix === undefined &&
    leaf.display === undefined &&
    leaf.infinity === undefined &&
    Number.isFinite(value)
  )
    return leaf.unit === undefined ? undefined : resolvePrefUnit(leaf.unit).format(value);
  const field = prefFieldProps(leaf, { value, setValue: () => {} });
  if (field?.kind !== 'number' || typeof field.value !== 'number') return undefined;
  const text = qty(field.value, field.display ?? stepDisplay(field.step)).text;
  // `labField` draws a `suffix` over the unit's, so the text does too.
  const unit = suffix ?? field.unit;
  return Number.isFinite(value) && typeof unit === 'string' ? withUnit(text, unit) : text;
}

/** The fields that describe `value`: an object's own, or the variant's of a union. */
function objectOf(leaf: PrefLeaf, value: Record<string, unknown>): PrefObject | undefined {
  if (leaf.kind === 'union') return prefVariantOf(leaf as PrefUnion, value)?.[1];
  return leaf.kind === 'object' ? (leaf as PrefObject) : undefined;
}

/** An object or union value as one entry of a list or a map: the schema's own summary, else its first non-empty
 *  string field, else a union's tag. `undefined` where none of those says anything. */
function entryText(leaf: PrefLeaf, value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  const own = extra<(v: unknown) => string>(leaf, 'summary');
  if (own) return own(value);
  const object = objectOf(leaf, value);
  for (const [key] of object ? prefSectionLeaves(object.children) : []) {
    const field = value[key];
    if (typeof field === 'string' && field !== '') return field;
  }
  if (leaf.kind !== 'union') return undefined;
  const tag = value[(leaf as PrefUnion).tag];
  return typeof tag === 'string' ? tag : undefined;
}

/** One entry of a list or a map, as its summary shows it. */
const shownEntry = (item: PrefLeaf, entry: unknown): unknown =>
  entryText(item, entry) ?? shownValue(item, entry);

/** `value` with each number that has a unit as its field writes it, at any depth of a compound leaf. */
function shownValue(leaf: PrefLeaf, value: unknown): unknown {
  if (leaf.kind === 'number')
    return typeof value === 'number' ? (numberText(leaf as PrefNumber, value) ?? value) : value;
  if (leaf.kind === 'list') {
    const { item } = leaf as PrefList;
    return Array.isArray(value) ? value.map((entry) => shownEntry(item, entry)) : value;
  }
  if (!isPlainObject(value)) return value;
  if (leaf.kind === 'map') {
    const { item } = leaf as PrefMap;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shownEntry(item, v)]));
  }
  const object = objectOf(leaf, value);
  if (!object) return value;
  const fields = new Map(prefSectionLeaves(object.children));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => {
      const field = fields.get(k);
      return [k, field ? shownValue(field, v) : v];
    }),
  );
}

/** The one-line summary a dialog row shows of `leaf`'s value when it is given none. */
export function summarizeLeaf(leaf: PrefLeaf, value: unknown): string {
  return summarizeValue(shownValue(leaf, value));
}

/**
 * Moves a control into a modal: the row becomes a button showing a summary of
 * the value, and the button opens a dialog whose body is `body`, handed the
 * same context a row renderer gets. For a leaf whose editor will never fit a
 * sidebar row. The body edits a draft, which Done writes — through
 * `opts.commit` when given — and Cancel or Escape drops. The body writes each
 * edit into the draft as it is made: a write after the dialog closes, such as
 * one from an unmount cleanup, is dropped.
 */
export function inDialog(body: ControlRenderer, opts: InDialogOptions = {}): ControlRenderer {
  return (ctx) => {
    const { pref, value, auto, setAuto } = ctx;
    const summary = opts.summary ?? ((v: unknown) => summarizeLeaf(pref, v));
    const pinned = !leafCanAuto(pref);
    return (
      <DraftDialogRow
        label={pref.name}
        description={pref.description}
        summary={summary(value)}
        title={opts.title}
        readout={auto ? 'auto' : undefined}
        auto={auto}
        onAutoChange={pinned ? undefined : setAuto}
        changed={ctx.changed}
        value={value}
        setValue={ctx.setValue}
        commit={opts.commit}
        error={ctx.error}
      >
        {(draft, setDraft) => body({ ...ctx, value: draft, setValue: setDraft })}
      </DraftDialogRow>
    );
  };
}
