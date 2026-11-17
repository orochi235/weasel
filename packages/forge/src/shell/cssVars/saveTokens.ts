import { isPlainObject } from '@weasel-js/core';
import { type AxisDefs, isByAxis, type AxisChoice, type ThemeDefinition } from '@weasel-js/theme';
import { axisDependencies } from '@weasel-js/theme/engine';
import { getOwn, setOwn } from '@weasel-js/registry';
import { EditError, type Holder, ownAt, type ScaleEditResult, type Slot } from './saveScales';

const REFERENCE = /\{[^}]+\}/;
/** The layers a token's value can be written out in, in the order the definition resolves a name. */
const LAYERS = ['pins', 'semantics', 'components'] as const;

/** Whether `entry` is something the theme works out rather than a value written out. */
function derived(entry: unknown): boolean {
  const value = isPlainObject(entry) ? entry.value : entry;
  if (isPlainObject(entry) && (value === undefined || entry.alpha !== undefined)) return true;
  if (typeof value === 'string') return REFERENCE.test(value);
  return typeof value !== 'number';
}

/** The axis value `selection` reads for `axis`. Throws when it does not say. */
function picked(selection: AxisChoice, axis: string, where: string): string {
  const value = getOwn(selection, axis);
  if (value === undefined || value === 'by') {
    throw new EditError(`${where} differs by ${axis}, and which ${axis} this trial shows is not known`);
  }
  return value;
}

/** `holder[key]` through its per-axis branches; undefined where an entry leaves the selection out, so it writes nothing there. */
function branchAt(holder: Holder, key: string, where: string, selection: AxisChoice): Slot | undefined {
  let slot: Slot = { holder, key, where };
  for (let value = ownAt(holder, key); isByAxis(value); value = ownAt(slot.holder, slot.key)) {
    const at = picked(selection, value.by, slot.where);
    if (!Object.hasOwn(value, at)) return undefined;
    slot = { holder: value as unknown as Holder, key: at, where: `${slot.where}.${at}` };
  }
  return slot;
}

/** The place `definition` writes `token`'s value out for `selection`, or null when the theme derives it there. */
function writtenSlot(definition: ThemeDefinition, token: string, selection: AxisChoice): Slot | null {
  for (const layer of LAYERS) {
    const entries = definition[layer] as Holder | undefined;
    if (!entries || !Object.hasOwn(entries, token)) continue;
    const slot = branchAt(entries, token, `${layer}.${token}`, selection);
    if (slot === undefined) continue;
    return derived(ownAt(slot.holder, slot.key)) ? null : slot;
  }
  return null;
}

/** The axes `token`'s value can change with, its pin's and the derivation's under it both. */
function dependentAxes(definition: ThemeDefinition, token: string): string[] {
  const { [token]: _pin, ...pins } = definition.pins ?? {};
  const axes = new Set([
    ...(getOwn(axisDependencies(definition), token)?.all ?? []),
    ...(getOwn(axisDependencies({ ...definition, pins }), token)?.all ?? []),
  ]);
  return Object.keys(definition.axes ?? {}).filter((axis) => axes.has(axis));
}

/** A written-out pin value in place of `old`, keeping its type and description and dropping what derived it. */
function literal(old: unknown, value: string): unknown {
  if (!isPlainObject(old)) return value;
  const { alpha: _alpha, value: _value, ...kept } = old;
  return { ...kept, value };
}

/**
 * `entry`, a pin or nothing, made to give `value` wherever the axes the token varies on read as `selection` does,
 * and what it gave before everywhere else. A pin branch it leaves out keeps overriding nothing.
 */
function pinOver(entry: unknown, axes: readonly string[], selection: AxisChoice, value: string, defs: AxisDefs, where: string): unknown {
  if (isByAxis(entry)) {
    const at = picked(selection, entry.by, where);
    const rest = axes.filter((axis) => axis !== entry.by);
    return { ...entry, [at]: pinOver(getOwn(entry, at), rest, selection, value, defs, `${where}.${at}`) };
  }
  const [axis, ...rest] = axes;
  if (axis === undefined) return literal(entry, value);
  const at = picked(selection, axis, where);
  const others = entry === undefined ? [] : Object.keys(getOwn(defs, axis)?.values ?? {}).filter((v) => v !== at);
  return {
    by: axis,
    ...Object.fromEntries(others.map((v) => [v, entry])),
    [at]: pinOver(entry, rest, selection, value, defs, `${where}.${at}`),
  };
}

/** Writes one edit into `root`, which it mutates. */
function writeEdit(root: ThemeDefinition, token: string, value: string, selection: AxisChoice): void {
  if (!Object.hasOwn(axisDependencies(root), token)) throw new EditError(`the theme defines no token "${token}"`);
  const slot = writtenSlot(root, token, selection);
  if (slot) {
    const entry = ownAt(slot.holder, slot.key);
    setOwn(slot.holder, String(slot.key), isPlainObject(entry) ? { ...entry, value } : value);
    return;
  }
  const pins = ((root as { pins?: Holder }).pins ??= {});
  setOwn(pins, token, pinOver(ownAt(pins, token), dependentAxes(root, token), selection, value, root.axes ?? {}, `pins.${token}`));
}

/**
 * `definition` with each edited token saved for `selection`. `edits` is keyed by token name, without the `--wzl-`
 * prefix. A value the definition writes out (a pin, a component or a literal semantic) is replaced in the branch the
 * selection reads. A token the theme derives gets a pin instead, over only the axis values that select the edited
 * value, so the derivation still gives every other token, and this one everywhere else.
 */
export function applyTokenEdits(
  definition: ThemeDefinition,
  edits: Readonly<Record<string, string>>,
  selection: AxisChoice,
): ScaleEditResult {
  const root = structuredClone(definition);
  try {
    for (const [token, value] of Object.entries(edits)) writeEdit(root, token, value, selection);
  } catch (e) {
    if (e instanceof EditError) return { ok: false, message: `Cannot save: ${e.message}.` };
    throw e;
  }
  return { ok: true, definition: root };
}

/** Whether a save has a place for `token` under `selection`. */
export function canSave(definition: ThemeDefinition, token: string, selection: AxisChoice): boolean {
  return applyTokenEdits(definition, { [token]: '' }, selection).ok;
}
