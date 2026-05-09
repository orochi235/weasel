import { describe, it, expect } from 'vitest';
import {
  PATH_M, PATH_L,
  type PolygonPath,
  type RectPath,
  type Stroke,
} from '@orochi235/weasel';
import { tessellateStroke } from './stroke';

describe('tessellateStroke (straight, butt, no joins)', () => {
  it('expands a rect outline into a ribbon mesh', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const stroke: Stroke = { paint: { color: '#000' }, width: 4, cap: 'butt', join: 'bevel' };
    const mesh = tessellateStroke(path, stroke);
    expect(mesh.vertices.length).toBeGreaterThanOrEqual(16);
    expect(mesh.indices.length).toBeGreaterThanOrEqual(24);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('produces an empty mesh for a stroke with width 0', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const stroke: Stroke = { paint: { color: '#000' }, width: 0 };
    const mesh = tessellateStroke(path, stroke);
    expect(mesh.indices.length).toBe(0);
  });

  it('uses default width 1 when omitted', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const meshDefault = tessellateStroke(path, { paint: { color: '#000' } });
    const meshExplicit = tessellateStroke(path, { paint: { color: '#000' }, width: 1 });
    expect(meshDefault.indices.length).toBe(meshExplicit.indices.length);
  });
});

describe('tessellateStroke joins', () => {
  it('inserts a bevel triangle between two segments at a corner', () => {
    // Open polyline: (0,0) → (10,0) → (10,10). One corner.
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10]),
      fillRule: 'nonzero',
    };
    const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'bevel' });
    // 2 ribbon segments × 2 triangles + 1 bevel triangle = 5 triangles → 15 indices.
    expect(mesh.indices.length).toBe(15);
  });
});
