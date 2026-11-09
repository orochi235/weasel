import { describe, expect, it } from 'vitest';
import { countPathAnchors, PathBuilder } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import type { SceneNode } from '@weasel-js/core';
import { widthPointNear, type WidthTarget } from './widthEdit';

describe('widthPointNear', () => {
  it('finds a width point set after a subpath a line opens past close()', () => {
    // The second triangle has no moveTo of its own: it starts where the first closed.
    const path = new PathBuilder()
      .moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).close()
      .lineTo(-100, 0).lineTo(-100, -100)
      .build();
    const widths: number[] = new Array(countPathAnchors(path)).fill(NaN);
    widths[widths.length - 1] = 20;
    const stroke: Stroke = { paint: { color: '#000' }, width: 4, vertexWidths: widths };
    const node = {} as SceneNode<unknown, string, unknown>;
    const target: WidthTarget = {
      id: 'p' as WidthTarget['id'], node, shown: node, local: (pose) => pose, path, stroke, fallback: 4,
    };
    expect(widthPointNear(target, -104, -100, 2)).toBe(widths.length - 1);
  });
});
