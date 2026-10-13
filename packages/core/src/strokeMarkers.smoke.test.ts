import { describe, it, expect } from 'vitest';
import * as kit from './index';

describe('stroke markers are public API', () => {
  it('exports the registry surface', () => {
    expect(typeof kit.registerMarker).toBe('function');
    expect(typeof kit.getMarker).toBe('function');
    expect(typeof kit.listMarkers).toBe('function');
  });

  it('exports the geometry helpers a consumer needs', () => {
    expect(typeof kit.markerSites).toBe('function');
    expect(typeof kit.markerInset).toBe('function');
  });
});
