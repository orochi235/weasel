import { describe, it, expect } from 'vitest';
import * as core from '@weasel-js/geom';
import { pathUnion } from '@weasel-js/geom/booleans';

describe('package exports', () => {
  it('core barrel exposes the tiers', () => {
    for (const name of ['cross', 'boxToBox', 'pointInPolygon', 'transformCoords', 'cubicBounds', 'forEachSegment', 'placeRect', 'clampRectWithin']) {
      expect(typeof (core as Record<string, unknown>)[name]).toBe('function');
    }
  });
  it('booleans subpath resolves', () => {
    expect(typeof pathUnion).toBe('function');
  });
});
