import { describe, expect, it } from 'vitest';
import { createSlew, slewToward } from './slew';

describe('slewToward', () => {
  it('rises no faster than the rise rate', () => {
    expect(slewToward(0, 10, 0.5, { rise: 4 })).toBe(2);
  });

  it('falls no faster than the fall rate', () => {
    expect(slewToward(10, 0, 0.5, { fall: 4 })).toBe(8);
  });

  it('lands on the target rather than passing it', () => {
    expect(slewToward(0, 1, 1, { rise: 4 })).toBe(1);
    expect(slewToward(1, 0, 1, { fall: 4 })).toBe(0);
  });

  it('jumps in a direction with no rate', () => {
    expect(slewToward(0, 10, 0.01, { fall: 1 })).toBe(10);
    expect(slewToward(10, 0, 0.01, { rise: 1 })).toBe(0);
  });

  it('holds with a zero rate', () => {
    expect(slewToward(3, 10, 1, { rise: 0 })).toBe(3);
  });

  it('refuses a negative or NaN rate', () => {
    expect(() => slewToward(0, 1, 1, { rise: -1 })).toThrow(RangeError);
    expect(() => slewToward(0, 1, 1, { fall: Number.NaN })).toThrow(RangeError);
  });
});

describe('createSlew', () => {
  it('starts at rest on its value', () => {
    const s = createSlew({ value: 3 });
    expect(s.target).toBe(3);
    expect(s.step(1)).toBe(3);
  });

  it('steps toward a target set after creation', () => {
    const s = createSlew({ rise: 2 });
    s.target = 5;
    expect(s.step(1)).toBe(2);
    expect(s.step(1)).toBe(4);
    expect(s.step(1)).toBe(5);
    expect(s.value).toBe(5);
  });

  it('takes a value written directly, then slews from it', () => {
    const s = createSlew({ fall: 1 });
    s.value = 6;
    expect(s.step(2)).toBe(4);
  });
});
