import { describe, expect, it } from 'vitest';
import {
  resolveUnit,
  ANGLE_RADIANS,
  formatUnit,
  IMPERIAL_INCHES,
  METRIC_MM,
  PIXELS,
  unitScale,
  type UnitSystem,
} from './units';

describe('resolveUnit', () => {
  it('returns bare numbers unchanged', () => {
    expect(resolveUnit(42, IMPERIAL_INCHES)).toBe(42);
    expect(resolveUnit(0, IMPERIAL_INCHES)).toBe(0);
    expect(resolveUnit(-3.5, IMPERIAL_INCHES)).toBe(-3.5);
  });

  it('does not require a unit system for bare numbers', () => {
    expect(resolveUnit(7)).toBe(7);
  });

  it('resolves tagged values using unit system factors', () => {
    expect(resolveUnit({ value: 3, unit: 'ft' }, IMPERIAL_INCHES)).toBe(36);
    expect(resolveUnit({ value: 1, unit: 'yd' }, IMPERIAL_INCHES)).toBe(36);
    expect(resolveUnit({ value: 1, unit: 'mi' }, IMPERIAL_INCHES)).toBe(63360);
    expect(resolveUnit({ value: 2, unit: 'cm' }, METRIC_MM)).toBe(20);
    expect(resolveUnit({ value: 1.5, unit: 'm' }, METRIC_MM)).toBe(1500);
  });

  it('throws with a helpful message when the tag unit is not in the system', () => {
    expect(() => resolveUnit({ value: 3, unit: 'unknown' }, IMPERIAL_INCHES)).toThrow(
      /unknown unit 'unknown'/,
    );
    expect(() => resolveUnit({ value: 3, unit: 'unknown' }, IMPERIAL_INCHES)).toThrow(
      /known units: in, ft, yd, mi/,
    );
  });

  it('throws when a tagged value is given without a unit system', () => {
    expect(() => resolveUnit({ value: 3, unit: 'ft' })).toThrow(/requires a UnitSystem/);
  });
});

describe('formatUnit', () => {
  it('formats whole-unit base values with the suffix by default', () => {
    expect(formatUnit(36, 'ft', IMPERIAL_INCHES)).toBe('3ft');
    expect(formatUnit(63360, 'mi', IMPERIAL_INCHES)).toBe('1mi');
    expect(formatUnit(1000, 'm', METRIC_MM)).toBe('1m');
    expect(formatUnit(5, 'px', PIXELS)).toBe('5px');
  });

  it('trims trailing zeros and dangling decimal points', () => {
    expect(formatUnit(36, 'in', IMPERIAL_INCHES)).toBe('36in');
    expect(formatUnit(0.5, 'in', IMPERIAL_INCHES, { precision: 1 })).toBe('0.5in');
    expect(formatUnit(0.5, 'in', IMPERIAL_INCHES)).toBe('0.5in');
  });

  it('omits suffix when suffix:false', () => {
    expect(formatUnit(36, 'ft', IMPERIAL_INCHES, { suffix: false })).toBe('3');
  });

  it('respects precision', () => {
    expect(formatUnit(13, 'ft', IMPERIAL_INCHES, { precision: 3 })).toBe('1.083ft');
    expect(formatUnit(13, 'ft', IMPERIAL_INCHES, { precision: 0 })).toBe('1ft');
  });

  it('throws when displayUnit is not in the system', () => {
    expect(() => formatUnit(100, 'unknown', IMPERIAL_INCHES)).toThrow(/unknown unit 'unknown'/);
  });
});

describe('pre-built unit systems', () => {
  it('IMPERIAL_INCHES has correct factors', () => {
    expect(IMPERIAL_INCHES.base).toBe('in');
    expect(IMPERIAL_INCHES.units.in).toBe(1);
    expect(IMPERIAL_INCHES.units.ft).toBe(12);
    expect(IMPERIAL_INCHES.units.yd).toBe(36);
    expect(IMPERIAL_INCHES.units.mi).toBe(63360);
  });

  it('METRIC_MM has correct factors', () => {
    expect(METRIC_MM.base).toBe('mm');
    expect(METRIC_MM.units.mm).toBe(1);
    expect(METRIC_MM.units.cm).toBe(10);
    expect(METRIC_MM.units.m).toBe(1000);
    expect(METRIC_MM.units.km).toBe(1_000_000);
  });

  it('PIXELS has only px=1', () => {
    expect(PIXELS.base).toBe('px');
    expect(PIXELS.units.px).toBe(1);
    expect(Object.keys(PIXELS.units)).toEqual(['px']);
  });
});

describe('ANGLE_RADIANS', () => {
  it('converts degrees and turns to radians', () => {
    expect(resolveUnit({ value: 180, unit: 'deg' }, ANGLE_RADIANS)).toBeCloseTo(Math.PI);
    expect(resolveUnit({ value: 0.5, unit: 'turn' }, ANGLE_RADIANS)).toBeCloseTo(Math.PI);
    expect(ANGLE_RADIANS.base).toBe('rad');
  });
});

describe('affine units', () => {
  // Temperature is the reason an entry cannot be a bare factor: °C and K share
  // a degree size and disagree about where zero sits.
  const TEMPERATURE_K: UnitSystem = {
    base: 'K',
    units: { K: 1, degC: { factor: 1, offset: 273.15 }, degF: { factor: 5 / 9, offset: 255.372_222_222 } },
  };

  it('resolves a tagged value through an offset', () => {
    expect(resolveUnit({ value: 0, unit: 'degC' }, TEMPERATURE_K)).toBeCloseTo(273.15, 6);
    expect(resolveUnit({ value: 100, unit: 'degC' }, TEMPERATURE_K)).toBeCloseTo(373.15, 6);
  });

  it('formats a base value back through an offset', () => {
    expect(formatUnit(373.15, 'degC', TEMPERATURE_K, { suffix: false })).toBe('100');
    expect(formatUnit(273.15, 'degF', TEMPERATURE_K, { precision: 0, suffix: false })).toBe('32');
  });

  it('reads a bare number entry as a factor with no offset', () => {
    expect(unitScale(METRIC_MM, 'cm')).toEqual({ factor: 10, offset: 0 });
    expect(unitScale(TEMPERATURE_K, 'degC')).toEqual({ factor: 1, offset: 273.15 });
  });

  it('throws on a unit the system does not carry', () => {
    expect(() => unitScale(METRIC_MM, 'mi')).toThrow(/unknown unit 'mi'/);
  });
});
