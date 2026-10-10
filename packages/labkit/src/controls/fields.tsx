import { getAlpha01, toHex8, withAlpha01 } from '@weasel-js/core';
import { isBuiltinPref, type PrefLeaf } from '@weasel-js/prefs';
import {
  type PrefFieldChoice,
  PropertyControl,
  type PropertyControlProps,
  prefFieldProps,
} from '@weasel-js/ui';
import { useEffect, useRef, useState } from 'react';
import { useFieldChoices } from './fieldChoices';

/** Whether this leaf draws as a slider, mirroring the condition the `number`
 *  arm below branches on. A slider is the one control whose value cannot be
 *  read off the control itself. */
export function isSliderLeaf(leaf: PrefLeaf): boolean {
  return (
    leaf.kind === 'number' &&
    extra<string>(leaf, 'control') === 'slider' &&
    extra<number>(leaf, 'min') !== undefined &&
    extra<number>(leaf, 'max') !== undefined
  );
}

/** Reads a labkit-only extra off a leaf. `PrefLeaf` has no field for these,
 *  and extra keys survive the resolve pass at runtime. */
export function extra<T>(leaf: PrefLeaf, key: string): T | undefined {
  return (leaf as unknown as Record<string, T | undefined>)[key];
}

/**
 * A leaf as the field it draws, with the labkit-only extras `prefFieldProps`
 * knows nothing of. `null` for a kind the panel declines: a paint, which a
 * hex swatch would flatten to a solid, and an object, which a flat row would
 * write one field of. Override with `render` to edit either.
 */
export function labField(
  leaf: PrefLeaf,
  value: unknown,
  write: (value: unknown) => void,
  fields: readonly PrefFieldChoice[],
): PropertyControlProps | null {
  if (!isBuiltinPref(leaf) || leaf.kind === 'paint' || leaf.kind === 'object') return null;
  const field = prefFieldProps(leaf, { value, setValue: write, fields });
  if (field === null) return null;
  switch (field.kind) {
    case 'number':
      // `prefFieldProps` clamps what it stores, so an instrument is never
      // handed a value outside the range it asked for.
      return {
        ...field,
        control: isSliderLeaf(leaf) ? 'slider' : 'input',
        unit: extra<string>(leaf, 'suffix') ?? field.unit,
      };
    case 'boolean':
      return {
        ...field,
        control: extra<string>(leaf, 'control') === 'switch' ? 'switch' : 'checkbox',
      };
    case 'enum':
      // `.radio()` and `.toggle()` both ask for every option at once, which a panel draws as segments.
      return {
        ...field,
        control: ['radio', 'toggle'].includes(extra<string>(leaf, 'control') ?? '')
          ? 'toggle'
          : 'select',
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
  name = leaf.name,
}: {
  leaf: PrefLeaf;
  value: unknown;
  write: (value: unknown) => void;
  name?: string;
}) {
  const text = useDebouncedText(
    typeof value === 'string' ? value : '',
    write,
    extra<number>(leaf, 'debounceMs') ?? 150,
  );
  const field = labField(leaf, value, write, useFieldChoices());
  // Unreachable for null: callers admit only kinds with a field.
  if (field === null) return null;
  switch (field.kind) {
    case 'string':
      return <PropertyControl {...field} name={name} value={text.local} onChange={text.type} />;
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternal = useRef(value);

  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setLocal(value);
    }
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    local,
    type: (next) => {
      setLocal(next);
      if (timer.current) clearTimeout(timer.current);
      const commit = () => {
        lastExternal.current = next;
        write(next);
      };
      if (debounceMs === 0) commit();
      else timer.current = setTimeout(commit, debounceMs);
    },
  };
}
