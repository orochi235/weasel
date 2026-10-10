import type { ReactNode } from 'react';
import { numericWeight, type FillStyle } from '@weasel-js/core';
import { endless as withInfinity } from '@weasel-js/quantity';
import { isBuiltinPref, prefDisplayBounds, type PrefLeaf } from '@weasel-js/prefs';
import { endlessAllows } from '../../endless';
import { stepDisplay } from '../Properties/NumberControls';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import { isPaint } from '../paintValue';
import type { PropertyControlProps } from '../Properties/PropertyField';
import { prefUnitAccepts, type PrefFieldChoice } from './schema';

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
}

/**
 * A schema leaf as {@link PropertyControl} props: its value, bounds and
 * options in the form it is shown in, and a writer that stores what the
 * control reports in the form the leaf holds.
 *
 * The conversions every schema-driven surface needs live here once — a
 * number's display unit and its bounds, an enum's `encoding`, a color's
 * alpha, an icon resolved to a glyph. A leaf that is not a single control —
 * an `object` or a `union`, whose fields each are, a `list` or a `map`, whose
 * entries each are, an `action`, or an app-defined kind — returns `null`, and the surface draws it.
 *
 * Spread the result and add what the surface decides: `chrome`, `name`, a
 * class, a different default `control`.
 */
export function prefFieldProps(leaf: PrefLeaf, state: PrefFieldState): PropertyControlProps | null {
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
        glyph: glyphOf(leaf.icon),
        short: leaf.short,
        onChange: coded ? coded.write : setValue,
      };
    }
    case 'number': {
      const unit = leaf.unit;
      // ±Infinity is a value only where an end of the leaf stands for it.
      const endless = leaf.endless;
      const stored =
        typeof value === 'number' && (Number.isFinite(value) || endlessAllows(endless, value)) ? value : undefined;
      // `min`/`max`/`step` are declared in the stored unit, like the value, so
      // they convert with it — a leaf storing radians and showing degrees was
      // clamping typed degrees against 0..6.28.
      const bounds = prefDisplayBounds(leaf);
      const clamp = (n: number) =>
        endlessAllows(endless, n)
          ? n
          : Math.min(bounds.max ?? Infinity, Math.max(bounds.min ?? -Infinity, n));
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
        endless,
        onChange: store,
      };
    }
    case 'string':
      return {
        kind: 'string',
        control: leaf.control,
        value: typeof value === 'string' ? value : '',
        mixed,
        unset,
        onChange: setValue,
      };
    case 'enum': {
      // An encoded leaf stores something other than the option string (a dash
      // array), so the option comes from the encoding — and an absent field is
      // one of the things it reads (no dash is `solid`), which is why `unset`
      // does not blank it.
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
          glyph: glyphOf(o.icon),
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
      // the default over it. Unset shows the fallback actually in effect,
      // dimmed by the control: true, but not chosen.
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
        value: paint as FillStyle | null | undefined,
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
      return null;
    case 'field': {
      const choices = (state.fields ?? []).filter((f) => !leaf.kinds || leaf.kinds.includes(f.kind));
      const current = mixed || unset ? undefined : typeof value === 'string' && value !== '' ? value : undefined;
      const options = choices.map((f) => ({ value: f.path, label: `${f.name} (${f.path})` }));
      // A reference to a field this surface does not draw still shows what it names.
      if (current !== undefined && !choices.some((f) => f.path === current))
        options.unshift({ value: current, label: current });
      return { kind: 'enum', control: 'select', value: current, mixed, unset, options, onChange: setValue };
    }
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
 * An encoded leaf's shown value and its writer. Across nodes whose objects
 * differ, each node is read against its own object and the option is shown
 * only where every node reads the same one; a write lands in each node
 * computed from that node's object.
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

/** A leaf's `icon` as a glyph, where the kit's icon set has it. */
function glyphOf(icon: string | undefined): ReactNode {
  return icon && icon in ICON_PATHS ? <Icon name={icon as IconName} size={14} /> : undefined;
}
