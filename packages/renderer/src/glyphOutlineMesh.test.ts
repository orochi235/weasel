import { describe, it, expect, beforeEach } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import type { LaidOutGroup } from '@weasel-js/text';
import { outlineGroupStrokeMesh } from './glyphOutlineMesh';
import { _resetOutlineStrokeMeshCacheForTests } from './cache/outlineStrokeMeshCache';
import { mat3 } from '@weasel-js/geom';

const SQUARE = 'M0 -0.5L0.5 -0.5L0.5 0L0 0Z';

function extent(stroke: Stroke, scale = 100): [number, number, number, number] {
  const group = {
    family: 'squares', weight: 400, style: 'normal', synthetic: { bold: false, italic: false },
    source: 'outline', page: 0, fill: null, quadData: [], quads: [],
    stroke: { paint: { kind: 'solid', color: '#000' }, ...stroke },
    glyphs: [{ d: SQUARE, key: `stroke-lengths-${scale}`, x: 0, baselineY: 0, scale }],
  } as unknown as LaidOutGroup;
  const mesh = outlineGroupStrokeMesh(group, 0, 0, mat3.identity())!;
  const xs: number[] = [], ys: number[] = [];
  for (let k = 0; k < mesh.vertices.length; k += 2) { xs.push(mesh.vertices[k]); ys.push(mesh.vertices[k + 1]); }
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map((n) => Math.round(n * 1e3) / 1e3) as never;
}

describe('glyph outline stroke lengths', () => {
  beforeEach(() => _resetOutlineStrokeMeshCacheForTests());

  it('reads vertexWidths in world units, as it reads width', () => {
    // `width` is quantized in em and `vertexWidths` are not, hence the tolerance.
    for (const scale of [100, 50]) {
      const tapered = extent({ width: 1, vertexWidths: [4, 4, 4, 4, 4] }, scale);
      extent({ width: 4 }, scale).forEach((v, k) => expect(tapered[k]).toBeCloseTo(v, 1));
    }
  });

  it('reads a trim edge given as a length in world units', () => {
    // The square is 50 world units a side, so 50 along it is a quarter of the way round.
    expect(extent({ width: 2, trim: { end: { length: 50 } } })).toEqual(extent({ width: 2, trim: { end: 0.25 } }));
  });
});
