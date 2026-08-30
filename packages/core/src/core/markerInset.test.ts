import { describe, it, expect } from 'vitest';
import { markerInset, resolveMarkerSize, markerKeyOf, strokeInsets } from './markerInset';
import type { Stroke } from '@weasel-js/paint';

const BASE: Stroke = { paint: { fill: 'solid', color: '#000' }, width: 2 };

describe('marker inset resolution', () => {
  it('reads the key from either reference form', () => {
    expect(markerKeyOf('arrow')).toBe('arrow');
    expect(markerKeyOf({ key: 'arrow' })).toBe('arrow');
  });

  it('defaults one marker unit to the stroke width', () => {
    expect(resolveMarkerSize('arrow', 2)).toBe(2);
    expect(resolveMarkerSize({ key: 'arrow' }, 2)).toBe(2);
  });

  it('honours both size unit systems', () => {
    expect(resolveMarkerSize({ key: 'arrow', size: 5 }, 2)).toBe(5);
    expect(resolveMarkerSize({ key: 'arrow', size: { px: 12 } }, 2)).toBe(12);
  });

  it('multiplies the entry inset by the size', () => {
    expect(markerInset('arrow', 2)).toBeCloseTo(6, 6);
    expect(markerInset({ key: 'arrow', size: 5 }, 2)).toBeCloseTo(15, 6);
  });

  it('gives an open head no inset', () => {
    expect(markerInset('arrow-open', 2)).toBe(0);
    expect(markerInset('bar', 2)).toBe(0);
  });

  it('answers zero for an absent or unregistered marker', () => {
    expect(markerInset(undefined, 2)).toBe(0);
    expect(markerInset('app:nope', 2)).toBe(0);
  });

  it('never insets for a mid marker', () => {
    const insets = strokeInsets({ ...BASE, markerMid: 'arrow' }, 2);
    expect(insets).toEqual({ start: 0, end: 0 });
  });

  it('resolves start and end independently', () => {
    const insets = strokeInsets({ ...BASE, markerStart: 'circle', markerEnd: 'arrow' }, 2);
    expect(insets.start).toBeCloseTo(4, 6);
    expect(insets.end).toBeCloseTo(6, 6);
  });
});
