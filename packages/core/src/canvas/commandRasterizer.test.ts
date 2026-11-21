import { describe, expect, it, vi } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { commandRasterizer } from './commandRasterizer';
import type { RasterSession } from './renderSceneToPixels';

const rect: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 4, height: 4 }, fill: { paint: { color: '#000' } } };

function fakeSession() {
  const render = vi.fn((_args: unknown) => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }));
  return { session: { render } as unknown as RasterSession, render };
}

describe('commandRasterizer', () => {
  it('measures screen-unit paint in page units, at the default tolerance, unless told otherwise', async () => {
    const { session, render } = fakeSession();
    await commandRasterizer(session)([rect], { x: 0, y: 0, width: 10, height: 10 }, 2, undefined);
    const args = render.mock.calls[0]![0] as { screen: Float64Array; flattenTolerancePx?: number };
    expect(Array.from(args.screen)).toEqual(Array.from(mat3.scaled(mat3.identity(), 2, 2)));
    expect(args.flattenTolerancePx).toBeUndefined();
  });

  it('carries a screen space and a tolerance through to the session', async () => {
    const { session, render } = fakeSession();
    const screen = mat3.scaled(mat3.identity(), 3, 3);
    await commandRasterizer(session, { screen, flattenTolerancePx: 0.05 })([rect], { x: 0, y: 0, width: 10, height: 10 }, 2, undefined);
    const args = render.mock.calls[0]![0] as { screen: Float64Array; flattenTolerancePx?: number };
    expect(Array.from(args.screen)).toEqual(Array.from(mat3.scaled(mat3.identity(), 6, 6)));
    expect(args.flattenTolerancePx).toBe(0.05);
  });
});
