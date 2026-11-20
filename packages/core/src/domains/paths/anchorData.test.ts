import { describe, expect, it } from 'vitest';
import { polygonFromPoints, type PolygonPath } from '@weasel-js/geom';
import { anchorDataPatch } from './anchorData';

const before = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]) as PolygonPath;
const after = polygonFromPoints([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]) as PolygonPath;
// An anchor inserted halfway between anchors 0 and 1.
const origins = [{ a: 0, b: 0, t: 0 }, { a: 0, b: 1, t: 0.5 }, { a: 1, b: 1, t: 0 }, { a: 2, b: 2, t: 0 }];
const widthsAfter = (vertexWidths: unknown[]) =>
  (anchorDataPatch({ stroke: { width: 4, vertexWidths } }, before, after, origins).stroke as { vertexWidths: unknown[] })
    .vertexWidths;

describe('anchorDataPatch on stroke widths', () => {
  it('leaves an anchor made between two unset widths unset, so it follows the stroke width', () => {
    expect(widthsAfter([Number.NaN, Number.NaN, 6])).toEqual([Number.NaN, Number.NaN, Number.NaN, 6]);
  });

  it('leaves unset the side neither end sets, and blends the rest against the stroke width', () => {
    expect(widthsAfter([{ left: Number.NaN, right: 3 }, { left: Number.NaN, right: 1 }, 6])[1])
      .toEqual({ left: Number.NaN, right: 2 });
    expect(widthsAfter([8, Number.NaN, 6])[1]).toBe(6);
  });
});
