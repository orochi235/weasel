import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hatch, crosshatch, dots, chunks } from './patterns-builtin';
import { _resetTextureRegistryForTests } from '../textures/registerTexture';
import {
  installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas, type FakeOffscreenState,
} from './test-utils/fakeOffscreenCanvas';

let fake: FakeOffscreenState;

beforeEach(() => {
  fake = installFakeOffscreenCanvas();
  _resetTextureRegistryForTests();
});

afterEach(uninstallFakeOffscreenCanvas);

const callsTo = (fn: string) => fake.calls.filter((c) => c.fn === fn);

describe('built-in patterns', () => {
  it('hatch strokes the diagonal and its two corner stubs on a 5px tile', () => {
    expect(hatch({ color: 'red' })).toEqual({ id: expect.any(String) });
    expect(fake.last).toMatchObject({ width: 5, height: 5 });
    expect(callsTo('stroke')).toHaveLength(3);
    expect(callsTo('moveTo')[0].args).toEqual([-1, 6]);
    expect(callsTo('lineTo')[0].args).toEqual([6, -1]);
  });

  it('crosshatch strokes both diagonals at the size it is given', () => {
    expect(crosshatch({ color: '#abcdef', size: 8, lineWidth: 2 })).toEqual({ id: expect.any(String) });
    expect(fake.last).toMatchObject({ width: 8, height: 8 });
    expect(callsTo('stroke')).toHaveLength(6);
    expect(fake.last!.ctx.lineWidth).toBe(2);
  });

  it('dots fills one circle at the center of the tile', () => {
    expect(dots({ color: 'blue', size: 6, radius: 2 })).toEqual({ id: expect.any(String) });
    expect(callsTo('arc').map((c) => c.args)).toEqual([[3, 3, 2, 0, Math.PI * 2]]);
    expect(callsTo('fill')).toHaveLength(1);
    expect(fake.last!.ctx.fillStyle).toBe('blue');
  });

  it('chunks fills its background first, then scatters ellipses to the density', () => {
    expect(chunks({ color: '#fff', bg: '#000', size: 16, density: 0.1, chunkSize: 2, seed: 1 }))
      .toEqual({ id: expect.any(String) });
    expect(fake.calls[0]).toEqual({ fn: 'fillRect', args: [0, 0, 16, 16] });
    const placed = new Set(callsTo('ellipse').map(({ args: [cx, cy] }) => `${(cx as number + 16) % 16},${(cy as number + 16) % 16}`));
    expect(placed.size).toBe(6);
  });

  it('chunks draws a chunk crossing an edge again past the opposite one, so the tile repeats seamlessly', () => {
    chunks({ color: '#fff', size: 16, density: 0.6, chunkSize: 4, seed: 3 });
    const ellipses = callsTo('ellipse').map((c) => c.args as number[]);
    const inside = (v: number) => v >= 0 && v < 16;
    const crossing = ellipses.filter(([cx, cy, rx, ry]) =>
      inside(cx) && inside(cy) && [cx, cy].some((c) => c < Math.max(rx, ry) || c > 16 - Math.max(rx, ry)));
    expect(crossing.length).toBeGreaterThan(0);
    for (const [cx, cy, rx, ry] of crossing) {
      const r = Math.max(rx, ry);
      for (const [c, axis] of [[cx, 0], [cy, 1]] as const) {
        const shift = c < r ? 16 : c > 16 - r ? -16 : 0;
        if (shift === 0) continue;
        const want = axis === 0 ? [cx + shift, cy] : [cx, cy + shift];
        expect(ellipses.some(([x, y]) => x === want[0] && y === want[1])).toBe(true);
      }
    }
  });
});
