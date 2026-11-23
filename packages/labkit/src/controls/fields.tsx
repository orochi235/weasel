import { hexAlpha, toHex8, withAlpha01 } from '@weasel-js/paint';
import {
  type PrefBoundReader,
  type PrefLeaf,
  type PrefNumber,
  prefBoundedNumber,
  prefValueOrDefault,
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
import { configValueAt, isRecord } from '../config/path';
import { isEncodedLeaf } from '../config/storedDefault';
import { type ControlPack, spansGrid } from './controlPack';
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

type LeafExtra = 'control' | 'debounceMs' | 'max' | 'min' | 'placeholder' | 'step' | 'summary';

/** Reads a labkit-only extra off a leaf. `PrefLeaf` has no field for these,
 *  and extra keys survive the resolve pass at runtime. */
export function extra<T>(leaf: PrefLeaf, key: LeafExtra): T | undefined {
  return (leaf as unknown as Record<string, T | undefined>)[key];
}

/** What `leaf`'s control is handed when it holds `held`: an encoded leaf's stored value as it is, which its
 *  encoding reads even when absent (its default is the option it reads as), and any other's value or default. */
export function fieldValue(leaf: PrefLeaf, held: unknown): unknown {
  return isEncodedLeaf(leaf) ? held : prefValueOrDefault(leaf, held);
}

/** The object the field at `path` of `config` sits in. */
export function siblingsAt(config: unknown, path: string): Record<string, unknown> | undefined {
  const dot = path.lastIndexOf('.');
  const within = dot === -1 ? config : configValueAt(config, path.slice(0, dot));
  return isRecord(within) ? within : undefined;
}

/** What the row of `leaf` at `path` hands its control of `config` ({@link fieldValue}). */
export function leafValueAt(config: unknown, path: string, leaf: PrefLeaf): unknown {
  return fieldValue(leaf, configValueAt(config, path));
}

/** What {@link labField} draws a leaf from. */
export interface LabFieldInput {
  /** What the control is handed: {@link fieldValue}. */
  value: unknown;
  /** The object the leaf is a field of, which an `encoding` reads and writes against ({@link siblingsAt}). */
  siblings?: Record<string, unknown>;
  write: (value: unknown) => void;
  fields: readonly PrefFieldChoice[];
  disabled?: boolean;
  /** Where the values an edit passes through go. */
  draft?: (value: unknown) => void;
  /** Reads the panel's values, which a number's `minAt` and `maxAt` bound it by. */
  read?: PrefBoundReader;
  /** {@link useLabSettles}. */
  settles?: Settles;
  /** How long drafted text waits for the next keystroke ({@link useTextWaitMs}). */
  textWaitMs?: number;
}

/**
 * A leaf as the field it draws. Given `draft`, a control the lab leaves live sends the
 * values its edit passes through there and the one it settles on to `write`;
 * without it, a typed field writes only that settled value. `null` for a kind with no one field: a paint, which a
 * hex swatch would flatten to a solid and the panel declines, and an object,
 * which a flat row would write one field of and the panel opens in a dialog.
 */
export function labField(given: PrefLeaf, input: LabFieldInput): PropertyControlProps | null {
  const { value, siblings, write, fields, disabled = false, draft, read } = input;
  const { settles = PARAMS_SETTLES.lab, textWaitMs = 0 } = input;
  // `prefFieldProps` answers for the kinds ui draws that are no built-in of the schema's, the font pickers.
  if (given.kind === 'paint' || given.kind === 'object') return null;
  const leaf =
    given.kind === 'number' && read ? prefBoundedNumber(given as PrefNumber, read) : given;
  const state = { value, siblings, setValue: write, fields, disabled };
  const settled = prefFieldProps(
    leaf,
    state,
    'lab',
    draft ? settles : typedSettle(settles),
    textWaitMs,
  );
  if (settled === null) return null;
  return draft
    ? withDrafts(
        settled,
        prefFieldProps(leaf, { ...state, setValue: draft }, 'lab', settles),
        'lab',
        settles,
      )
    : settled;
}

/** Whether a pair holding `leaf` takes the whole row under `pack`, as `leaf`'s own row would ({@link spansGrid}),
 *  for the control its {@link BareControl} draws: a number there is always a typed input. */
export function bareSpans(leaf: PrefLeaf, pack: ControlPack): boolean {
  const field = labField(leaf, { value: undefined, write: unwritten, fields: [] });
  if (field === null) return false;
  return spansGrid(field.kind === 'number' ? { ...field, control: 'input' } : field, pack);
}

/** A leaf's control without the row chrome a whole row of its own would
 *  bring: a paired cell, or a heading's control. `name` is the accessible name,
 *  the leaf's own unless the control stands for something else. */
export function BareControl({
  leaf,
  value,
  siblings,
  write,
  draft,
  name = leaf.name,
  disabled,
  read,
}: {
  leaf: PrefLeaf;
  value: unknown;
  /** The object the leaf is a field of ({@link siblingsAt}). */
  siblings?: Record<string, unknown>;
  write: (value: unknown) => void;
  /** Where the values an edit passes through go — see {@link labField}. */
  draft?: (value: unknown) => void;
  name?: string;
  /** The control takes no input: an `enableIf` on the way to it does not hold. */
  disabled?: boolean;
  /** Reads the panel's values, which a number's `minAt` and `maxAt` bound it by. */
  read?: PrefBoundReader;
}) {
  const setting = useLabFieldSetting(leaf);
  const field = labField(leaf, { ...setting, value, siblings, write, disabled, draft, read });
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
          send(field.alpha ? withAlpha01(rgb, hexAlpha(stored)) : rgb);
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

/** What every lab field of `leaf` reads from its surroundings: the font choices, the lab's settles, and how
 *  long its text waits. */
export function useLabFieldSetting(leaf: PrefLeaf) {
  return { fields: useFieldChoices(), settles: useLabSettles(), textWaitMs: useTextWaitMs(leaf) };
}

/** How long `leaf`'s typed text waits before it is written: its own `debounceMs`, else a lab's. */
export function useTextWaitMs(leaf: PrefLeaf): number {
  const lab = useParamsPolicy('lab').textWaitMs;
  return extra<number>(leaf, 'debounceMs') ?? lab;
}
