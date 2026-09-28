import { describe, it, expect, beforeEach } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import { PATH_M, PATH_L, type PolygonPath } from '../../core/geometry/path';
import { registerMarker, getMarker } from '../../core/strokeMarkers';
import { cachedMarkerCommands, _resetMarkerCommandCacheForTests } from './markerCommandCache';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const STROKE: Stroke = { paint: { color: '#000' }, width: 2, markerEnd: 'arrow' };

describe('cachedMarkerCommands', () => {
  beforeEach(() => _resetMarkerCommandCacheForTests());

  // A fresh head path every frame would miss the fill cache and re-upload.
  it('answers a repeat frame with the same commands', () => {
    const a = cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined);
    expect(a).toHaveLength(1);
    expect(cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined)).toBe(a);
  });

  it('rebuilds when a resolved size changes', () => {
    const source: Stroke = { ...STROKE, markerEnd: { key: 'arrow', size: { px: 8 } } };
    const at1 = cachedMarkerCommands(LINE, source, { ...source, markerEnd: { key: 'arrow', size: 8 } }, 2, undefined);
    const at4 = cachedMarkerCommands(LINE, source, { ...source, markerEnd: { key: 'arrow', size: 2 } }, 2, undefined);
    expect(at4).not.toBe(at1);
  });

  it('rebuilds when the registry changes', () => {
    const before = cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined);
    const dispose = registerMarker({ ...getMarker('arrow')!, fill: { color: '#f00' } });
    try {
      expect(cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined)).not.toBe(before);
    } finally {
      dispose();
    }
  });
});
