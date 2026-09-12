import { describe, it, expect } from 'vitest';
import { PATH_COMMANDS, PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS, pathCommandCoordCount, forEachSegment } from './commands';

describe('command constants', () => {
  it('match the canonical SVG-style codes', () => {
    expect([PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z]).toEqual([0, 1, 2, 3, 4]);
    expect(PATH_CMD_LENGTHS).toEqual([2, 2, 6, 4, 0]);
  });

  it('derives every lookup from the table', () => {
    for (const [name, row] of Object.entries(PATH_COMMANDS)) {
      expect(PATH_CMD_LENGTHS[row.code], name).toBe(row.coords);
      expect(pathCommandCoordCount(row.code), name).toBe(row.coords);
    }
    expect(PATH_CMD_LENGTHS).toHaveLength(Object.keys(PATH_COMMANDS).length);
  });
});

describe('forEachSegment', () => {
  it('walks commands with the running pen position and coord offset', () => {
    // M 0,0  L 10,0  Z
    const commands = Uint8Array.of(PATH_M, PATH_L, PATH_Z);
    const coords = Float64Array.of(0, 0, 10, 0);
    const seen: Array<[number, number, number, number]> = [];
    forEachSegment(commands, coords, (cmd, ci, px, py) => { seen.push([cmd, ci, px, py]); });
    expect(seen).toEqual([
      [PATH_M, 0, 0, 0],   // pen at origin before M consumes
      [PATH_L, 2, 0, 0],   // pen still at 0,0 entering the L
      [PATH_Z, 4, 10, 0],  // pen at 10,0 entering the Z
    ]);
  });
});

describe('forEachSegment pen bookkeeping', () => {
  it('returns the pen to the subpath start after Z', () => {
    // M 0,0  L 10,0  Z  L 5,5 — the trailing L starts from the subpath start.
    const commands = Uint8Array.of(PATH_M, PATH_L, PATH_Z, PATH_L);
    const coords = Float64Array.of(0, 0, 10, 0, 5, 5);
    const seen: Array<[number, number, number]> = [];
    forEachSegment(commands, coords, (cmd, _ci, px, py) => { seen.push([cmd, px, py]); });
    expect(seen).toEqual([
      [PATH_M, 0, 0],
      [PATH_L, 0, 0],
      [PATH_Z, 10, 0],
      [PATH_L, 0, 0],
    ]);
  });

  it('reports the command index alongside the coord index', () => {
    const commands = Uint8Array.of(PATH_M, PATH_C, PATH_Z);
    const coords = Float64Array.of(0, 0, 1, 1, 2, 2, 3, 3);
    const seen: Array<[number, number]> = [];
    forEachSegment(commands, coords, (_cmd, ci, _px, _py, i) => { seen.push([i, ci]); });
    expect(seen).toEqual([[0, 0], [1, 2], [2, 8]]);
  });

  it('stops when the visitor returns false', () => {
    const commands = Uint8Array.of(PATH_M, PATH_L, PATH_L);
    const coords = Float64Array.of(0, 0, 1, 1, 2, 2);
    const seen: number[] = [];
    forEachSegment(commands, coords, (_cmd, ci) => {
      seen.push(ci);
      return ci < 2;
    });
    expect(seen).toEqual([0, 2]);
  });
});
