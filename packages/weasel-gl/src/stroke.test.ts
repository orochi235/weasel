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

  it('extends miter join to the outer apex on a 90° corner', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10]),
      fillRule: 'nonzero',
    };
    const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'miter' });
    // 2 segments × 2 triangles + 1 miter triangle = 5 triangles → 15 indices.
    expect(mesh.indices.length).toBe(15);
  });

  it('falls back to bevel for very acute angles (miter limit 10, half-width 2 → max miter length 20)', () => {
    // ~5° corner: (0, 0) → (100, 0) → (200, -3). Very acute.
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 100, 0, 200, -3]),
      fillRule: 'nonzero',
    };
    const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'miter' });
    // Same triangle count as bevel since fallback kicks in.
    expect(mesh.indices.length).toBe(15);
  });

  it('emits at least 7 fan triangles for a round join on a 90° corner', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10]),
      fillRule: 'nonzero',
    };
    const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'round' });
    expect(mesh.indices.length / 3).toBeGreaterThanOrEqual(4 + 7);
  });
});

describe('tessellateStroke caps', () => {
  it('square caps extend an open polyline by half-width at each end', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0]),
      fillRule: 'nonzero',
    };
    const meshButt = tessellateStroke(path, { paint: { color: '#000' }, width: 4, cap: 'butt' });
    const meshSquare = tessellateStroke(path, { paint: { color: '#000' }, width: 4, cap: 'square' });
    // Square caps add 2 triangles per cap × 2 caps = 4 extra triangles.
    expect(meshSquare.indices.length).toBe(meshButt.indices.length + 4 * 3);
  });

  it('round caps add fan triangles at each endpoint', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0]),
      fillRule: 'nonzero',
    };
    const meshButt = tessellateStroke(path, { paint: { color: '#000' }, width: 4, cap: 'butt' });
    const meshRound = tessellateStroke(path, { paint: { color: '#000' }, width: 4, cap: 'round' });
    // Round caps over 180° at ~10°/step → ~18 fan triangles per cap × 2 caps.
    expect((meshRound.indices.length - meshButt.indices.length) / 3).toBeGreaterThanOrEqual(2 * 14);
  });

  it('caps are NOT emitted on closed polylines', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const meshButt = tessellateStroke(path, { paint: { color: '#000' }, width: 2, cap: 'butt', join: 'bevel' });
    const meshRound = tessellateStroke(path, { paint: { color: '#000' }, width: 2, cap: 'round', join: 'bevel' });
    expect(meshRound.indices.length).toBe(meshButt.indices.length);
  });
});
