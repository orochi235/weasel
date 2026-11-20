import { describe, it, expect } from 'vitest';
import { nonzeroContours, resolveEvenOdd, type FlattenedContours } from './crossings';

const contours = (...rings: number[][]): FlattenedContours => {
  const flat: FlattenedContours = { coords: [], contourStarts: [], anchorA: [], anchorB: [], anchorT: [] };
  for (const ring of rings) {
    flat.contourStarts.push(flat.coords.length / 2);
    flat.coords.push(...ring);
    for (let i = 0; i < ring.length / 2; i++) {
      flat.anchorA.push(0);
      flat.anchorB.push(0);
      flat.anchorT.push(0);
    }
  }
  return flat;
};

/** Area where `filled` holds of the winding number, sampled on a grid. */
const sampledArea = (flat: FlattenedContours, filled: (w: number) => boolean, size: number, n: number): number => {
  const { coords, contourStarts } = flat;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = ((i + 0.5) / n) * size, y = ((j + 0.5) / n) * size;
      let w = 0;
      contourStarts.forEach((start, c) => {
        const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : coords.length / 2;
        for (let k = start; k < end; k++) {
          const l = k + 1 < end ? k + 1 : start;
          const [px, py, qx, qy] = [coords[k * 2], coords[k * 2 + 1], coords[l * 2], coords[l * 2 + 1]];
          const side = (qx - px) * (y - py) - (x - px) * (qy - py);
          if (py <= y && qy > y && side > 0) w++;
          else if (qy <= y && py > y && side < 0) w--;
        }
      });
      if (filled(w)) hits++;
    }
  }
  return (hits / (n * n)) * size * size;
};

const signedArea = (flat: FlattenedContours): number => {
  const { coords, contourStarts } = flat;
  let sum = 0;
  contourStarts.forEach((start, c) => {
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : coords.length / 2;
    for (let k = start; k < end; k++) {
      const l = k + 1 < end ? k + 1 : start;
      sum += coords[k * 2] * coords[l * 2 + 1] - coords[l * 2] * coords[k * 2 + 1];
    }
  });
  return sum / 2;
};

describe('resolving crossings', () => {
  // Outlines with a spike (two edges doubling back at a hair's angle) and three
  // edges crossing nearly at one point: each leaves a sliver of the fill
  // narrower than any fixed probe distance off a boundary piece.
  const slivers = [
    contours([133, 42, 559, 843, 587, 50, 853, 897], [718, 703, 180, 39, 819, 466, 886, 554, 205, 871, 122, 130]),
    contours(
      [40, 9, 681, 430, 415, 68, 997, 860, 326, 520, 885, 570, 902, 187, 198, 17],
      [382, 104, 615, 635, 971, 713, 833, 418, 326, 792, 973, 196],
    ),
  ];

  it('closes every boundary loop around a sliver', () => {
    for (const flat of slivers) {
      const nonzero = nonzeroContours(flat).contours;
      expect(Math.abs(signedArea(nonzero))).toBeCloseTo(sampledArea(flat, (w) => w !== 0, 1000, 400), -3);
      const evenOdd = resolveEvenOdd(flat);
      expect(evenOdd).not.toBeNull();
      expect(Math.abs(signedArea(evenOdd!))).toBeCloseTo(sampledArea(flat, (w) => (w & 1) !== 0, 1000, 400), -3);
    }
  });
});
