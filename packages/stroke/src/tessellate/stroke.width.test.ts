import { describe, it, expect } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { tessellateStroke } from './stroke';
import { clipRibbon } from '../trim/clipRibbon';

describe('tessellateStroke at a width with no vertices to give', () => {
  it('draws nothing for an infinite or NaN width rather than non-finite vertices', () => {
    for (const width of [Infinity, NaN]) {
      const mesh = tessellateStroke(pathFromD('M0 0L10 0L10 10'), { paint: { color: '#000' }, width, join: 'round', cap: 'round' });
      expect(mesh.indices.length).toBe(0);
      expect(mesh.vertices.length).toBe(0);
    }
  });

  it('gives a trim clip ribbon no vertices at those widths either', () => {
    for (const width of [Infinity, NaN]) {
      expect(clipRibbon(pathFromD('M0 0L10 0'), { paint: { color: '#000' }, width, cap: 'round' }).mesh.vertices.length).toBe(0);
    }
  });
});
