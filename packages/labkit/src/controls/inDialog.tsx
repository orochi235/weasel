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
import type { ControlRenderer, InDialogOptions } from '../config/types';
import { DraftDialogRow } from './DraftDialogRow';

export type { InDialogOptions };

const written = (entry: unknown): unknown =>
  entry !== null && typeof entry === 'object' ? JSON.stringify(entry) : entry;

/** A value as one line, knowing nothing of the leaf it belongs to. */
export function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.map(written).join(', ');
  if (value === undefined || value === null || value === '') return 'None';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** `value` with each number that has a unit as its field writes it, at any depth of a compound leaf. */
function shownValue(leaf: PrefLeaf, value: unknown): unknown {
  if (leaf.kind === 'number') {
    const { unit } = leaf as PrefNumber;
    return unit !== undefined && typeof value === 'number'
      ? resolvePrefUnit(unit).format(value)
      : value;
  }
  if (leaf.kind === 'list') {
    const { item } = leaf as PrefList;
    return Array.isArray(value) ? value.map((entry) => shownValue(item, entry)) : value;
  }
  if (!isPlainObject(value)) return value;
  if (leaf.kind === 'map') {
    const { item } = leaf as PrefMap;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shownValue(item, v)]));
  }
  const object =
    leaf.kind === 'union'
      ? prefVariantOf(leaf as PrefUnion, value)?.[1]
      : leaf.kind === 'object'
        ? (leaf as PrefObject)
        : undefined;
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
 * sidebar row. The body edits a draft, which Done writes and Cancel or Escape
 * drops.
 */
export function inDialog(body: ControlRenderer, opts: InDialogOptions = {}): ControlRenderer {
  return (ctx) => {
    const { pref, value, auto, setAuto } = ctx;
    const summary = opts.summary ?? ((v: unknown) => summarizeLeaf(pref, v));
    const manual = (pref as { manual?: boolean }).manual === true;
    return (
      <DraftDialogRow
        label={pref.name}
        description={pref.description}
        summary={summary(value)}
        title={opts.title}
        readout={auto ? 'auto' : undefined}
        auto={auto}
        onAutoChange={manual ? undefined : setAuto}
        value={value}
        setValue={ctx.setValue}
        error={ctx.error}
      >
        {(draft, setDraft) => body({ ...ctx, value: draft, setValue: setDraft })}
      </DraftDialogRow>
    );
  };
}
