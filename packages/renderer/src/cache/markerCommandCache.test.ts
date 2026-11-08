import { describe, it, expect, beforeEach } from 'vitest';
import type { CommandStroke } from '@weasel-js/paint';
import { PATH_M, PATH_L, PATH_C, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { registerMarker, getMarker, type MarkerEntry } from '@weasel-js/stroke';
import { cachedMarkerHeads, _markerShapesBuiltForTests, _resetMarkerCommandCacheForTests, type PlacedHead } from './markerCommandCache';

/** The draws of each head, which a hit shares with the frame before. */
const cachedMarkerCommands = (...args: Parameters<typeof cachedMarkerHeads>) => cachedMarkerHeads(...args).map((h) => h.draws);
const cmdOf = (heads: PlacedHead[]) => heads[0].draws[0].cmd;

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const STROKE: CommandStroke = { paint: { color: '#000' }, width: 2, markerEnd: 'arrow' };

describe('cachedMarkerHeads', () => {
  beforeEach(() => _resetMarkerCommandCacheForTests());

  // A fresh head path every frame would miss the fill cache and re-upload.
  it('answers a repeat frame with the same commands', () => {
    const [a] = cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined);
    expect(a).toHaveLength(1);
    expect(cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined)[0]).toBe(a);
  });

  it('rebuilds when a resolved size changes', () => {
    const source: CommandStroke = { ...STROKE, markerEnd: { key: 'arrow', size: { px: 8 } } };
    const [at1] = cachedMarkerCommands(LINE, source, { ...source, markerEnd: { key: 'arrow', size: 8 } }, 2, undefined);
    const [at4] = cachedMarkerCommands(LINE, source, { ...source, markerEnd: { key: 'arrow', size: 2 } }, 2, undefined);
    expect(at4).not.toBe(at1);
  });

  it('moves its heads as the trim changes, building none', () => {
    const at = (end: number) => ({ ...STROKE, trim: { end } });
    const short = cachedMarkerHeads(LINE, at(0.4), at(0.4), 2, undefined);
    const built = _markerShapesBuiltForTests();
    const longer = cachedMarkerHeads(LINE, at(0.6), at(0.6), 2, undefined);
    expect(_markerShapesBuiltForTests()).toBe(built);
    expect(cmdOf(longer)).toBe(cmdOf(short));
    // The arrow's tip rides the window's front, 20 further on.
    expect(longer[0].transform[6] - short[0].transform[6]).toBeCloseTo(20, 4);
  });

  it('rebuilds when the registry changes', () => {
    const [before] = cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined);
    const dispose = registerMarker({ ...getMarker('arrow')!, fill: { color: '#f00' } });
    try {
      expect(cachedMarkerCommands(LINE, STROKE, STROKE, 2, undefined)[0]).not.toBe(before);
    } finally {
      dispose();
    }
  });

  // A painter that builds its stroke every frame — an animated vertex color,
  // an annotation rebuilt per render — still reuses its heads.
  it('answers an equal stroke in a new object with the same commands', () => {
    const [a] = cachedMarkerCommands(LINE, { ...STROKE }, { ...STROKE }, 2, undefined);
    const again = { ...STROKE, vertexColors: [1, 0, 0, 1, 0, 0, 1, 1] };
    expect(cachedMarkerCommands(LINE, again, again, 2, undefined)[0]).toBe(a);
  });

  // Per-vertex widths decide how finely a curve is flattened, which is where
  // a head on it sits and which way it points.
  it('places heads again when per-vertex widths change the flattening', () => {
    const curve: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_C]),
      coords: new Float32Array([0, 0, 0, 100, 100, 100, 100, 0]),
      fillRule: 'nonzero',
    };
    // A head that says what it reads is cached by value, across stroke objects.
    const dispose = registerMarker({ ...getMarker('arrow')!, id: 'app-arrow', reads: [] });
    try {
      // Trimmed, so the head sits inside the curve rather than at its end.
      const plain: CommandStroke = { ...STROKE, markerEnd: 'app-arrow', trim: { end: 0.47 } };
      const wide: CommandStroke = { ...plain, vertexWidths: [2, 2, 2, 80] };
      const fresh = cachedMarkerHeads(curve, wide, wide, 2, 0.5).map((h) => [...h.transform]);
      _resetMarkerCommandCacheForTests();
      cachedMarkerHeads(curve, plain, plain, 2, 0.5);
      const after = cachedMarkerHeads(curve, wide, wide, 2, 0.5).map((h) => [...h.transform]);
      expect(after).toEqual(fresh);
    } finally {
      dispose();
    }
  });

  it('repaints a head in a new paint without rebuilding its geometry', () => {
    const a = cmdOf(cachedMarkerHeads(LINE, STROKE, STROKE, 2, undefined));
    const blue: CommandStroke = { ...STROKE, paint: { color: '#00f' } };
    const b = cmdOf(cachedMarkerHeads(LINE, blue, blue, 2, undefined));
    expect(b.fill).toEqual({ paint: { color: '#00f' } });
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
      const s1: CommandStroke = { ...STROKE, markerEnd: 'app-grow', miterLimit: 1 };
      const [a] = cachedMarkerCommands(LINE, s1, s1, 2, undefined);
      expect(cachedMarkerCommands(LINE, { ...s1 }, { ...s1 }, 2, undefined)[0]).toBe(a);
      const s2 = { ...s1, miterLimit: 4 };
      expect(cachedMarkerCommands(LINE, s2, s2, 2, undefined)[0]).not.toBe(a);
    } finally {
      dispose();
    }
  });

  // It may read any field, so only the same stroke object is known to match.
  it('rebuilds for a new stroke object when a head does not say what it reads', () => {
    const dispose = registerMarker(lengthHead());
    try {
      const s1: CommandStroke = { ...STROKE, markerEnd: 'app-grow', miterLimit: 1 };
      const [a] = cachedMarkerCommands(LINE, s1, s1, 2, undefined);
      expect(cachedMarkerCommands(LINE, s1, s1, 2, undefined)[0]).toBe(a);
      const s2 = { ...s1, miterLimit: 4 };
      expect(cachedMarkerCommands(LINE, s2, s2, 2, undefined)[0]).not.toBe(a);
    } finally {
      dispose();
    }
  });
});
