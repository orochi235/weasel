import { numericWeight, type Paint } from '@weasel-js/core';
import { clampToBounds, endlessAllows, endless as withInfinity } from '@weasel-js/quantity';
import { isBuiltinPref, prefDisplayBounds, prefUnitAccepts, resolvePrefUnit, type PrefField, type PrefLeaf, type PrefNumber, type PrefValueBase } from '@weasel-js/prefs';
import { stepDisplay } from '../Properties/NumberControls';
import { resolveIcon } from '../../icons/resolveIcon';
import { isPaint } from '../paintValue';
import type { PropertyControlProps } from '../Properties/PropertyField';
import { type LiveControl, type ParamsSurface, withCommitPolicy } from './commitPolicy';
import type { PrefFieldChoice } from './schema';
import { withSurfaceControl } from './surfaceControls';

/** What {@link prefFieldProps} is told about one leaf's value. */
export interface PrefFieldState {
  /** The value held at the leaf. `undefined` when `mixed` or `unset`. */
  value: unknown;
  mixed?: boolean;
  unset?: boolean;
  /** The object the leaf is a field of, for an enum `encoding` and a font's
   *  weight and slant. `undefined` for a top-level leaf. */
  siblings?: Record<string, unknown>;
  /** Writes a value in the leaf's stored form. */
  setValue: (value: unknown) => void;
  /**
   * Each selected node's stored value with its own `siblings`. Given with
   * `update`, an `encoding` reads and writes every node against its own object
   * — which a selection whose objects differ needs, having no one `siblings`.
   */
  perNode?: readonly { value: unknown; siblings: Record<string, unknown> | undefined }[];
  /** Writes each node a value derived from its own `siblings`. */
  update?: (fn: (prev: unknown, siblings?: Record<string, unknown>) => unknown) => void;
  /** A font family's weight and slant, where they are not `siblings`' own
   *  `fontWeight` / `fontStyle`. */
  fontVariant?: { weight?: unknown; style?: unknown };
  /** A font weight's family, where it is not `siblings`' own `fontFamily`. */
  fontFamily?: unknown;
  /** The fields a `field` leaf may name, by the surface's own paths. */
  fields?: readonly PrefFieldChoice[];
  /** The leaf takes no input: its `enableIf`, or that of something above it, does not hold. */
  disabled?: boolean;
}

/**
 * A schema leaf as {@link PropertyControl} props: its value, bounds, and
 * options in the form it is shown in, and a writer that stores what the
 * control reports in the form the leaf holds.
 *
 * A leaf that is not a single control — an `object`, `union`, `list`, `map`,
 * `action`, or an app-defined kind — returns `null`, and the surface draws it.
 * Spread the result and add what the caller decides: `chrome`, `name`, a class.
 *
 * Given a `surface`, the control is the one that surface draws for what the
 * leaf asked for ({@link PARAMS_CONTROLS}), and it writes when that surface
 * writes ({@link PARAMS_SETTLES}, or `settles` where given). A leaf naming no
 * control is left without one; {@link withRowControl} fills in a row's.
 */
export function prefFieldProps(
  leaf: PrefLeaf,
  state: PrefFieldState,
  surface?: ParamsSurface,
  settles?: Readonly<Record<LiveControl, boolean>>,
): PropertyControlProps | null {
  const made = clearable(leaf, state, enabledFieldProps(leaf, state));
  if (made === null) return null;
  const field = surface === undefined ? made : withCommitPolicy(withSurfaceControl(made, surface), surface, settles);
  const shown = (leaf as PrefValueBase<string, unknown>).readout === true ? { ...field, readOnly: true } : field;
  return state.disabled ? { ...shown, disabled: true } : shown;
}

/** `field` emptying to `undefined` where `leaf` is a clearable number. */
function clearable(leaf: PrefLeaf, state: PrefFieldState, field: PropertyControlProps | null): PropertyControlProps | null {
  if (field?.kind !== 'number' || (leaf as PrefNumber).clearable !== true) return field;
  return { ...field, onClear: () => state.setValue(undefined) };
}

/** A `field` leaf as a select among the fields the surface draws. */
function fieldRefProps(leaf: PrefField, state: PrefFieldState): PropertyControlProps {
  const { value, mixed = false, unset = false, setValue } = state;
  const choices = (state.fields ?? []).filter((f) => !leaf.kinds || leaf.kinds.includes(f.kind));
  const current = mixed || unset ? undefined : typeof value === 'string' && value !== '' ? value : undefined;
  const options = choices.map((f) => ({ value: f.path, label: `${f.name} (${f.path})` }));
  // A reference to a field this surface does not draw still shows what it names.
  if (current !== undefined && !choices.some((f) => f.path === current))
    options.unshift({ value: current, label: current });
  return { kind: 'enum', control: 'select', value: current, mixed, unset, options, onChange: setValue };
}

/** A number leaf as its field, in the unit it shows: the value, its bounds, step and stops convert from the
 *  stored unit, and what is set converts back. */
function numberFieldProps(leaf: PrefNumber, state: PrefFieldState): PropertyControlProps {
  const { value, mixed = false, unset = false, setValue } = state;
  const unit = leaf.unit && resolvePrefUnit(leaf.unit);
  // ±Infinity is a value only where an end of the leaf stands for it.
  const stored =
    typeof value === 'number' && (Number.isFinite(value) || endlessAllows(leaf.endless, value)) ? value : undefined;
  const bounds = prefDisplayBounds(leaf);
  const clamp = (n: number) => clampToBounds(n, bounds);
  const store = (shown: number) => setValue(unit ? unit.fromDisplay(clamp(shown)) : clamp(shown));
  return {
    kind: 'number',
    control: leaf.control,
    value: stored === undefined ? undefined : unit ? unit.toDisplay(stored) : stored,
    mixed,
    unset,
    min: bounds.min,
    max: bounds.max,
    step: bounds.step,
    unit: unit?.suffix,
    accepts: unit ? prefUnitAccepts(unit) : undefined,
    display:
      leaf.infinity === undefined ? leaf.display : withInfinity(leaf.display ?? stepDisplay(bounds.step), leaf.infinity),
    endless: bounds.endless,
    stops: bounds.stops,
    onChange: store,
  };
}

