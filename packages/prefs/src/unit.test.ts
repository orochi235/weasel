import { describe, expect, it } from 'vitest';
import { ANGLE_RADIANS, METRIC_MM, type UnitSystem } from '@weasel-js/quantity';
import { prefDisplayBounds } from './helpers';
import type { PrefNumber } from './schema';
import { isPrefLinearUnit, prefUnit, prefUnitAccepts, resolvePrefUnit, type PrefLinearUnit, type PrefNumberUnit } from './unit';

/** Temperature is the smallest system whose units disagree about zero. */
const TEMPERATURE_K: UnitSystem = {
  base: 'K',
  units: { K: 1, degC: { factor: 1, offset: 273.15 } },
};

const throughJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('resolvePrefUnit', () => {
  it('reads a linear unit as stored = display * scale + offset', () => {
    const cm = resolvePrefUnit({ scale: 10 });
    expect(cm.toDisplay(25)).toBe(2.5);
    expect(cm.fromDisplay(2.5)).toBe(25);
    const celsius = resolvePrefUnit({ scale: 1, offset: 273.15 });
    expect(celsius.toDisplay(273.15)).toBe(0);
    expect(celsius.fromDisplay(100)).toBeCloseTo(373.15, 9);
  });

  it('leaves a value as it is at a scale of 1', () => {
    const same = resolvePrefUnit({ scale: 1, suffix: 'px' });
    expect(same.toDisplay(12.345)).toBe(12.345);
    expect(same.fromDisplay(12.345)).toBe(12.345);
  });

  it('rounds what a linear unit shows to its precision, and stores what is typed unrounded', () => {
    const deg = resolvePrefUnit({ scale: Math.PI / 180, precision: 1 });
    expect(deg.toDisplay(Math.PI / 3)).toBe(60);
    expect(deg.toDisplay(0.001)).toBe(0.1);
    expect(deg.fromDisplay(90)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('stores a decimal typed at a decimal scale as the decimal it is, with no binary dust', () => {
    const percent = resolvePrefUnit({ scale: 0.01, precision: 1, suffix: '%' });
    expect(33.3 * 0.01).not.toBe(0.333);
    expect(percent.fromDisplay(33.3)).toBe(0.333);
    expect(percent.fromDisplay(58.33)).toBe(0.5833);
    expect(percent.toDisplay(0.583)).toBe(58.3);
    expect(resolvePrefUnit({ scale: 0.1, offset: 0.2 }).fromDisplay(1)).toBe(0.3);
    expect(resolvePrefUnit({ scale: Math.PI / 180 }).fromDisplay(90)).toBe(90 * (Math.PI / 180));
  });

  it('formats a linear unit to its precision, two places without one, and ends it with the suffix', () => {
    expect(resolvePrefUnit({ scale: 10, suffix: 'cm' }).format(25)).toBe('2.5cm');
    expect(resolvePrefUnit({ scale: 3 }).format(1)).toBe('0.33');
    expect(resolvePrefUnit({ scale: Math.PI / 180, precision: 1, suffix: '°' }).format(Math.PI)).toBe('180°');
  });

  it('carries the suffix and what is accepted through', () => {
    const unit: PrefLinearUnit = { scale: 10, suffix: 'cm', accepts: { mm: 0.1, in: 2.54 } };
    expect(resolvePrefUnit(unit)).toMatchObject({ suffix: 'cm', accepts: { mm: 0.1, in: 2.54 } });
  });

  it('hands back a unit of functions as it was given, with a format where it has none', () => {
    const remaining: PrefNumberUnit = { toDisplay: (v) => 100 - v, fromDisplay: (v) => 100 - v, suffix: '%' };
    const resolved = resolvePrefUnit(remaining);
    expect(resolved.toDisplay).toBe(remaining.toDisplay);
    expect(resolved.fromDisplay).toBe(remaining.fromDisplay);
    expect(resolved.format(30)).toBe('70%');
    const own = (stored: number) => `${stored} left`;
    expect(resolvePrefUnit({ ...remaining, format: own }).format).toBe(own);
  });

  it('tells the two forms apart', () => {
    expect(isPrefLinearUnit({ scale: 1 })).toBe(true);
    expect(isPrefLinearUnit({ toDisplay: (v) => v, fromDisplay: (v) => v })).toBe(false);
  });
});

describe('prefUnit', () => {
  it('stores the base unit and shows the display unit', () => {
    const cm = prefUnit(METRIC_MM, 'cm');
    expect(resolvePrefUnit(cm).toDisplay(25)).toBe(2.5);
    expect(resolvePrefUnit(cm).fromDisplay(2.5)).toBe(25);
    expect(cm.suffix).toBe('cm');
  });

  it('builds data: a unit comes back from JSON equal, and converts the same', () => {
    for (const unit of [prefUnit(METRIC_MM, 'cm'), prefUnit(ANGLE_RADIANS, 'deg', { precision: 1, suffix: '°' }), prefUnit(TEMPERATURE_K, 'degC', { precision: 2 })]) {
      const back = throughJson(unit);
      expect(back).toEqual(unit);
      expect(resolvePrefUnit(back).toDisplay(1.25)).toBe(resolvePrefUnit(unit).toDisplay(1.25));
      expect(resolvePrefUnit(back).format(1.25)).toBe(resolvePrefUnit(unit).format(1.25));
    }
    expect(prefUnit(METRIC_MM, 'cm')).toEqual({ suffix: 'cm', scale: 10, accepts: { mm: 0.1, cm: 1, m: 100, km: 100_000 } });
  });

  it('rounds what it shows to the precision given, and nothing else', () => {
    const deg = resolvePrefUnit(prefUnit(ANGLE_RADIANS, 'deg', { precision: 1 }));
    expect(deg.toDisplay(Math.PI / 3)).toBe(60);
    expect(deg.toDisplay(0.001)).toBe(0.1);
    expect(deg.fromDisplay(90)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('accepts every unit in the system, scaled to the display unit, and its suffix', () => {
    const deg = prefUnit(ANGLE_RADIANS, 'deg', { suffix: '°' });
    expect(deg.suffix).toBe('°');
    expect(deg.accepts?.['°']).toBe(1);
    expect(deg.accepts?.deg).toBe(1);
    expect(deg.accepts?.turn).toBeCloseTo(360);
    expect(prefUnit(METRIC_MM, 'cm').accepts).toEqual({ mm: 0.1, cm: 1, m: 100, km: 100_000 });
  });

  it('throws on a display unit the system does not have', () => {
    expect(() => prefUnit(METRIC_MM, 'ft')).toThrow(/unknown unit 'ft'/);
  });

  it('converts through an offset in both directions', () => {
    const c = resolvePrefUnit(prefUnit(TEMPERATURE_K, 'degC', { precision: 2 }));
    expect(c.toDisplay(273.15)).toBe(0);
    expect(c.toDisplay(373.15)).toBe(100);
    expect(c.fromDisplay(0)).toBeCloseTo(273.15, 9);
  });

  it('accepts an offset unit as a scale rather than a bare factor', () => {
    const c = prefUnit(TEMPERATURE_K, 'degC');
    // Typing `0K` into a field showing degC is −273.15, not 0 — which a bare
    // factor cannot say.
    expect(c.accepts?.K).toEqual({ factor: 1, offset: -273.15 });
    // A pure scale stays a bare number, so the common table reads as one.
    expect(prefUnit(METRIC_MM, 'cm').accepts?.mm).toBe(0.1);
  });

  it('formats a stored value in the display unit', () => {
    expect(resolvePrefUnit(prefUnit(METRIC_MM, 'cm')).format(25)).toBe('2.5cm');
    expect(resolvePrefUnit(prefUnit(ANGLE_RADIANS, 'deg', { precision: 1, suffix: '°' })).format(Math.PI)).toBe('180°');
  });
});

describe('prefDisplayBounds over a linear unit', () => {
  it('converts the ends as points and the step as a distance', () => {
    const leaf: PrefNumber = { kind: 'number', name: 'T', description: '', default: 300, min: 273.15, max: 373.15, step: 5, unit: { scale: 1, offset: 273.15, precision: 2 } };
    expect(prefDisplayBounds(leaf)).toEqual({ min: 0, max: 100, step: 5 });
  });

  it('swaps the ends under a negative scale', () => {
    const leaf: PrefNumber = { kind: 'number', name: 'D', description: '', default: 0, min: 0, max: 10, step: 2, unit: { scale: -1, offset: 100 } };
    expect(prefDisplayBounds(leaf)).toEqual({ min: 90, max: 100, step: 2 });
    expect(prefDisplayBounds({ ...leaf, endless: 'max' }).endless).toBe('min');
    expect(prefDisplayBounds({ ...leaf, endless: 'both' }).endless).toBe('both');
    expect(prefDisplayBounds({ ...leaf, unit: { scale: 2 }, endless: 'max' }).endless).toBe('max');
  });
});

describe('prefUnitAccepts', () => {
  it('reads the display suffix as the display unit, beside what the unit accepts', () => {
    expect(prefUnitAccepts({ scale: 10, suffix: 'cm', accepts: { mm: 0.1 } })).toEqual({ cm: 1, mm: 0.1 });
    expect(prefUnitAccepts({ scale: 10, accepts: { mm: 0.1 } })).toEqual({ mm: 0.1 });
  });
});
