import { getAlpha01, toHex8, withAlpha01 } from '@weasel-js/core';
import {
  type PrefBoundReader,
  type PrefLeaf,
  type PrefNumber,
  prefLeafValue,
  prefNumberAt,
} from '@weasel-js/prefs';
import {
  type LiveControl,
  PARAMS_SETTLES,
  type PrefFieldChoice,
  prefFieldProps,
  useParamsPolicy,
  withDrafts,
} from '@weasel-js/ui/components/Prefs';
import { PropertyControl, type PropertyControlProps } from '@weasel-js/ui/components/Properties';
import { valueAtPath } from '../config/path';
import { useFieldChoices } from './fieldChoices';

const unwritten = (): void => {};

type Settles = Readonly<Record<LiveControl, boolean>>;

/** A typed value passes through text that is no value at all on its way, `1` and `12` before `120`, so with
 *  nowhere to send its drafts a typed field writes only the value its edit settles on. */
const typedSettle = (settles: Settles): Settles => ({ ...settles, number: true, string: true });

/** Which of a lab's live controls write only the value an edit settles on: `params.lab.settles`. */
export function useLabSettles(): Settles {
  return useParamsPolicy('lab').settles;
}

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

/** What the row of `leaf` at `path` shows of `config` ({@link prefLeafValue}). */
export function leafValueAt(config: unknown, path: string, leaf: PrefLeaf): unknown {
  return prefLeafValue(leaf, valueAtPath(config, path));
}

/**
 * A leaf as the field it draws, with the labkit-only extras `prefFieldProps`
 * knows nothing of. Given `draft`, a control the lab leaves live sends the
 * values its edit passes through there and the one it settles on to `write`;
 * without it, a typed field writes only that settled value. `null` for a kind with no one field: a paint, which a
 * hex swatch would flatten to a solid and the panel declines, and an object,
 * which a flat row would write one field of and the panel opens in a dialog.
 * `read` reads the panel's values, which a number's `minAt` and `maxAt` bound it by; `settles` is
 * {@link useLabSettles}, and `textWaitMs` how long drafted text waits for the next keystroke ({@link useTextWaitMs}).
 */
export function labField(
  given: PrefLeaf,
  value: unknown,
  write: (value: unknown) => void,
  fields: readonly PrefFieldChoice[],
  disabled = false,
  draft?: (value: unknown) => void,
  read?: PrefBoundReader,
  settles: Settles = PARAMS_SETTLES.lab,
  textWaitMs = 0,
): PropertyControlProps | null {
  // `prefFieldProps` answers for the kinds ui draws that are no built-in of the schema's, the font pickers.
  if (given.kind === 'paint' || given.kind === 'object') return null;
  const leaf = given.kind === 'number' && read ? prefNumberAt(given as PrefNumber, read) : given;
  const state = { value, setValue: write, fields, disabled };
  const settled = prefFieldProps(
    leaf,
    state,
    'lab',
    draft ? settles : typedSettle(settles),
    textWaitMs,
  );
  if (settled === null) return null;
  const field = draft
    ? withDrafts(
        settled,
        prefFieldProps(leaf, { ...state, setValue: draft }, 'lab', settles),
        'lab',
        settles,
      )
    : settled;
  switch (field.kind) {
    case 'number':
      // `prefFieldProps` clamps what it stores, so an instrument is never
      // handed a value outside the range it asked for.
      return {
        ...field,
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
  read,
}: {
  leaf: PrefLeaf;
  value: unknown;
  write: (value: unknown) => void;
  /** Where the values an edit passes through go — see {@link labField}. */
  draft?: (value: unknown) => void;
  name?: string;
  /** The control takes no input: an `enableIf` on the way to it does not hold. */
  disabled?: boolean;
  /** Reads the panel's values, which a number's `minAt` and `maxAt` bound it by. */
  read?: PrefBoundReader;
}) {
  const field = labField(
    leaf,
    value,
    write,
    useFieldChoices(),
    disabled,
    draft,
    read,
    useLabSettles(),
    useTextWaitMs(leaf),
  );
  if (field === null) return null;
  switch (field.kind) {
    case 'number':
      // The pair names the row, so a cell has no room for a unit.
      return <PropertyControl {...field} name={name} control="input" unit={undefined} />;
    case 'color': {
      // The alpha track needs a row of its own to sit under, so a paired
      // swatch edits the color and carries the stored alpha through untouched.
      const stored = typeof value === 'string' ? toHex8(value) : '#000000';
      const keep =
        (send: (hex: string) => void) =>
        (rgb: string): void =>
          send(field.alpha ? withAlpha01(rgb, getAlpha01(stored)) : rgb);
      return (
        <PropertyControl
          {...field}
          name={name}
          alpha={undefined}
          onChange={keep(field.onChange)}
          onInput={field.onInput && keep(field.onInput)}
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
