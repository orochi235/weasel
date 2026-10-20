import type { Path } from '@weasel-js/geom';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '@weasel-js/geom';
import { describe, expect, it } from 'vitest';
import { ContentStream } from './content';
import { pathOps } from './pathOps';
import { latin1 } from './latin1';

function ops(path: Path, which: 'all' | 'closed' = 'all'): string {
  const out = new ContentStream();
  pathOps(out, path, which);
  return latin1(out.bytes());
}

function poly(commands: number[], coords: number[]): Path {
  return {
    kind: 'polygon',
    commands: Uint8Array.from(commands),
    coords: Float32Array.from(coords),
    fillRule: 'nonzero',
  };
}

describe('pathOps', () => {
  it('writes a rect as re', () => {
    expect(ops({ kind: 'rect', x: 1, y: 2, width: 3, height: 4 })).toBe('1 2 3 4 re\n');
  });

  it('writes m, l and h for a polygon', () => {
    const p = poly([PATH_M, PATH_L, PATH_L, PATH_Z], [0, 0, 10, 0, 10, 10]);
    expect(ops(p)).toBe('0 0 m\n10 0 l\n10 10 l\nh\n');
  });

  it('raises a quadratic to the exact cubic', () => {
    const p = poly([PATH_M, PATH_Q], [0, 0, 6, 12, 12, 0]);
    expect(ops(p)).toBe('0 0 m\n4 8 8 8 12 0 c\n');
  });

  it('writes a cubic as c', () => {
    const p = poly([PATH_M, PATH_C], [0, 0, 1, 2, 3, 4, 5, 6]);
    expect(ops(p)).toBe('0 0 m\n1 2 3 4 5 6 c\n');
  });

  it('keeps only closed contours for closed', () => {
    const p = poly(
      [PATH_M, PATH_L, PATH_L, PATH_Z, PATH_M, PATH_L, PATH_L],
      [0, 0, 10, 0, 10, 10, 20, 20, 30, 20, 30, 30],
    );
    expect(ops(p, 'closed')).toBe('0 0 m\n10 0 l\n10 10 l\nh\n');
    expect(ops(p, 'all')).toContain('20 20 m');
  });

  it('expands corner specs before writing', () => {
    const p: Path = {
      kind: 'polygon',
      commands: Uint8Array.from([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: Float32Array.from([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
      corners: [{ shape: 'round', radius: 2 }, null, null, null],
    };
    const bare = ops({ ...p, corners: undefined });
    expect(ops(p)).not.toBe(bare);
    expect(ops(p)).toContain(' c\n');
  });
});
