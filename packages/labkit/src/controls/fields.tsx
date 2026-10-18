import { getAlpha01, toHex8, withAlpha01 } from '@weasel-js/core';
import type { PrefLeaf } from '@weasel-js/prefs';
import {
  PARAMS_SETTLES,
  type PrefFieldChoice,
  PropertyControl,
  type PropertyControlProps,
  prefFieldProps,
  useParamsPolicy,
  withDrafts,
} from '@weasel-js/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hasConfigPath, valueAtPath } from '../config/path';
import { useFieldChoices } from './fieldChoices';

const unwritten = (): void => {};

/** A typed value passes through text that is no value at all on its way, `1` and `12` before `120`, so with
 *  nowhere to send its drafts a typed field writes only the value its edit settles on. */
const TYPED_SETTLE = { ...PARAMS_SETTLES.lab, number: true, string: true };

/** Whether this leaf draws as a slider, the one control whose value cannot be
 *  read off the control itself. */
export function isSliderLeaf(leaf: PrefLeaf): boolean {
  const field = prefFieldProps(leaf, { value: undefined, setValue: unwritten }, 'lab');
  return field?.kind === 'number' && field.control === 'slider';
}

/** Reads a labkit-only extra off a leaf. `PrefLeaf` has no field for these,
 *  and extra keys survive the resolve pass at runtime. */
export function extra<T>(leaf: PrefLeaf, key: string): T | undefined {
  return (leaf as unknown as Record<string, T | undefined>)[key];
}

/** What the row of `leaf` at `path` shows of `config`: the value there, else the leaf's default. A clearable
 *  number held unset stays unset. */
export function leafValueAt(config: unknown, path: string, leaf: PrefLeaf): unknown {
  const held = valueAtPath(config, path);
  if (held !== undefined || (extra<boolean>(leaf, 'clearable') && hasConfigPath(config, path)))
    return held;
  return extra<unknown>(leaf, 'default');
}

/**
 * A leaf as the field it draws, with the labkit-only extras `prefFieldProps`
 * knows nothing of. Given `draft`, a control the lab leaves live sends the
 * values its edit passes through there and the one it settles on to `write`;
 * without it, a typed field writes only that settled value. `null` for a kind with no one field: a paint, which a
 * hex swatch would flatten to a solid and the panel declines, and an object,
 * which a flat row would write one field of and the panel opens in a dialog.
 */
export function labField(
  leaf: PrefLeaf,
  value: unknown,
  write: (value: unknown) => void,
  fields: readonly PrefFieldChoice[],
  disabled = false,
  draft?: (value: unknown) => void,
): PropertyControlProps | null {
  // `prefFieldProps` answers for the kinds ui draws that are no built-in of the schema's, the font pickers.
  if (leaf.kind === 'paint' || leaf.kind === 'object') return null;
  const state = { value, setValue: write, fields, disabled };
  const settled = prefFieldProps(leaf, state, 'lab', draft ? undefined : TYPED_SETTLE);
  if (settled === null) return null;
  const field = draft
    ? withDrafts(settled, prefFieldProps(leaf, { ...state, setValue: draft }, 'lab'), 'lab')
    : settled;
  switch (field.kind) {
    case 'number':
      // `prefFieldProps` clamps what it stores, so an instrument is never
      // handed a value outside the range it asked for.
      return {
        ...field,
        unit: extra<string>(leaf, 'suffix') ?? field.unit,
        placeholder: extra<string>(leaf, 'placeholder'),
      };
    case 'string':
      return {
        ...field,
        placeholder: extra<string>(leaf, 'placeholder'),
        maxLength: extra<number>(leaf, 'maxLength'),
      };
    default:
      return field;
  }
}

/** A leaf's control without the row chrome a whole row of its own would
 *  bring: a paired cell, or a heading's control. `name` is the accessible name,
 *  the leaf's own unless the control stands for something else. */
export function BareControl({
  leaf,
  value,
  write,
  draft,
  name = leaf.name,
  disabled,
}: {
  leaf: PrefLeaf;
  value: unknown;
  write: (value: unknown) => void;
  /** Where the values an edit passes through go — see {@link labField}. */
  draft?: (value: unknown) => void;
  name?: string;
  /** The control takes no input: an `enableIf` on the way to it does not hold. */
  disabled?: boolean;
}) {
  const field = labField(leaf, value, write, useFieldChoices(), disabled, draft);
  const drafts = useDebouncedText(
    typeof value === 'string' ? value : '',
    draft ?? unwritten,
    useTextWaitMs(leaf),
  );
  if (field === null) return null;
  switch (field.kind) {
    case 'string':
      return (
        <PropertyControl {...field} name={name} onInput={draft ? drafts.type : field.onInput} />
      );
    case 'number':
      // The pair names the row, so a cell has no room for a unit.
      return <PropertyControl {...field} name={name} control="input" unit={undefined} />;
    case 'color': {
      // The alpha track needs a row of its own to sit under, so a paired
      // swatch edits the color and carries the stored alpha through untouched.
      const stored = typeof value === 'string' ? toHex8(value) : '#000000';
      return (
        <PropertyControl
          {...field}
          name={name}
          alpha={undefined}
          onChange={(rgb: string) =>
            write(field.alpha ? withAlpha01(rgb, getAlpha01(stored)) : rgb)
          }
        />
      );
    }
    default:
      return <PropertyControl {...field} name={name} />;
  }
}

/** How long `leaf`'s typed text waits before it is written: its own `debounceMs`, else a lab's. */
export function useTextWaitMs(leaf: PrefLeaf): number {
  const lab = useParamsPolicy('lab').textWaitMs;
  return extra<number>(leaf, 'debounceMs') ?? lab;
}

/**
 * Live text held locally between debounced commits, so typing does not re-run
 * the instrument on every keystroke. Locally controlled between commits, which
 * means it has to notice the value changing underneath it.
 */
export function useDebouncedText(
  value: string,
  write: (value: string) => void,
  debounceMs: number,
): { local: string; type: (next: string) => void } {
  const [local, setLocal] = useState(value);
  const lastExternal = useRef(value);
  // The text typed since the last write, and the timer that will write it.
  const pending = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const latestWrite = useRef(write);
  useEffect(() => {
    latestWrite.current = write;
  });

  const settle = useCallback((commit: boolean): void => {
    const waiting = pending.current;
    if (waiting === null) return;
    pending.current = null;
    clearTimeout(waiting.timer);
    if (!commit) return;
    lastExternal.current = waiting.text;
    latestWrite.current(waiting.text);
  }, []);

  useEffect(() => {
    if (value !== lastExternal.current) {
      // Replaced from outside (a reset): text still waiting would overwrite it.
      settle(false);
      lastExternal.current = value;
      setLocal(value);
    }
  }, [value, settle]);

  // A row that unmounts inside the debounce window (a closing popover, a tab
  // switch) still owes its last keystrokes.
  useEffect(() => () => settle(true), [settle]);

  return {
    local,
    type: (next) => {
      setLocal(next);
      settle(false);
      pending.current = { text: next, timer: setTimeout(() => settle(true), debounceMs) };
      if (debounceMs === 0) settle(true);
    },
  };
}
