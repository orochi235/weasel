/** Counterexamples the bounds property shrank to, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import { strokeMesh } from './cache/strokeMeshCache';
import { pathBox } from './paintedBounds';
import { resolveStrokeLengths, type StrokedPathCommand } from './strokeLengths';

describe('pathBox, shrunk', () => {
  it('holds a { px } stroke with per-vertex widths on a rect under a transform stretching one axis', () => {
    const m = mat3.fromAffine([1, 0, 0, 58.29415347136074, 0, 0]);
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 0, height: 0 };
    const stroke = { width: { px: 0.5 }, align: 'outer' as const, vertexWidths: [0.08579482089670921, 0] };
    const cmd = { kind: 'path', path, stroke: { ...stroke, paint: { kind: 'solid', color: '#000' } } } as StrokedPathCommand;
    const { cmd: resolved, spaces } = resolveStrokeLengths(m, cmd);
    const box = pathBox(path, stroke, m)!;
    const v = strokeMesh(path, resolved.stroke, undefined, spaces).vertices;
    for (let i = 0; i < v.length; i += 2) {
      const [x, y] = mat3.apply(m, v[i]!, v[i + 1]!);
      expect(x).toBeGreaterThanOrEqual(box.minX);
      expect(x).toBeLessThanOrEqual(box.maxX);
      expect(y).toBeGreaterThanOrEqual(box.minY);
      expect(y).toBeLessThanOrEqual(box.maxY);
    }
  });

  it('holds a { px } stroke\'s per-vertex widths under a transform shrinking one axis 86 times', () => {
    const m = mat3.fromAffine([86.59643233600653, 0, -0.78125, 1, 0, 0]);
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 0, height: -0.125 };
    const stroke = { width: { px: 0.5 }, align: 'inner' as const, vertexWidths: [0.047859812915626236, 0] };
    const cmd = { kind: 'path', path, stroke: { ...stroke, paint: { kind: 'solid', color: '#000' } } } as StrokedPathCommand;
    const { cmd: c, spaces } = resolveStrokeLengths(m, cmd);
    // Too thin a rect for an inner stroke to shift: the renderer cuts a centered ribbon twice as wide.
    const doubled = { ...c.stroke, width: (c.stroke.width as number) * 2, align: 'center' as const, vertexWidths: stroke.vertexWidths.map((w) => w * 2) };
    const box = pathBox(path, stroke, m)!;
    const v = strokeMesh(path, doubled, undefined, spaces).vertices;
    for (let i = 0; i < v.length; i += 2) {
      const [x, y] = mat3.apply(m, v[i]!, v[i + 1]!);
      expect(x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY, `${x}, ${y}`).toBe(true);
    }
  });
});
