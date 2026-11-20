import { describe, expect, it } from 'vitest';
import { chooseBackend, rememberBackend } from './canvasBackend';

describe('chooseBackend', () => {
  it('refuses a tile of a canvas that already paints with WebGPU, which would erase its co-tenants', () => {
    const canvas = document.createElement('canvas');
    rememberBackend(canvas, 'webgpu');
    for (const asked of ['webgpu', 'auto', 'webgl2'] as const) {
      const choice = chooseBackend(canvas, asked, true);
      expect(choice.kind).toBe('refuse-tile');
    }
  });

  it('paints a tile of a canvas that already paints with WebGL 2 with WebGL 2', () => {
    const canvas = document.createElement('canvas');
    rememberBackend(canvas, 'webgl2');
    expect(chooseBackend(canvas, 'auto', true)).toEqual({ kind: 'webgl2' });
  });

  it('paints a tile of a fresh canvas with WebGL 2 whatever it asks for', () => {
    expect(chooseBackend(document.createElement('canvas'), 'webgpu', true)).toEqual({ kind: 'webgl2' });
  });
});
