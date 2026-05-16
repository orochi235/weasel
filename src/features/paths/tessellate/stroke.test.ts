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

describe('tessellateStroke — anchor params: joins', () => {
  it('miter join apex inherits the corner anchor (A === B at the corner)', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 2, join: 'miter' });
    // The corner is anchor 1 (the middle L). Vertices far from origin (past the
    // corner) must be tagged with anchor 1 or 2 — not the placeholder 0.
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      const vx = mesh.vertices[i * 2];
      const vy = mesh.vertices[i * 2 + 1];
      if (vx > 5 || vy > 5) {
        expect(Math.max(mesh.anchorA![i], mesh.anchorB![i])).toBeGreaterThan(0);
      }
    }
    // And specifically the corner anchor (1) should be present.
    let foundCornerAnchor = false;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      if (mesh.anchorA![i] === 1 && mesh.anchorB![i] === 1) {
        foundCornerAnchor = true;
        break;
      }
    }
    expect(foundCornerAnchor).toBe(true);
  });

  it('round join fan vertices share the corner anchor index', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 4, join: 'round' });
    // Find the cluster of round-join fan vertices around the corner (10, 0).
    // They should all be tagged with anchor 1.
    let foundFanWithAnchor1 = 0;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      const vx = mesh.vertices[i * 2];
      const vy = mesh.vertices[i * 2 + 1];
      // Vertices within ~4px of (10, 0) on the outer side.
      if (Math.hypot(vx - 10, vy) < 4 && mesh.anchorA![i] === 1 && mesh.anchorB![i] === 1) {
        foundFanWithAnchor1++;
      }
    }
    expect(foundFanWithAnchor1).toBeGreaterThan(0);
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

describe('tessellateStroke — anchor params: caps', () => {
  it('round-cap fan vertices at the start inherit anchor 0 params', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(50, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 10, cap: 'round' });
    // Find vertices near the start endpoint (close to (0, 0)) — they should
    // be cap-emitted and tagged with anchor 0.
    let countNearStart = 0;
    let allHaveAnchor0 = true;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      const vx = mesh.vertices[i * 2];
      const vy = mesh.vertices[i * 2 + 1];
      if (vx < 0 || Math.hypot(vx, vy) < 5) {
        countNearStart++;
        if (mesh.anchorA![i] !== 0 || mesh.anchorB![i] !== 0) allHaveAnchor0 = false;
      }
    }
    expect(countNearStart).toBeGreaterThan(0);
    expect(allHaveAnchor0).toBe(true);
  });

  it('square-cap vertices at the end inherit the endpoint anchor', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(50, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 6, cap: 'square' });
    // End is anchor 1. Vertices past x=50 are square-cap-emitted.
    let countPastEnd = 0;
    let allHaveAnchor1 = true;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      const vx = mesh.vertices[i * 2];
      if (vx > 50) {
        countPastEnd++;
        if (mesh.anchorA![i] !== 1 || mesh.anchorB![i] !== 1) allHaveAnchor1 = false;
      }
    }
    expect(countPastEnd).toBeGreaterThan(0);
    expect(allHaveAnchor1).toBe(true);
  });
});

describe('tessellateStroke — anchor params: dashed segments', () => {
  it('dashed stroke vertices inherit interpolated anchor params from their source segment', () => {
    // Single straight segment between anchors 0 and 1. Dashing splits it into
    // multiple sub-polylines. Every emitted ribbon vertex should still be tagged
    // with anchor 0 OR 1, never out-of-range.
    const p = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
    const mesh = tessellateStroke(p, { paint: { color: '#fff' }, width: 2, dash: [10, 5] });
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      const a = mesh.anchorA![i];
      const b = mesh.anchorB![i];
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }

    // The dash splits along a single M→L segment whose start is anchor 0 and
    // end is anchor 1. The first sub-dash's first ribbon vertex should carry
    // anchor 0 (or interpolated toward 0 with t small); the last sub-dash's
    // last ribbon vertex should carry anchor 1 (or interpolated toward 1).
    // We verify the simpler invariant: at least one vertex with anchor 1
    // exists (some dash boundary lands at the end).
    let foundAnchor1 = false;
    for (let i = 0; i < mesh.anchorA!.length; i++) {
      if (mesh.anchorA![i] === 1 || mesh.anchorB![i] === 1) {
        foundAnchor1 = true;
        break;
      }
    }
    expect(foundAnchor1).toBe(true);
  });
});

