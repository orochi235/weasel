import { describe, it, expect } from 'vitest';
import { PATH_CMD_LENGTHS as GEOM_PATH_CMD_LENGTHS } from '@weasel-js/geom';
import { PATH_CMD_LENGTHS, PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, type PolygonPath } from './types';
import { translatePath, translatePolygonInPlace } from './transform';
import { rotatePathAround } from './poseRotation';
import { pathPoseDescriptor } from './poseDescriptor';

/** One command of every code the table declares, with distinct nonzero coords. */
function pathOverEveryCommand(): PolygonPath {
  const commands = Uint8Array.from(GEOM_PATH_CMD_LENGTHS, (_, code) => code);
  const total = GEOM_PATH_CMD_LENGTHS.reduce((a, b) => a + b, 0);
  const coords = Float32Array.from({ length: total }, (_, i) => i + 1);
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

describe('path opcode table', () => {
  it('is one table — core reads geom\'s, it does not keep a copy', () => {
    expect(PATH_CMD_LENGTHS).toBe(GEOM_PATH_CMD_LENGTHS);
    expect([PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z]).toEqual([0, 1, 2, 3, 4]);
  });

  // The failure this guards: a sixth opcode added in one package leaves every
  // other walker misreading the coord stream from that command on.
  it('every path walker picks up an opcode added to the table', () => {
    const lengths = GEOM_PATH_CMD_LENGTHS as number[];
    const before = lengths.length;
    lengths.push(8);
    try {
      const path = pathOverEveryCommand();
      const source = [...path.coords];
      expect(source).toHaveLength(22); // 2+2+6+4+0 + the added 8

      const moved = translatePath(path, 3, 5) as PolygonPath;
      expect([...moved.coords]).toEqual(source.map((v, i) => v + (i % 2 ? 5 : 3)));

      const inPlace = translatePolygonInPlace(pathOverEveryCommand(), 3, 5);
      expect([...inPlace.coords]).toEqual(source.map((v, i) => v + (i % 2 ? 5 : 3)));

      const rotated = rotatePathAround(path, 0, 0, 0);
      expect([...rotated.coords]).toEqual(source);

      const remapped = pathPoseDescriptor.remapBounds(
        path,
        { x: 0, y: 0, width: 1, height: 1 },
        { x: 10, y: 20, width: 1, height: 1 },
      ) as PolygonPath;
      expect([...remapped.coords]).toEqual(source.map((v, i) => v + (i % 2 ? 20 : 10)));
    } finally {
      lengths.length = before;
    }
  });
});
