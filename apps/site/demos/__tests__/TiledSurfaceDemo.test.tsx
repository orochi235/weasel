import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let densityChanged: (dpr: number) => void = () => {};

vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@weasel-js/core')>(),
  SceneCanvas: () => null,
  watchDevicePixelRatio: (onChange: (dpr: number) => void) => {
    densityChanged = onChange;
    return () => { densityChanged = () => {}; };
  },
}));

const { TiledSurfaceDemo } = await import('../TiledSurfaceDemo');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TiledSurfaceDemo', () => {
  it('resizes the shared buffer when the device pixel ratio changes', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    render(<TiledSurfaceDemo />);
    const canvas = screen.getByTestId('tiled-surface') as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([820, 400]);
    vi.stubGlobal('devicePixelRatio', 2);
    densityChanged(2);
    expect([canvas.width, canvas.height]).toEqual([1640, 800]);
    expect(canvas.style.width).toBe('820px');
  });
});
