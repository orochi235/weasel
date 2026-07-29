import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachHud } from './attach';
import { createHud } from './hud';
import type { CanvasExtensionApi } from '@weasel-js/core';
import { _resetFontRegistryForTests } from '@weasel-js/font';

function makeApi(): CanvasExtensionApi & { _layer?: import('../../core/src/core/layers/render').RenderLayer<unknown> } {
  const api = {
    element: null,
    requestRedraw: vi.fn(),
    hitTestExtras: vi.fn(() => null),
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

  it('onUncapturedMove fires hovermove on the topmost-hit widget', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    const hoverFn = vi.fn();
    const btn = hud.button({ id: 'b', x: 10, y: 10, w: 50, h: 20, label: 'x' });
    btn.on('hover', hoverFn);

    // Simulate the canvas dispatching onUncapturedMove under identity view
    // (worldX/Y = canvas pixels).
    api._layer!.onUncapturedMove!(20, 15, {} as PointerEvent, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
    expect(hoverFn).toHaveBeenCalledTimes(1);
  });

  it('layer.draw resolves tokens from the canvas element', () => {
    const hud = createHud();
    const canvas = document.createElement('canvas');
    canvas.style.setProperty('--wzl-button-fill', '#abcdef');
    document.body.appendChild(canvas);
    try {
      const api: CanvasExtensionApi = {
        element: canvas,
        requestRedraw: vi.fn(),
        hitTestExtras: vi.fn(() => null),
        registerLayer: vi.fn(() => () => {}),
      };
      attachHud(api, hud);
      hud.button({ id: 'b', x: 0, y: 0, w: 50, h: 20, label: 'x' });
      const registeredLayer = (api.registerLayer as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const cmds = registeredLayer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
      const buttonBody = cmds.find((c: { kind: string }) => c.kind === 'path') as { fill: { color: string } };
      expect(buttonBody.fill.color).toBe('#abcdef');
    } finally {
      canvas.remove();
    }
  });
});
