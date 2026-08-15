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

  it('misses on first sight and hits on the second, returning the same Mesh', () => {
    const path = rect();
    const first = strokeMesh(path, base, undefined);
    const second = strokeMesh(path, base, undefined);
    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(second.mesh).toBe(first.mesh);
  });

  it('misses when a geometry-affecting parameter changes', () => {
    const path = rect();
    strokeMesh(path, base, undefined);
    expect(strokeMesh(path, { ...base, width: 4 }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, cap: 'round' }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, join: 'bevel' }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, miterLimit: 2 }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, align: 'inner' }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, dash: [2, 2] }, undefined).hit).toBe(false);
  });

  it('hits when only paint changes — colors are not geometry', () => {
    const path = rect();
    strokeMesh(path, base, undefined);
    const again = strokeMesh(path, { ...base, paint: { color: '#ff0000' } }, undefined);
    expect(again.hit).toBe(true);
  });

  it('hits when only vertexColors change', () => {
    const path = rect();
    strokeMesh(path, base, undefined);
    const withColors = strokeMesh(path, { ...base, vertexColors: [1, 0, 0, 1] }, undefined);
    expect(withColors.hit).toBe(true);
  });

  it('misses on an equal-content but newly allocated vertexWidths array', () => {
    const path = rect();
    const widths = [1, 2, 3, 4];
    strokeMesh(path, { ...base, vertexWidths: widths }, undefined);
    expect(strokeMesh(path, { ...base, vertexWidths: widths }, undefined).hit).toBe(true);
    expect(strokeMesh(path, { ...base, vertexWidths: [1, 2, 3, 4] }, undefined).hit).toBe(false);
  });

  it('misses on a different Path object with equal coords', () => {
    strokeMesh(rect(), base, undefined);
    expect(strokeMesh(rect(), base, undefined).hit).toBe(false);
  });

  it('keys on flattenTolerance', () => {
    const path = rect();
    strokeMesh(path, base, undefined);
    expect(strokeMesh(path, base, 0.1).hit).toBe(false);
    expect(strokeMesh(path, base, 0.1).hit).toBe(true);
  });

  it('drops a path\'s configurations wholesale past the cap', () => {
    const path = rect();
    for (let i = 0; i < STROKE_CONFIGS_PER_PATH; i++) {
      strokeMesh(path, { ...base, width: i + 1 }, undefined);
    }
    expect(strokeMesh(path, { ...base, width: 1 }, undefined).hit).toBe(true);
    // The (cap + 1)th distinct configuration clears the map before storing.
    strokeMesh(path, { ...base, width: STROKE_CONFIGS_PER_PATH + 1 }, undefined);
    expect(strokeMesh(path, { ...base, width: 1 }, undefined).hit).toBe(false);
  });

  it('a churning vertexWidths array replaces one entry instead of evicting the rest', () => {
    const path = rect();
    strokeMesh(path, { ...base, width: 7 }, undefined);
    // Every iteration is a reference miss on the *same* key, so the map never
    // grows and the unrelated width-7 entry must survive all of it.
    for (let i = 0; i < STROKE_CONFIGS_PER_PATH * 3; i++) {
      strokeMesh(path, { ...base, vertexWidths: [i, i] }, undefined);
    }
    expect(strokeMesh(path, { ...base, width: 7 }, undefined).hit).toBe(true);
  });

  it('returns an empty mesh for a zero-width stroke without throwing', () => {
    const poly: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([0, 1]),
      coords: new Float32Array([0, 0, 10, 0]),
      fillRule: 'nonzero',
    };
    const { mesh } = strokeMesh(poly, { ...base, width: 0 }, undefined);
    expect(mesh.indices.length).toBe(0);
  });
});
