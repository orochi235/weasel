// A number leaf's display unit: the stored value stays canonical (radians, millimeters), and a UI converts
// at its edge. A unit is data where the conversion is linear, and a pair of functions where it is not.

import { formatUnit, unitScale, type Unit, type UnitEntry, type UnitScale, type UnitSystem } from '@weasel-js/quantity';

/** What both forms of a unit say about the text around the number. */
interface PrefUnitText {
  /** Shown after the input, e.g. `'°'`. */
  suffix?: string;
  /** Suffixes a person may type, each mapped to the scale that turns a
   *  number in that unit into a display number: `{ mm: 0.1, cm: 1 }` for a
   *  field showing centimeters. A unit that disagrees with the display unit
   *  about zero carries an `offset` as well. */
  accepts?: Readonly<Record<string, UnitEntry>>;
}

/**
 * A display unit as data, for a conversion that is linear: `stored = display * scale + offset`, the direction a
 * `UnitEntry` runs toward its base, so `scale` is what one display unit is worth in stored units. Degrees shown
 * over radians stored is `{ suffix: '°', scale: Math.PI / 180 }`, and `{ scale: 1 }` changes nothing. Being data,
 * it is written to JSON, printed in a schema literal, and edited in `PrefSchemaEditor` like any other attribute.
 */
export interface PrefLinearUnit extends PrefUnitText {
  /** Stored units per display unit. Never 0. */
  scale: number;
  /** The stored value a display of 0 stands for. Absent is 0. */
  offset?: number;
  /** Decimal places the shown value is rounded to. Absent, the value shows unrounded and formats to two places.
   *  What is typed is stored unrounded either way. */
  precision?: number;
}

/** A display unit as code, for a conversion that is not linear. It cannot be written to JSON or edited as data. */
export interface PrefFunctionUnit extends PrefUnitText {
  toDisplay: (stored: number) => number;
  fromDisplay: (display: number) => number;
  /** The stored value as display text, suffix included. */
  format?: (stored: number) => string;
}

/** Display-unit conversion for number leaves whose stored value uses a
 *  canonical unit the user shouldn't see (e.g. radians stored, degrees
 *  shown). Read one through {@link resolvePrefUnit}, which answers for both forms. */
export type PrefNumberUnit = PrefLinearUnit | PrefFunctionUnit;

/** A unit of either form as the functions that convert and format with it. */
export interface ResolvedPrefUnit extends PrefFunctionUnit {
  format: (stored: number) => string;
}

/** Whether `unit` is the data form, and so can be written out and edited. */
export function isPrefLinearUnit(unit: PrefNumberUnit): unit is PrefLinearUnit {
  return typeof (unit as PrefFunctionUnit).toDisplay !== 'function';
}

/** The name `formatUnit` is asked for a linear unit's one unit by. */
const SHOWN = 'shown';

/** How to convert and format with `unit`, whichever form it was written in. */
export function resolvePrefUnit(unit: PrefNumberUnit): ResolvedPrefUnit {
  if (!isPrefLinearUnit(unit)) {
    return { ...unit, format: unit.format ?? ((stored) => `${unit.toDisplay(stored)}${unit.suffix ?? ''}`) };
  }
  const { scale, offset = 0, precision, suffix, accepts } = unit;
  const round = precision === undefined ? undefined : 10 ** precision;
  const system: UnitSystem = { base: 'stored', units: { [SHOWN]: { factor: scale, offset } } };
  return {
    toDisplay: (stored) => {
      const shown = (stored - offset) / scale;
      return round === undefined ? shown : Math.round(shown * round) / round;
    },
    fromDisplay: (shown) => shown * scale + offset,
    format: (stored) => `${formatUnit(stored, SHOWN, system, { precision: precision ?? 2, suffix: false })}${suffix ?? ''}`,
    ...(suffix === undefined ? {} : { suffix }),
    ...(accepts === undefined ? {} : { accepts }),
  };
}

/**
 * A display unit built from a {@link UnitSystem}: values are stored in the
 * system's base and shown in `display`, rounded to `precision` places when
 * given, and every unit in the system is accepted as typed text. `suffix`
 * defaults to the unit's name and is accepted too. Every unit of a system is
 * linear, so what comes back is data.
 */
export function prefUnit(
  system: UnitSystem,
  display: Unit,
  opts?: { precision?: number; suffix?: string },
): PrefLinearUnit {
  let self: Required<UnitScale>;
  try {
    self = unitScale(system, display);
  } catch (e) {
    throw new Error(`prefUnit: ${e instanceof Error ? e.message : String(e)}`);
  }
  const suffix = opts?.suffix ?? display;
  const accepts: Record<string, UnitEntry> = { [suffix]: 1 };
  for (const name of Object.keys(system.units)) {
    const other = unitScale(system, name);
    // A number typed in `name` reaches display units through base:
    // `(n * factor + offset - self.offset) / self.factor`.
    const factor = other.factor / self.factor;
    const offset = (other.offset - self.offset) / self.factor;
    accepts[name] = offset === 0 ? factor : { factor, offset };
  }
  return {
    suffix,
    scale: self.factor,
    ...(self.offset === 0 ? {} : { offset: self.offset }),
    accepts,
    ...(opts?.precision === undefined ? {} : { precision: opts.precision }),
  };
}
