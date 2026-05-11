import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachHud } from './attach';
import { createHud } from './hud';
import type { CanvasExtensionApi } from '../../../src/canvas/canvasExtension';
import { _resetFontRegistryForTests } from '../../../src/features/text/atlas/registerFont';

function makeApi(): CanvasExtensionApi & { _layer?: import('../../../src/core/layers/render').RenderLayer<unknown> } {
  const api = {
    element: null,
    requestRedraw: vi.fn(),
    registerLayer: vi.fn((layer) => {
      (api as { _layer?: unknown })._layer = layer;
      return () => { (api as { _layer?: unknown })._layer = undefined; };
    }),
  };
  return api as never;
}

describe('attachHud', () => {
  beforeEach(() => {
    _resetFontRegistryForTests();
    // Stub fetch so registerDefaultFont's promise resolves
    global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
    // Stub createImageBitmap (jsdom doesn't implement it)
    global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
  });

  it('registers a screen-space layer on the canvas', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    expect(api.registerLayer).toHaveBeenCalledTimes(1);
    expect(api._layer?.space).toBe('screen');
  });

  it('binds the HUD (hud.attached is true after attach)', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    expect(hud.attached).toBe(true);
  });

  it('returns a detach function that unregisters and unbinds', () => {
    const hud = createHud();
    const api = makeApi();
    const detach = attachHud(api, hud);
    detach();
    expect(hud.attached).toBe(false);
    expect(api._layer).toBeUndefined();
  });

  it('throws if the HUD is already attached', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    expect(() => attachHud(api, hud)).toThrow();
  });
});