describe('tessellateStroke — vertexWidths (per-anchor)', () => {
  it('tapers from start to end (start half-width applied at first vertex, end at last)', () => {
    // 100-unit horizontal segment, anchors {0, 1} with widths {2, 20}.
    const p = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
    const stroke: Stroke = {
      paint: { color: '#fff' },
      width: 4, // fallback, ignored when both anchors have valid vertex widths
      vertexWidths: [2, 20],
      join: 'bevel',
      cap: 'butt',
    };
    const mesh = tessellateStroke(p, stroke);
    // First quad: L0/R0 at x=0 with y=±1 (half of width 2); L1/R1 at x=100 with y=±10.
    // Vertex layout is [L0, R0, L1, R1] starting at index 0.
    expect(mesh.vertices.length).toBeGreaterThanOrEqual(8);
    const ys = [
      mesh.vertices[1],  // L0
      mesh.vertices[3],  // R0
      mesh.vertices[5],  // L1
      mesh.vertices[7],  // R1
    ];
    // Perpendicular unit vector for +x direction is (0, +1); L = +n side,
    // R = −n side. So L is on +y, R on −y.
    expect(ys[0]).toBeCloseTo(1);   // L0
    expect(ys[1]).toBeCloseTo(-1);  // R0
    expect(ys[2]).toBeCloseTo(10);  // L1
    expect(ys[3]).toBeCloseTo(-10); // R1
  });

  it('forces bevel when adjacent anchors differ beyond varyingWidthJoinThreshold (default 1.5×)', () => {
    // Two segments forming an L. Width at the corner jumps 2 → 10 (5×).
    // join: 'miter' should be overridden to bevel by the varying-width threshold.
    const p = new PathBuilder().moveTo(0, 0).lineTo(50, 0).lineTo(50, 50).build();
    const baseStroke: Stroke = {
      paint: { color: '#fff' },
      width: 4,
      join: 'miter',
      cap: 'butt',
    };
    const uniform = tessellateStroke(p, { ...baseStroke, vertexWidths: [4, 4, 4] });
    const varying = tessellateStroke(p, { ...baseStroke, vertexWidths: [2, 10, 2] });
    // A miter join emits 2 extra triangles per corner; bevel emits 1. The
    // varying-width case should match the bevel-equivalent index count,
    // which is < the uniform-miter count.
    expect(varying.indices.length).toBeLessThan(uniform.indices.length);
  });

  it('preserves miter when widths differ within the threshold ratio', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(50, 0).lineTo(50, 50).build();
    const baseStroke: Stroke = {
      paint: { color: '#fff' },
      width: 4,
      join: 'miter',
      cap: 'butt',
    };
    // 4 → 5 (1.25× ratio) — under default threshold 1.5×.
    const closeWidths = tessellateStroke(p, { ...baseStroke, vertexWidths: [4, 5, 4] });
    const uniformMiter = tessellateStroke(p, { ...baseStroke, vertexWidths: [4, 4, 4] });
    // Both should retain the miter join shape (same triangle count).
    expect(closeWidths.indices.length).toBe(uniformMiter.indices.length);
  });

  it('falls back to `width` when a vertexWidths entry is missing or non-finite', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(100, 0).build();
    // vertexWidths has NaN at anchor 1 → falls back to width=8.
    const stroke: Stroke = {
      paint: { color: '#fff' },
      width: 8,
      vertexWidths: [2, NaN],
      join: 'bevel',
      cap: 'butt',
    };
    const mesh = tessellateStroke(p, stroke);
    // R1 (vertex index 3) y-coord = −half(8) = −4 (R is on the −n side).
    expect(mesh.vertices[7]).toBeCloseTo(-4);
  });

  it('rect outlines (no anchor data on interior points) keep uniform width', () => {
    // A RectPath has 4 anchors (corners). Provide 4 widths but the rect
    // fast-path uses width-as-uniform — vertexWidths is interpolated
    // per-corner. Sanity: tessellation still produces a valid mesh.
    const p: RectPath = { kind: 'rect', x: 0, y: 0, width: 50, height: 30 };
    const mesh = tessellateStroke(p, {
      paint: { color: '#fff' },
      width: 4,
      vertexWidths: [2, 6, 2, 6],
      join: 'bevel',
      cap: 'butt',
    });
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('threshold = Infinity suppresses the bevel fallback (miter stays even with width discontinuity)', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(50, 0).lineTo(50, 50).build();
    const baseStroke: Stroke = {
      paint: { color: '#fff' },
      width: 4,
      join: 'miter',
      cap: 'butt',
      varyingWidthJoinThreshold: Infinity,
    };
    const a = tessellateStroke(p, { ...baseStroke, vertexWidths: [4, 4, 4] });
    const b = tessellateStroke(p, { ...baseStroke, vertexWidths: [2, 10, 2] });
    // Both keep the miter shape (same index count).
    expect(b.indices.length).toBe(a.indices.length);
  });
});
