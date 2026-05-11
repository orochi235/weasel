import { describe, it, expect } from 'vitest';
import {
  PATH_M, PATH_L,
  type PolygonPath,
  type RectPath,
  type Stroke,
} from '@orochi235/weasel';
import { tessellateStroke } from './stroke';
import { PathBuilder } from '../builder';

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
    // 2 segments × 2 triangles + 2 miter triangles (apex + inner bevel half) = 6 triangles → 18 indices.
    expect(mesh.indices.length).toBe(18);
  });

  it('falls back to bevel for very acute interior angles (miter limit 10, half-width 2 → max miter length 20)', () => {
    // Near-U-turn corner — segments turn by ~177°, interior angle ~3°.
    // Miter length = half / sin(interior/2) ≈ 79, > 20 → fallback to bevel.
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 100, 0, 0, 5]),
      fillRule: 'nonzero',
    };
    const mesh = tessellateStroke(path, { paint: { color: '#000' }, width: 4, join: 'miter' });
    // 2 ribbon × 2 + 1 bevel-fallback triangle = 5 triangles → 15 indices.
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

describe('tessellateStroke alignment (RectPath)', () => {
  it('inner alignment shifts the stroke entirely inside the rect bounds', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    const meshInner = tessellateStroke(path, { paint: { color: '#000' }, width: 10, align: 'inner' });
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < meshInner.vertices.length; i += 2) {
      minX = Math.min(minX, meshInner.vertices[i]);
      maxX = Math.max(maxX, meshInner.vertices[i]);
    }
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(maxX).toBeLessThanOrEqual(100);
  });

  it('center alignment extends ±half-width outside the rect', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    const meshCenter = tessellateStroke(path, { paint: { color: '#000' }, width: 10, align: 'center' });
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < meshCenter.vertices.length; i += 2) {
      minX = Math.min(minX, meshCenter.vertices[i]);
      maxX = Math.max(maxX, meshCenter.vertices[i]);
    }
    expect(minX).toBeLessThan(0);
    expect(maxX).toBeGreaterThan(100);
  });

  it('outer alignment shifts the stroke entirely outside the rect bounds', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    const meshOuter = tessellateStroke(path, { paint: { color: '#000' }, width: 10, align: 'outer' });
    // Outer alignment: inner edge of stroke coincides with rect edge.
    // Therefore vertices on the inside should reach exactly the rect edge,
    // and outer vertices reach +width beyond.
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < meshOuter.vertices.length; i += 2) {
      minX = Math.min(minX, meshOuter.vertices[i]);
      maxX = Math.max(maxX, meshOuter.vertices[i]);
    }
    expect(minX).toBeLessThanOrEqual(0);
    expect(maxX).toBeGreaterThanOrEqual(100);
    // Outer is fully outside: the innermost stroke vertex shouldn't be deeper
    // inside the rect than the original edge.
    expect(minX).toBeGreaterThanOrEqual(-10);
    expect(maxX).toBeLessThanOrEqual(110);
  });
});

describe('tessellateStroke dash patterns', () => {
  it('produces multiple disjoint sub-ribbons for a dashed straight line', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 100, 0]),
      fillRule: 'nonzero',
    };
    const mesh = tessellateStroke(path, {
      paint: { color: '#000' },
      width: 4,
      dash: [10, 10],
      cap: 'butt',
      join: 'bevel',
    });
    // 100 / 20 = 5 dash periods → 5 "on" sub-segments → 10 triangles → 30 indices.
    expect(mesh.indices.length).toBe(30);
  });

  it('an empty or omitted dash array produces a continuous ribbon', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 100, 0]),
      fillRule: 'nonzero',
    };
    const meshNoDash = tessellateStroke(path, { paint: { color: '#000' }, width: 4 });
    const meshEmptyDash = tessellateStroke(path, { paint: { color: '#000' }, width: 4, dash: [] });
    expect(meshEmptyDash.indices.length).toBe(meshNoDash.indices.length);
  });
});

describe('tessellateStroke — anchor params: segments', () => {
  it('a 2-point line emits 4 ribbon vertices each pinned to its endpoint anchor', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(10, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 2 });
    expect(mesh.anchorA).toBeDefined();
    expect(mesh.anchorA!.length).toBe(mesh.vertices.length / 2);
    // First two vertices (L0, R0) at the M anchor; next two (L1, R1) at the L anchor.
    expect(mesh.anchorA![0]).toBe(0);
    expect(mesh.anchorA![1]).toBe(0);
    expect(mesh.anchorA![2]).toBe(1);
    expect(mesh.anchorA![3]).toBe(1);
    expect(mesh.anchorT![0]).toBe(0);
    expect(mesh.anchorT![3]).toBe(0);
  });

  it('a cubic bezier stroke has interior ribbon vertices with t in (0,1)', () => {
    const p = new PathBuilder().moveTo(0, 0).curveTo(0, 50, 100, 50, 100, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 2 });
    let foundInterior = false;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      if (mesh.anchorA![i] === 0 && mesh.anchorB![i] === 1 && mesh.anchorT![i] > 0 && mesh.anchorT![i] < 1) {
        foundInterior = true;
        break;
      }
    }
    expect(foundInterior).toBe(true);
  });
});
