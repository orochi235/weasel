import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathFromD } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { markerHeads, markerPlacementMap, markerPlacements, markerShape } from './markerHeads';

const INK = { kind: 'solid', color: '#000' } as const;
/** A symmetric chevron: its one interior vertex is also its arc-length midpoint. */
const CHEVRON = pathFromD('M0 22 L75 0 L150 22');

const midHead = (stroke: Stroke) => {
  const heads = markerHeads(CHEVRON, stroke, stroke.width as number, undefined);
  expect(heads).toHaveLength(1);
  return heads[0];
};

describe('markerHeads at an interior vertex', () => {
  it('puts a terminator head\'s leading edge on the vertex, trailing back along the bisector', () => {
    const b = boundsOfPath(midHead({ paint: INK, width: 3, markerMid: 'diamond' }).path);
    expect(b.x + b.width).toBeCloseTo(75, 4);
    expect(b.x).toBeCloseTo(75 - 4 * 3, 4);
    expect(b.y + b.height / 2).toBeCloseTo(0, 4);
  });

  it('centers the dot on the vertex', () => {
    const b = boundsOfPath(midHead({ paint: INK, width: 3, markerMid: 'dot' }).path);
    expect(b.x + b.width / 2).toBeCloseTo(75, 4);
    expect(b.y + b.height / 2).toBeCloseTo(0, 4);
  });
});

describe('markerPlacements', () => {
  // A renderer draws the unplaced shape under this map rather than building the placed head.
  it('maps each head\'s shape onto the points markerHeads places', () => {
    const path = pathFromD('M 3 4 C 40 -20 90 60 140 10 L 160 40');
    const stroke: Stroke = { paint: INK, width: 3, markerStart: 'dot', markerMid: 'diamond', markerEnd: 'arrow', trim: { start: 0.2, end: 0.7 } };
    const space = { metric: { p: 1.25, q: 0.3, r: (1 + 0.09) / 1.25 }, pxPerUnit: 2 };
    for (const spaces of [{}, { end: space, mid: space }]) {
      const heads = markerHeads(path, stroke, 3, undefined, spaces);
      const placements = markerPlacements(path, stroke, 3, undefined, spaces);
      expect(placements).toHaveLength(heads.length);
      placements.forEach((at, i) => {
        const [a, b, c, d, tx, ty] = markerPlacementMap(at);
        const shape = markerShape(at.entry, at.size, stroke).coords;
        const want = heads[i].path.coords;
        for (let k = 0; k < shape.length; k += 2) {
          expect(a * shape[k] + c * shape[k + 1] + tx).toBeCloseTo(want[k], 3);
          expect(b * shape[k] + d * shape[k + 1] + ty).toBeCloseTo(want[k + 1], 3);
        }
      });
    }
  });
});
