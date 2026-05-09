import { describe, it, expect } from 'vitest';
import type { RectPath } from '@orochi235/weasel';
import {
  PATH_M,
  PATH_L,
  PATH_Z,
  type PolygonPath,
} from '@orochi235/weasel';
import { tessellate } from './tessellate';

describe('tessellate (RectPath)', () => {
  it('emits 4 vertices and 2 triangles for a rect', () => {
    const path: RectPath = { kind: 'rect', x: 10, y: 20, width: 100, height: 50 };
    const mesh = tessellate(path);
    expect(Array.from(mesh.vertices)).toEqual([
      10, 20,
      110, 20,
      110, 70,
      10, 70,
    ]);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(mesh.requiresStencil).toBeFalsy();
  });

  it('handles negative width/height by emitting the rect as-is (caller responsibility to normalize)', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: -10, height: -10 };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(8);
    expect(mesh.indices.length).toBe(6);
  });
});

describe('tessellate (PolygonPath, single-contour, no curves)', () => {
  it('triangulates a square via M/L/L/L/Z', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(8);
    expect(mesh.indices.length).toBe(6);
    expect(mesh.requiresStencil).toBeFalsy();
  });

  it('triangulates a concave hexagon (arrowhead)', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 5, 0, 10, 2, 5]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(8);
    expect(mesh.indices.length).toBe(6);
  });

  it('triangulates a 100-vertex blob without throwing', () => {
    const verts: number[] = [];
    const cmds: number[] = [PATH_M];
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * Math.PI * 2;
      const r = 100 + (i % 5);
      verts.push(Math.cos(a) * r, Math.sin(a) * r);
      if (i > 0) cmds.push(PATH_L);
    }
    cmds.push(PATH_Z);
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(verts),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(200);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.indices.length).toBe(294);
  });
});

import { PATH_Q as PQ, PATH_C as PC, DEFAULT_FLATTEN_TOLERANCE } from '@orochi235/weasel';

describe('tessellate (PolygonPath, bezier curves)', () => {
  it('flattens a quadratic and triangulates the resulting polyline', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBeGreaterThanOrEqual(6);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('flattens a cubic and triangulates', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PC, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 0, 10, 10, 10, 10, 0, 5, -5]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBeGreaterThan(8);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('emits more vertices when given a tighter tolerance (more subdivision)', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 50, 100, 100, 0]),
      fillRule: 'nonzero',
    };
    const looseMesh = tessellate(path, { flattenTolerance: 5 });
    const tightMesh = tessellate(path, { flattenTolerance: 0.05 });
    expect(tightMesh.vertices.length).toBeGreaterThan(looseMesh.vertices.length);
  });

  it('uses DEFAULT_FLATTEN_TOLERANCE when no option passed', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const a = tessellate(path);
    const b = tessellate(path, { flattenTolerance: DEFAULT_FLATTEN_TOLERANCE });
    expect(a.vertices.length).toBe(b.vertices.length);
  });
});

describe('tessellate (PolygonPath, evenodd)', () => {
  it('emits requiresStencil: true and a naive fan per contour for evenodd', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'evenodd',
    };
    const mesh = tessellate(path);
    expect(mesh.requiresStencil).toBe(true);
    expect(mesh.vertices.length).toBe(8);
    expect(mesh.indices.length).toBe(6);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('emits separate fans per contour with continuous indexing for multi-contour evenodd', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,
        3, 3, 7, 3, 7, 7, 3, 7,
      ]),
      fillRule: 'evenodd',
    };
    const mesh = tessellate(path);
    expect(mesh.requiresStencil).toBe(true);
    expect(mesh.vertices.length).toBe(16);
    expect(mesh.indices.length).toBe(12);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  });

  it('does not set requiresStencil for nonzero (uses earcut)', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.requiresStencil).toBeFalsy();
  });
});

describe('tessellate (PolygonPath, multi-contour, nonzero)', () => {
  it('triangulates a 10×10 outer square with a 4×4 inner hole (counter-wound)', () => {
    // Outer CCW: (0,0) (10,0) (10,10) (0,10)
    // Inner CW (hole): (3,3) (3,7) (7,7) (7,3)
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,         // outer
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,         // hole
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,                     // outer (CCW)
        3, 3, 3, 7, 7, 7, 7, 3,                         // hole  (CW)
      ]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    // 8 vertices total (4 outer + 4 hole), 8 triangles around the hole.
    expect(mesh.vertices.length).toBe(16);
    expect(mesh.indices.length).toBe(24);                // earcut emits 8 triangles for this case
  });
});
