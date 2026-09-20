/**
 * Units — a tiny customizable unit system for canvas-kit APIs.
 *
 * The kit stores all coordinates as bare numbers in a single base unit
 * chosen by the consumer app. To make API call sites self-documenting,
 * the public surface accepts `UnitValue` — either a bare number (interpreted
 * as base units) or a `{ value, unit }` tag that's resolved against a
 * `UnitSystem` at the API boundary. Internals never see units.
 *
 * An entry is affine — `base = value * factor + offset` — so a scale that
 * puts zero somewhere else (degC against K) is expressible. No per-axis
 * units. No mixed-unit arithmetic.
 */

/** A unit name (e.g. `'in'`, `'ft'`, `'mm'`). Looked up in a `UnitSystem`. */
export type Unit = string;

/** What one unit is worth in base units: `base = value * factor + offset`. */
export interface UnitScale {
  factor: number;
  /** Where this unit puts zero, in base units. Absent is 0 — a pure scale. */
  offset?: number;
}

/** One unit's conversion. A bare number is the `{ factor }` shorthand. */
export type UnitEntry = number | UnitScale;

/** Conversion table mapping unit names to their scale against a base unit. */
export interface UnitSystem {
  /** Name of the base unit, e.g. 'in'. All conversions resolve to this. */
  base: Unit;
  /** How to reach base units from each unit. The base unit's entry is 1. */
  units: Record<Unit, UnitEntry>;
}

/**
 * One unit's scale, with the bare-number shorthand widened and the offset
 * defaulted — what every conversion in the kit reads. Throws if the system
 * does not carry the unit.
 */
export function unitScale(unitSystem: UnitSystem, unit: Unit): Required<UnitScale> {
  const entry = unitSystem.units[unit];
  if (entry === undefined) {
    const known = Object.keys(unitSystem.units).join(', ') || '(none)';
    throw new Error(
      `unknown unit '${unit}' (system base: '${unitSystem.base}', known units: ${known})`,
    );
  }
  return typeof entry === 'number'
    ? { factor: entry, offset: 0 }
    : { factor: entry.factor, offset: entry.offset ?? 0 };
}

/** Value at a unit-aware API boundary: bare number (in base units) or `{ value, unit }` tag. */
export type UnitValue = number | { value: number; unit: Unit };

/**
 * Resolve a UnitValue to a number in base units.
 *  - bare number: returned as-is (assumed base)
 *  - tagged: looks up factor; throws if unit not in unit system
 */
export function resolveUnit(v: UnitValue, unitSystem?: UnitSystem): number {
  if (typeof v === 'number') return v;
  if (!unitSystem) {
    throw new Error(
      `resolveUnit: tagged value { value: ${v.value}, unit: '${v.unit}' } requires a UnitSystem`,
    );
  }
  const { factor, offset } = scaleOrThrow('resolveUnit', unitSystem, v.unit);
  return v.value * factor + offset;
}

/**
 * Format a base-unit number as a string in the named display unit.
 *  e.g. formatUnit(36, 'ft', IMPERIAL_INCHES) => '3ft'
 *  Default precision: 2. Trailing zeros trimmed.
 */
export function formatUnit(
  baseValue: number,
  displayUnit: Unit,
  unitSystem: UnitSystem,
  opts?: { precision?: number; suffix?: boolean },
): string {
  const { factor, offset } = scaleOrThrow('formatUnit', unitSystem, displayUnit);
  const precision = opts?.precision ?? 2;
  const suffix = opts?.suffix ?? true;
  const display = (baseValue - offset) / factor;
  // Trim trailing zeros (and a dangling decimal point) without losing precision.
  let s = display.toFixed(precision);
  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return suffix ? `${s}${displayUnit}` : s;
}

/** `unitScale`, with the caller's name in front of the message. */
function scaleOrThrow(caller: string, unitSystem: UnitSystem, unit: Unit): Required<UnitScale> {
  try {
    return unitScale(unitSystem, unit);
  } catch (e) {
    throw new Error(`${caller}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Imperial unit system with base 'in'. */
export const IMPERIAL_INCHES: UnitSystem = {
  base: 'in',
  units: { in: 1, ft: 12, yd: 36, mi: 63360 },
};

/** Metric unit system with base 'mm'. */
export const METRIC_MM: UnitSystem = {
  base: 'mm',
  units: { mm: 1, cm: 10, m: 1000, km: 1_000_000 },
};

/** Angle unit system with base 'rad'. */
export const ANGLE_RADIANS: UnitSystem = {
  base: 'rad',
  units: { rad: 1, deg: Math.PI / 180, turn: Math.PI * 2 },
};

/** Pixel unit system — sole unit is the base. */
export const PIXELS: UnitSystem = {
  base: 'px',
  units: { px: 1 },
};
