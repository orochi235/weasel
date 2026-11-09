import type { MenuEntry } from '@weasel-js/menu';
import {
  prefDisplayBounds, prefNumberAt, prefUnitAccepts, resolvePrefUnit,
  type PrefBoolean, type PrefColor, type PrefEnum, type PrefNumber, type PrefString,
} from '@weasel-js/prefs';
import { endlessAllows } from '@weasel-js/quantity';
import { sep } from './separators';

/** Where a value row reads and writes; a row is left out without what it needs. */
export interface RowAccess {
  values?(path: string): unknown;
  onChange?(path: string, value: unknown): void;
}

const noop = () => {};
const withAccess = (access?: string): { access?: string } => (access ? { access } : {});

function siblingsOf(src: RowAccess, path: string): Record<string, unknown> | undefined {
  const dot = path.lastIndexOf('.');
  const parent = dot < 0 ? undefined : src.values!(path.slice(0, dot));
  return parent && typeof parent === 'object' ? parent as Record<string, unknown> : undefined;
}

export function booleanRows(src: RowAccess, leaf: PrefBoolean, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = src;
  if (!values || !onChange) return [];
  const stored = values(path);
  const on = leaf.encoding ? leaf.encoding.read(stored, siblingsOf(src, path)) : stored === true;
  const write = (v: boolean) => (leaf.encoding ? leaf.encoding.write(v, siblingsOf(src, path)) : v);
  return [{
    kind: 'item', key, label: leaf.name, ...withAccess(leaf.access), checked: on,
    disabled: off || leaf.readout === true,
    run: leaf.readout ? noop : () => onChange(path, write(!on)),
  }];
}

/** What an enum option's row says besides its label: its glyph, what it does, and why it is disabled. */
const optionNotes = ({ icon, description, disabled, disabledReason }: PrefEnum['options'][number]) =>
  ({ ...(icon ? { icon } : {}), ...(description ? { description } : {}), ...(disabled && disabledReason ? { disabledReason } : {}) });

export function enumRows(src: RowAccess, leaf: PrefEnum, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = src;
  if (!values || !onChange) return [];
  const stored = values(path);
  const current = leaf.encoding ? leaf.encoding.read(stored, siblingsOf(src, path)) : stored;
  if (leaf.readout) {
    const shown = leaf.options.find((o) => o.value === current)?.label ?? '—';
    return [{ kind: 'item', key, label: `${leaf.name}: ${shown}`, disabled: true, run: noop }];
  }
  const write = (v: string) => (leaf.encoding ? leaf.encoding.write(v, siblingsOf(src, path)) : v);
  return [
    sep(`${key}/<`),
    ...leaf.options.map((o): MenuEntry => ({
      kind: 'item', key: `${key}/${o.value}`, label: o.label, checked: o.value === current, radio: true, ...optionNotes(o),
      disabled: off || o.disabled === true, run: () => onChange(path, write(o.value)),
    })),
    sep(`${key}/>`),
  ];
}

/** A number row, in the units the leaf shows: its value, bounds, and step convert from the stored unit, and
 *  what is set converts back. An infinity is a value only where an `endless` end stands for it. */
export function numberRows(src: RowAccess, given: PrefNumber, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = src;
  if (!values || !onChange) return [];
  const leaf = prefNumberAt(given, values);
  const unit = leaf.unit && resolvePrefUnit(leaf.unit);
  const stored = values(path);
  const { min, max, step, endless } = prefDisplayBounds(leaf);
  const disabled = off || leaf.readout === true;
  const display = leaf.display ?? unit?.display;
  return [{
    kind: 'number', key, label: leaf.name, ...withAccess(leaf.access),
    ...(leaf.icon ? { icon: leaf.icon } : {}),
    ...(disabled ? { disabled } : {}),
    value: typeof stored === 'number' && (Number.isFinite(stored) || endlessAllows(leaf.endless, stored))
      ? (unit ? unit.toDisplay(stored) : stored)
      : undefined,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    step,
    ...(unit?.suffix === undefined ? {} : { suffix: unit.suffix }),
    ...(display ? { display } : {}),
    ...(endless ? { endless } : {}),
    ...(leaf.infinity === undefined ? {} : { infinity: leaf.infinity }),
    ...(unit ? { accepts: prefUnitAccepts(unit) } : {}),
    set: (shown) => onChange(path, unit ? unit.fromDisplay(shown) : shown),
  }];
}

const textAt = (src: RowAccess, path: string): string | undefined => {
  const v = src.values?.(path);
  return typeof v === 'string' && v !== '' ? v : undefined;
};

/** A color row, which writes the color unless the leaf is a readout or nothing writes it. */
export function colorRows(src: RowAccess, leaf: PrefColor, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = src;
  if (!values) return [];
  return [{
    kind: 'color', key, label: leaf.name, ...withAccess(leaf.access),
    ...(off ? { disabled: true } : {}),
    value: textAt(src, path),
    ...(leaf.alpha ? { alpha: true } : {}),
    ...(leaf.readout || !onChange ? {} : { set: (color: string) => onChange(path, color) }),
  }];
}

/** A string row is edited in place; a readout, or one nothing writes, reads as its name and value, as an enum readout does. */
export function stringRows(src: RowAccess, leaf: PrefString, key: string, path: string, off: boolean): MenuEntry[] {
  const { values, onChange } = src;
  if (!values) return [];
  if (leaf.readout || !onChange) {
    return [{ kind: 'item', key, label: `${leaf.name}: ${textAt(src, path) ?? '—'}`, ...withAccess(leaf.access), disabled: true, run: noop }];
  }
  const stored = values(path);
  return [{
    kind: 'text', key, label: leaf.name, ...withAccess(leaf.access),
    ...(leaf.icon ? { icon: leaf.icon } : {}),
    ...(off ? { disabled: true } : {}),
    value: typeof stored === 'string' ? stored : undefined,
    set: (text) => onChange(path, text),
  }];
}
