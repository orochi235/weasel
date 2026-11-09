/** Geometry that paints nothing adds nothing to a retained group's bounds. */
import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import { contentBounds } from './contentBounds';

const W = 1000, H = 800;
const RECT: DrawCommand = {
  kind: 'path', path: { kind: 'rect', x: 100, y: 50, width: 40, height: 20 }, fill: { paint: { color: '#000' } },
};
const bound = (extra: DrawCommand) => contentBounds([RECT, extra], mat3.identity(), [], 1, W, H);

describe('contentBounds for geometry that paints nothing', () => {
  it('leaves out a sprites run of no sprites', () => {
    const empty = { kind: 'sprites', image: {} as ImageBitmap, sprites: new Float32Array(0) } as DrawCommand;
    expect(bound(empty).width).toBeLessThan(100);
  });

  it('leaves out a path with no points', () => {
    const empty: DrawCommand = {
      kind: 'path',
      path: { kind: 'polygon', commands: new Uint8Array(0), coords: new Float32Array(0), fillRule: 'nonzero' },
      fill: { paint: { color: '#000' } },
    };
    expect(bound(empty).width).toBeLessThan(100);
  });
});
