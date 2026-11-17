import { describe, it, expect } from 'vitest';
import * as core from '@weasel-js/geom';
import { pathUnion, splitPathBySegment } from '@weasel-js/geom/booleans';
import { CURVE_REPS } from '@weasel-js/geom/curves';
import { tessellate, extractPolylines, trimPolyline } from '@weasel-js/geom/tessellate';
import { applyPathWarp, pinWarpMap } from '@weasel-js/geom/warp';

describe('package exports', () => {
  it('core barrel exposes the tiers', () => {
    for (const name of ['cross', 'rectToRect', 'pointInPolygon', 'transformCoords', 'cubicBounds', 'forEachSegment', 'placeRect', 'clampRectWithin', 'quadraticEvalAt', 'splitCubicAt', 'splitQuadraticAt', 'splitLineAt', 'nearestOnSegment', 'segmentT', 'pointSegmentDistance', 'pointSegmentDistance2', 'distance', 'distance2', 'lerp', 'lerpPoint', 'nearestOnQuadratic', 'nearestOnCubic', 'nearestOnPath', 'lineShape', 'arcShape', 'rectPath', 'pathFromD', 'boundsOfPath', 'transformPath', 'pointAlongPath', 'schneiderFit', 'resolveEasing', 'easeOutBack']) {
      expect(typeof (core as Record<string, unknown>)[name]).toBe('function');
    }
  });
  it('booleans subpath resolves', () => {
    expect(typeof pathUnion).toBe('function');
    expect(typeof splitPathBySegment).toBe('function');
  });
  it('curves, tessellate, and warp subpaths resolve', () => {
    expect(Object.keys(CURVE_REPS)).toContain('spiro');
    for (const fn of [tessellate, extractPolylines, trimPolyline, applyPathWarp, pinWarpMap]) expect(typeof fn).toBe('function');
  });
});
