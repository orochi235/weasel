import { describe, expect, it } from 'vitest';
import { PATH_L, PATH_M, PATH_Z, pathContainsPoint, type PolygonPath } from '@weasel-js/geom';
import { derivedPartsOf, pathFromParts } from './derivedParts';

/** Closed square contours, all wound the same way, under `fillRule`. */
function squares(fillRule: 'nonzero' | 'evenodd', ...boxes: [number, number, number][]): PolygonPath {
  const commands: number[] = [];
  const coords: number[] = [];
  for (const [x, y, s] of boxes) {
    commands.push(PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z);
    coords.push(x, y, x + s, y, x + s, y + s, x, y + s);
  }
  return { kind: 'polygon', commands: new Uint8Array(commands), coords: new Float32Array(coords), fillRule };
}

describe('pathFromParts', () => {
  const ring = squares('evenodd', [0, 0, 100], [40, 40, 20]);
  const far = squares('nonzero', [200, 0, 10]);

  it('keeps an evenodd part\'s hole empty in the whole, beside other parts', () => {
    const whole = pathFromParts([{ path: ring }, { path: far }])!;
    expect(pathContainsPoint(ring, 50, 50)).toBe(false);
    expect(pathContainsPoint(whole, 50, 50)).toBe(false);
    expect(pathContainsPoint(whole, 10, 10)).toBe(true);
    expect(pathContainsPoint(whole, 205, 5)).toBe(true);
    expect(derivedPartsOf(whole)).toHaveLength(2);
  });

  it('answers the same whatever the part count', () => {
    expect(pathContainsPoint(pathFromParts([{ path: ring }])!, 50, 50)).toBe(false);
    expect(pathContainsPoint(pathFromParts([{ path: ring }, { path: ring }])!, 50, 50)).toBe(false);
  });
});
