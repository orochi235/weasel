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
