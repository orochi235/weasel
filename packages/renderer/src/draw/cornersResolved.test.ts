import { describe, expect, it } from 'vitest';
import { PathBuilder, withCorner, type PolygonPath } from '@weasel-js/geom';
import type { PathDrawCommand } from '../DrawCommand';
import { strokeMesh } from '../cache/strokeMeshCache';
import { withCornersResolved } from './cornersResolved';

const path = withCorner(
  new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).build() as PolygonPath,
  1, { shape: 'round', radius: 20 },
);
const cmd = {
  kind: 'path',
  path,
  stroke: { paint: { color: '#000' }, width: 4, vertexWidths: [2, 2, 10], vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1] },
} as unknown as PathDrawCommand;

describe('withCornersResolved', () => {
  it('hands back the same per-anchor arrays every frame, so the stroke ribbon cache hits', () => {
    const first = withCornersResolved(cmd);
    const second = withCornersResolved(cmd);
    expect(second.stroke!.vertexWidths).toBe(first.stroke!.vertexWidths);
    expect(second.stroke!.vertexColors).toBe(first.stroke!.vertexColors);
    expect(strokeMesh(second.path, second.stroke!, undefined)).toBe(strokeMesh(first.path, first.stroke!, undefined));
  });
});
