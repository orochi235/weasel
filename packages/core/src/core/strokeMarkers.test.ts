import { describe, it, expect, afterEach } from 'vitest';
import {
  registerMarker, getMarker, listMarkers, _resetMarkersForTests,
  type MarkerEntry,
} from './strokeMarkers';
import { PATH_M, PATH_L, PATH_Z } from './geometry/path';

afterEach(() => { _resetMarkersForTests(); });

const TRIANGLE: MarkerEntry = {
  id: 'app:tri',
  path: () => ({
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([0, 0, -3, -1.5, -3, 1.5]),
    fillRule: 'nonzero',
  }),
  inset: 3,
};

describe('marker registry', () => {
  it('resolves a registered entry by key', () => {
    registerMarker(TRIANGLE);
    expect(getMarker('app:tri')).toBe(TRIANGLE);
  });

  it('answers undefined for an unknown key', () => {
    expect(getMarker('app:nope')).toBeUndefined();
  });

  it('removes the entry when disposed', () => {
    const dispose = registerMarker(TRIANGLE);
    dispose();
    expect(getMarker('app:tri')).toBeUndefined();
  });

  it('restores the built-in when an override is disposed', () => {
    const builtin = getMarker('arrow');
    expect(builtin).toBeDefined();
    const dispose = registerMarker({ ...TRIANGLE, id: 'arrow' });
    expect(getMarker('arrow')).not.toBe(builtin);
    dispose();
    expect(getMarker('arrow')).toBe(builtin);
  });

  it('ignores a disposer whose entry was already replaced', () => {
    const first = registerMarker(TRIANGLE);
    registerMarker({ ...TRIANGLE, inset: 9 });
    first();
    expect(getMarker('app:tri')?.inset).toBe(9);
  });

  it('enumerates the built-in vocabulary', () => {
    const ids = listMarkers().map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining([
      'arrow', 'arrow-open', 'arrow-concave',
      'diamond', 'diamond-hollow', 'circle', 'square', 'bar',
    ]));
  });
});
