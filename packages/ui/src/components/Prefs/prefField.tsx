import type { ReactNode } from 'react';
import { isBuiltinToolPref, type FillStyle } from '@weasel-js/core';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import { isPaint } from '../paintValue';
import type { PropertyControlProps } from '../Properties/PropertyField';
import { prefDisplayBounds, prefUnitAccepts, type PrefLeaf } from './schema';

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
  /** A font family's weight and slant, where they are not `siblings`' own
   *  `fontWeight` / `fontStyle`. */
  fontVariant?: { weight?: unknown; style?: unknown };
}

/**
 * A schema leaf as {@link PropertyControl} props: its value, bounds and
 * options in the form it is shown in, and a writer that stores what the
 * control reports in the form the leaf holds.
 *
 * The conversions every schema-driven surface needs live here once — a
 * number's display unit and its bounds, an enum's `encoding`, a color's
 * alpha, an icon resolved to a glyph. A leaf that is not a single control —
 * an `object`, whose fields each are, or an app-defined kind — returns
 * `null`, and the surface draws it.
 *
 * Spread the result and add what the surface decides: `chrome`, `name`, a
 * class, a different default `control`.
 */
export function prefFieldProps(leaf: PrefLeaf, state: PrefFieldState): PropertyControlProps | null {
  const { value, mixed = false, unset = false, siblings, setValue } = state;
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
  if (!isBuiltinToolPref(leaf)) return null;
  switch (leaf.kind) {
    case 'boolean':
      return {
        kind: 'boolean',
        control: leaf.control,
        value: typeof value === 'boolean' ? value : undefined,
        mixed,
        unset,
        glyph: glyphOf(leaf.icon) ?? leaf.short,
        onChange: setValue,
      };
    case 'number': {
      const unit = leaf.unit;
      const stored = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
      // `min`/`max`/`step` are declared in the stored unit, like the value, so
      // they convert with it — a leaf storing radians and showing degrees was
      // clamping typed degrees against 0..6.28.
      const bounds = prefDisplayBounds(leaf);
      const clamp = (n: number) =>
        Math.min(bounds.max ?? Infinity, Math.max(bounds.min ?? -Infinity, n));
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
        notation: leaf.format,
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
      const encoding = leaf.encoding;
      // An encoded leaf stores something other than the option string (a dash
      // array), so the option comes from the encoding — and an absent field is
      // one of the things it reads (no dash is `solid`), which is why `unset`
      // does not blank it.
      const option = encoding
        ? mixed
          ? undefined
          : encoding.read(value, siblings)
        : mixed || unset
          ? undefined
          : typeof value === 'string'
            ? value
            : leaf.default;
      return {
        kind: 'enum',
        control: leaf.control,
        value: option,
        mixed,
        unset,
        options: leaf.options.map((o) => ({
          value: o.value,
          label: o.label,
          glyph: glyphOf(o.icon) ?? o.short,
          disabled: o.disabled,
        })),
        onChange: (next: string) => setValue(encoding ? encoding.write(next, siblings) : next),
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
      return null;
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

/** A leaf's `icon` as a glyph, where the kit's icon set has it. */
function glyphOf(icon: string | undefined): ReactNode {
  return icon && icon in ICON_PATHS ? <Icon name={icon as IconName} size={14} /> : undefined;
}
