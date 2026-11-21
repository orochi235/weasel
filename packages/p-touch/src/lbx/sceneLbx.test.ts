import { describe, expect, it, vi } from 'vitest';
import { createScene } from '@weasel-js/core';
import { tapeForWidthMm } from '../tape';

const render = vi.fn((_args: unknown) => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }));
vi.mock('@weasel-js/core', async (load) => ({
  ...(await load<typeof import('@weasel-js/core')>()),
  createRasterSession: () => ({ render, dispose: () => {} }),
}));

const { sceneToLbx } = await import('./sceneLbx');

describe('sceneToLbx', () => {
  it('rasterizes at the pixel ratio, screen space, and tolerance it was given', async () => {
    const translucent = { kind: 'path' as const, path: { kind: 'rect' as const, x: 2, y: 2, width: 4, height: 4 }, fill: { paint: { color: '#000', opacity: 0.5 } } };
    const scene = createScene<unknown, 'main'>({ systemLayers: [{ id: 'main' }] });
    const base = { scene, length: 72, tape: tapeForWidthMm(12)!, overlay: [translucent], rasterDpi: 72 };
    await sceneToLbx({ ...base, pixelRatio: 2, flattenTolerancePx: 0.05 });
    const args = render.mock.calls.at(-1)![0] as { screen: Float64Array; flattenTolerancePx?: number };
    expect(args.screen[0]).toBe(2);
    expect(args.flattenTolerancePx).toBe(0.05);
    await sceneToLbx({ ...base, screen: new Float64Array([3, 0, 0, 0, 3, 0, 0, 0, 1]) });
    expect((render.mock.calls.at(-1)![0] as { screen: Float64Array }).screen[0]).toBe(3);
  });
});
