import { describe, expect, it } from 'vitest';
import { normalizeZoom, ZOOM_FLOOR } from './view';

describe('normalizeZoom', () => {
  it('passes a finite zoom at or above the floor', () => {
    for (const z of [ZOOM_FLOOR, 0.1, 1, 8, 1e12]) expect(normalizeZoom(z)).toBe(z);
  });

  it('gives the floor for anything else', () => {
    for (const z of [0, -1, ZOOM_FLOOR / 2, Number.NaN, Infinity, -Infinity]) expect(normalizeZoom(z)).toBe(ZOOM_FLOOR);
  });
});