function enabledFieldProps(leaf: PrefLeaf, state: PrefFieldState): PropertyControlProps | null {
  const { value, mixed = false, unset = false, siblings, setValue } = state;
  if (leaf.kind === 'font-weight') {
    const family = 'fontFamily' in state ? state.fontFamily : siblings?.fontFamily;
    return {
      kind: 'font-weight',
      value: typeof value === 'number' || typeof value === 'string' ? numericWeight(value) : undefined,
      mixed,
      unset,
      onChange: setValue,
      family: typeof family === 'string' ? family : undefined,
    };
  }
  if (leaf.kind === 'font-family') {
    const weight = state.fontVariant ? state.fontVariant.weight : siblings?.fontWeight;
    const style = state.fontVariant ? state.fontVariant.style : siblings?.fontStyle;
    return {
      kind: 'font-family',
      value: typeof value === 'string' ? value : undefined,
      mixed,
      unset,
      onChange: setValue,
      weight: typeof weight === 'number' ? weight : undefined,
      fontStyle: style === 'italic' ? 'italic' : undefined,
    };
  }
  if (!isBuiltinPref(leaf)) return null;
  switch (leaf.kind) {
    case 'boolean': {
      const coded = leaf.encoding ? throughEncoding(leaf.encoding, state) : undefined;
      return {
        kind: 'boolean',
        control: leaf.control,
        value: coded ? coded.value : typeof value === 'boolean' ? value : undefined,
        mixed: coded ? coded.mixed : mixed,
        unset,
        glyph: resolveIcon(leaf.icon),
        short: leaf.short,
        onChange: coded ? coded.write : setValue,
      };
    }
    case 'number':
      return numberFieldProps(leaf, state);
    case 'string':
      return {
        kind: 'string',
        control: leaf.control,
        value: typeof value === 'string' ? value : '',
        mixed,
        unset,
        onChange: setValue, placeholder: leaf.placeholder,
      };
    case 'enum': {
      // An encoding reads an absent field too (no dash is `solid`), which is
      // why `unset` does not blank an encoded leaf.
      const coded = leaf.encoding ? throughEncoding(leaf.encoding, state) : undefined;
      const option = coded
        ? coded.value
        : mixed || unset
          ? undefined
          : typeof value === 'string'
            ? value
            : leaf.default;
      return {
        kind: 'enum',
        control: leaf.control,
        value: option,
        mixed: coded ? coded.mixed : mixed,
        unset,
        options: leaf.options.map((o) => ({
          value: o.value,
          label: o.label,
          glyph: resolveIcon(o.icon),
          short: o.short,
          disabled: o.disabled,
        })),
        onChange: coded ? coded.write : setValue,
        onClear: leaf.clearable ? () => setValue(undefined) : undefined,
      };
    }
    case 'color':
      return {
        kind: 'color',
        value: typeof value === 'string' ? value : leaf.default,
        mixed,
        unset,
        alpha: leaf.alpha ? true : undefined,
        onChange: setValue,
      };
    case 'paint': {
      // `??` would read an explicit `null` — "no paint" — as absent and show
      // the default over it.
      const paint =
        value === null
          ? null
          : isPaint(value)
            ? value
            : mixed
              ? undefined
              : isPaint(leaf.default)
                ? leaf.default
                : null;
      return {
        kind: 'paint',
        value: paint as Paint | null | undefined,
        mixed,
        unset,
        onChange: setValue,
      };
    }
    case 'object':
    case 'list':
    case 'map':
    case 'union':
    case 'action':
    case 'actions':
    case 'alias':
    case 'label':
    case 'separator':
      return null;
    case 'field':
      return fieldRefProps(leaf, state);
    default: {
      // Not reachable while every built-in kind has an arm — and a new kind
      // that lacks one is a compile error here, never a blank row.
      const _exhaustive: never = leaf;
      throw new Error(
        `prefFieldProps: no control for built-in pref kind "${(_exhaustive as { kind: string }).kind}"`,
      );
    }
  }
}

/**
 * An encoded leaf's shown value and its writer. Each node is read against its
 * own object and the option is shown only where every node reads the same one;
 * a write is computed per node from that node's object.
 */
function throughEncoding<T>(
  encoding: {
    read: (stored: unknown, siblings: Record<string, unknown> | undefined) => T | undefined;
    write: (option: T, siblings: Record<string, unknown> | undefined) => unknown;
  },
  state: PrefFieldState,
): { value: T | undefined; mixed: boolean; write: (option: T) => void } {
  const { perNode, update } = state;
  if (perNode !== undefined && perNode.length > 0 && update !== undefined) {
    const reads = perNode.map((n) => encoding.read(n.value, n.siblings));
    const agree = reads.every((r) => r === reads[0]);
    return {
      value: agree ? reads[0] : undefined,
      mixed: !agree,
      write: (option) => update((_prev, siblings) => encoding.write(option, siblings)),
    };
  }
  const mixed = state.mixed === true;
  return {
    value: mixed ? undefined : encoding.read(state.value, state.siblings),
    mixed,
    write: (option) => state.setValue(encoding.write(option, state.siblings)),
  };
}
