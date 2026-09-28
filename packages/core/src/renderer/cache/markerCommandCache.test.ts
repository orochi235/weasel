import { describe, it, expect, beforeEach } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from '../../core/geometry/path';
import { registerMarker, getMarker, type MarkerEntry } from '../../core/strokeMarkers';
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

  // A painter that builds its stroke every frame — an animated vertex color,
  // an annotation rebuilt per render — still reuses its heads.
  it('answers an equal stroke in a new object with the same commands', () => {
    const a = cachedMarkerCommands(LINE, { ...STROKE }, { ...STROKE }, 2, undefined);
    const again = { ...STROKE, vertexColors: [1, 0, 0, 1, 0, 0, 1, 1] };
    expect(cachedMarkerCommands(LINE, again, again, 2, undefined)).toBe(a);
  });

  it('repaints a head in a new paint without rebuilding its geometry', () => {
    const [a] = cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined);
    const blue: Stroke = { ...STROKE, paint: { color: '#00f' } };
    const [b] = cachedMarkerCommands(LINE, blue, blue, 2, undefined);
    expect(b.fill).toEqual({ color: '#00f' });
    expect(b.path).toBe(a.path);
  });

  function lengthHead(reads?: MarkerEntry['reads']): MarkerEntry {
    return {
      id: 'app-grow',
      ...(reads ? { reads } : {}),
      path: ({ size, stroke }) => {
        const len = (stroke.miterLimit ?? 1) * size;
        return {
          kind: 'polygon',
          commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
          coords: new Float32Array([0, 0, -len, -size, -len, size]),
          fillRule: 'nonzero',
        };
      },
    };
  }

  it('rebuilds when a field a head declares it reads changes', () => {
    const dispose = registerMarker(lengthHead(['miterLimit']));
    try {
      const s1: Stroke = { ...STROKE, markerEnd: 'app-grow', miterLimit: 1 };
      const a = cachedMarkerCommands(LINE, s1, s1, 2, undefined);
      expect(cachedMarkerCommands(LINE, { ...s1 }, { ...s1 }, 2, undefined)).toBe(a);
      const s2 = { ...s1, miterLimit: 4 };
      expect(cachedMarkerCommands(LINE, s2, s2, 2, undefined)).not.toBe(a);
    } finally {
      dispose();
    }
  });

  // It may read any field, so only the same stroke object is known to match.
  it('rebuilds for a new stroke object when a head does not say what it reads', () => {
    const dispose = registerMarker(lengthHead());
    try {
      const s1: Stroke = { ...STROKE, markerEnd: 'app-grow', miterLimit: 1 };
      const a = cachedMarkerCommands(LINE, s1, s1, 2, undefined);
      expect(cachedMarkerCommands(LINE, s1, s1, 2, undefined)).toBe(a);
      const s2 = { ...s1, miterLimit: 4 };
      expect(cachedMarkerCommands(LINE, s2, s2, 2, undefined)).not.toBe(a);
    } finally {
      dispose();
    }
  });
});
