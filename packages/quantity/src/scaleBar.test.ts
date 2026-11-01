import { describe, expect, it } from 'vitest';
import { scaleBar } from './scaleBar';
import type { UnitScope } from './scope';
import { IMPERIAL_INCHES, METRIC_MM } from './units';

const INCHES: UnitScope = { system: IMPERIAL_INCHES };
const MM: UnitScope = { system: METRIC_MM, scale: 1 / 25.4 };

describe('scaleBar', () => {
  it('picks the longest 1-2-5 length that fits, labeled in the largest unit it fills', () => {
    expect(scaleBar({ pxPerUnit: 10, scopes: [INCHES] })).toEqual({ length: 12, px: 120, label: '1ft', magnification: 1 });
    expect(scaleBar({ pxPerUnit: 100, scopes: [INCHES] })).toMatchObject({ length: 1, px: 100, label: '1in' });
  });

  it('measures in the innermost scope, converting at its boundary', () => {
    // 4px an inch is 4/25.4 px a millimeter: 500 mm is about 79 px; 1 m would be 157.
    const bar = scaleBar({ pxPerUnit: 4, scopes: [INCHES, MM] });
    expect(bar.length).toBe(500);
    expect(bar.label).toBe('50cm');
    expect(bar.px).toBeCloseTo(500 * 4 / 25.4);
  });

  it('reads a frame drawn at a declared magnification by its true lengths', () => {
    const bar = scaleBar({ pxPerUnit: 10, scopes: [INCHES, { ...INCHES, drawnAt: 0.4 }] });
    // An inch of the frame is 4 px on screen: 2 ft is 96 px, 5 ft would be 240.
    expect(bar).toEqual({ length: 24, px: 96, label: '2ft', magnification: 0.4 });
  });

  it('chooses among the lengths it is given', () => {
    const lengths = [{ value: 1, unit: 'in' }, { value: 1, unit: 'ft' }, { value: 4, unit: 'ft' }];
    expect(scaleBar({ pxPerUnit: 2.5, scopes: [INCHES], lengths })).toMatchObject({ length: 48, label: '4ft' });
  });

  it('settles for the shortest when none fits', () => {
    expect(scaleBar({ pxPerUnit: 1e6, scopes: [INCHES] })).toMatchObject({ length: 0.001 });
  });
});
