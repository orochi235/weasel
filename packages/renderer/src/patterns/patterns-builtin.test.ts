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
    expect(callsTo('ellipse')).toHaveLength(6);
  });
});
