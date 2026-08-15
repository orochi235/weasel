import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath, RectPath, Stroke } from '@weasel-js/core';
import {
  strokeMesh,
  _resetStrokeMeshCacheForTests,
  STROKE_CONFIGS_PER_PATH,
} from './strokeMeshCache';

const rect = (): RectPath => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
const base: Stroke = { width: 2, paint: { color: '#000000' } };

describe('stroke ribbon cache', () => {
  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
  });

  it('returns the same Mesh object on a repeat call', () => {
    const path = rect();
    const first = strokeMesh(path, base, undefined);
    expect(strokeMesh(path, base, undefined)).toBe(first);
  });

  it('misses when a geometry-affecting parameter changes', () => {
    const path = rect();
    const first = strokeMesh(path, base, undefined);
    expect(strokeMesh(path, { ...base, width: 4 }, undefined)).not.toBe(first);
    expect(strokeMesh(path, { ...base, cap: 'round' }, undefined)).not.toBe(first);
    expect(strokeMesh(path, { ...base, join: 'bevel' }, undefined)).not.toBe(first);
    expect(strokeMesh(path, { ...base, miterLimit: 2 }, undefined)).not.toBe(first);
    expect(strokeMesh(path, { ...base, align: 'inner' }, undefined)).not.toBe(first);
    expect(strokeMesh(path, { ...base, dash: [2, 2] }, undefined)).not.toBe(first);
  });

  it('misses when varyingWidthJoinThreshold changes', () => {
    const path = rect();
    const widths = [1, 2, 3, 4];
    const stroke: Stroke = { ...base, vertexWidths: widths };
    const first = strokeMesh(path, stroke, undefined);
    const bevelled = strokeMesh(path, { ...stroke, varyingWidthJoinThreshold: 0.1 }, undefined);
    expect(bevelled).not.toBe(first);
    expect(strokeMesh(path, { ...stroke, varyingWidthJoinThreshold: 0.1 }, undefined))
      .toBe(bevelled);
  });

  it('hits when only paint changes — colors are not geometry', () => {
    const path = rect();
    const first = strokeMesh(path, base, undefined);
    expect(strokeMesh(path, { ...base, paint: { color: '#ff0000' } }, undefined)).toBe(first);
  });

  it('hits when only vertexColors change', () => {
    const path = rect();
    const first = strokeMesh(path, base, undefined);
    expect(strokeMesh(path, { ...base, vertexColors: [1, 0, 0, 1] }, undefined)).toBe(first);
  });

  it('misses on an equal-content but newly allocated vertexWidths array', () => {
    const path = rect();
    const widths = [1, 2, 3, 4];
    const first = strokeMesh(path, { ...base, vertexWidths: widths }, undefined);
    expect(strokeMesh(path, { ...base, vertexWidths: widths }, undefined)).toBe(first);
    expect(strokeMesh(path, { ...base, vertexWidths: [1, 2, 3, 4] }, undefined)).not.toBe(first);
  });

  it('misses on a different Path object with equal coords', () => {
    const first = strokeMesh(rect(), base, undefined);
    expect(strokeMesh(rect(), base, undefined)).not.toBe(first);
  });

  it('keys on flattenTolerance', () => {
    const path = rect();
    const first = strokeMesh(path, base, undefined);
    const coarse = strokeMesh(path, base, 0.1);
    expect(coarse).not.toBe(first);
    expect(strokeMesh(path, base, 0.1)).toBe(coarse);
  });

  it('drops a path\'s configurations wholesale past the cap', () => {
    const path = rect();
    const first = strokeMesh(path, { ...base, width: 1 }, undefined);
    for (let i = 1; i < STROKE_CONFIGS_PER_PATH; i++) {
      strokeMesh(path, { ...base, width: i + 1 }, undefined);
    }
    expect(strokeMesh(path, { ...base, width: 1 }, undefined)).toBe(first);
    // The (cap + 1)th distinct configuration clears the map before storing.
    strokeMesh(path, { ...base, width: STROKE_CONFIGS_PER_PATH + 1 }, undefined);
    expect(strokeMesh(path, { ...base, width: 1 }, undefined)).not.toBe(first);
  });

  it('a churning vertexWidths array replaces one entry instead of evicting the rest', () => {
    const path = rect();
    const first = strokeMesh(path, { ...base, width: 7 }, undefined);
    // Every iteration is a reference miss on the *same* key, so the map never
    // grows and the unrelated width-7 entry must survive all of it.
    for (let i = 0; i < STROKE_CONFIGS_PER_PATH * 3; i++) {
      strokeMesh(path, { ...base, vertexWidths: [i, i] }, undefined);
    }
    expect(strokeMesh(path, { ...base, width: 7 }, undefined)).toBe(first);
  });

  it('returns an empty mesh for a zero-width stroke without throwing', () => {
    const poly: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([0, 1]),
      coords: new Float32Array([0, 0, 10, 0]),
      fillRule: 'nonzero',
    };
    expect(strokeMesh(poly, { ...base, width: 0 }, undefined).indices.length).toBe(0);
  });
});
