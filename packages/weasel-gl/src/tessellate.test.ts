import { describe, it, expect } from 'vitest';
import type { RectPath } from '@orochi235/weasel';
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
