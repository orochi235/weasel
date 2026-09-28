import { describe, it, expect } from 'vitest';
import type { Stroke, MarkerRef } from './paint';

describe('marker fields on Stroke', () => {
  it('accepts a bare key and survives a JSON round-trip', () => {
    const stroke: Stroke = {
      paint: { fill: 'solid', color: '#000' },
      width: 2,
      markerEnd: 'arrow',
    };
    expect(JSON.parse(JSON.stringify(stroke))).toEqual(stroke);
  });

  it('accepts a sized reference in both unit systems', () => {
    const world: MarkerRef = { key: 'arrow', size: 3 };
    const screen: MarkerRef = { key: 'arrow', size: { px: 12 } };
    expect(world).toEqual({ key: 'arrow', size: 3 });
    expect(screen).toEqual({ key: 'arrow', size: { px: 12 } });
  });

  it('accepts all three positions and a consumer key', () => {
    const stroke: Stroke = {
      paint: { fill: 'solid', color: '#000' },
      markerStart: 'circle',
      markerMid: { key: 'app:tick' },
      markerEnd: 'arrow',
    };
    expect(stroke.markerMid).toEqual({ key: 'app:tick' });
  });
});
