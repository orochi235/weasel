import { polylineFromPoints } from '@weasel-js/geom';
import { describe, expect, it } from 'vitest';
import { labelCenter, labelSpotAt } from './station';

const SIZE = { width: 40, height: 12 };
const straight = polylineFromPoints([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
const elbow = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);

function roundTrips(path: typeof straight, at: number, offset: number) {
  const center = labelCenter(path, { at, offset }, SIZE)!;
  const spot = labelSpotAt(path, center, SIZE)!;
  expect(spot.at).toBeCloseTo(at, 6);
  expect(spot.offset).toBeCloseTo(offset, 6);
}

describe('labelSpotAt', () => {
  it.each([[0.25, 0], [0.8, 30], [0.1, -22]])('round-trips labelCenter at %s, offset %s', (at, offset) => {
    for (const path of [straight, elbow]) roundTrips(path, at, offset);
  });

  // The elbow's corner is at 0.5, where the normal is ambiguous.
  it.each([[0.5, 9], [0.5, -9]])('round-trips labelCenter on the straight route at %s, offset %s', (at, offset) => {
    roundTrips(straight, at, offset);
  });

  it.each([[0.3, -9], [0.7, 9]])('round-trips labelCenter on the elbow at %s, offset %s', (at, offset) => {
    roundTrips(elbow, at, offset);
  });

  // Outside a corner the vertex is nearest every point, and each leg reads an offset along its own normal.
  it.each([[{ x: 100, y: -30 }], [{ x: 130, y: 0 }]])('round-trips a center on a corner normal, %o', (c) => {
    const back = labelCenter(elbow, labelSpotAt(elbow, c, SIZE)!, SIZE)!;
    expect(back.x).toBeCloseTo(c.x, 6);
    expect(back.y).toBeCloseTo(c.y, 6);
  });

  it.each([
    [{ x: 130, y: -30 }, { x: 100, y: -30 }],
    [{ x: 140, y: -20 }, { x: 140, y: 0 }],
  ])('keeps a center outside the corner, %o, on the leg nearer it', (c, expected) => {
    const spot = labelSpotAt(elbow, c, SIZE)!;
    const back = labelCenter(elbow, spot, SIZE)!;
    expect(back.x).toBeCloseTo(expected.x, 6);
    expect(back.y).toBeCloseTo(expected.y, 6);
    const again = labelSpotAt(elbow, back, SIZE)!;
    expect(again.at).toBeCloseTo(spot.at, 9);
    expect(again.offset).toBeCloseTo(spot.offset, 6);
  });

  it('puts a center dragged below a rightward edge on its right, offset negative', () => {
    expect(labelSpotAt(straight, { x: 100, y: 40 }, SIZE)).toEqual({ at: 0.5, offset: -34 });
  });

  it('centers a label on the line when its center is within half its depth', () => {
    expect(labelSpotAt(straight, { x: 50, y: 3 }, SIZE)).toEqual({ at: 0.25, offset: 0 });
  });

  it('clamps a center past the end to the end', () => {
    expect(labelSpotAt(straight, { x: 260, y: -6 }, SIZE)!.at).toBe(1);
  });
});
