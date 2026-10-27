import { describe, it, expect } from 'vitest';
import { boundsOfPath, PathBuilder } from '@weasel-js/geom';
import { tessellateStroke } from './tessellate/stroke';
import { markerHeads } from './markerHeads';
import { strokeToPath } from './strokeToPath';

const FAR = 262_144;
const INK = { kind: 'solid', color: '#000' } as const;
/** A horizontal line from `FAR + 0.3` to `FAR + 10.3`, measured from `(FAR, 0)`. */
const line = () => new PathBuilder().setOrigin(FAR, 0).moveTo(FAR + 0.3, 5).lineTo(FAR + 10.3, 5).build();

describe('stroking a path measured from an origin', () => {
  it('builds the ribbon in its offsets and hands the mesh the origin', () => {
    const mesh = tessellateStroke(line(), { paint: INK, width: 2 });
    expect(mesh.origin).toEqual({ x: FAR, y: 0 });
    const xs = Array.from(mesh.vertices).filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeCloseTo(0.3, 5);
  });

  it('places a marker head on the line, not at the offsets read as world', () => {
    const [head] = markerHeads(line(), { paint: INK, width: 2, markerEnd: 'dot' }, 2, undefined);
    const b = boundsOfPath(head.path);
    expect(b.x + b.width / 2 - FAR).toBeCloseTo(10.3, 4);
    expect(b.y + b.height / 2).toBeCloseTo(5, 4);
  });

  it('outlines the stroke where the line is', () => {
    const b = boundsOfPath(strokeToPath(line(), { paint: INK, width: 2 }));
    expect(b.x - FAR).toBeCloseTo(0.3, 4);
    expect(b.y).toBeCloseTo(4, 4);
    expect(b.width).toBeCloseTo(10, 4);
  });
});
