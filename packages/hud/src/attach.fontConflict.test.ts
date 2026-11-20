import { describe, expect, it, vi } from 'vitest';
import type { CanvasExtensionApi } from '@weasel-js/core';
import { attachHud } from './attach';
import { createHud } from './hud';

function api(): CanvasExtensionApi {
  return {
    element: null,
    surface: null,
    getSurfaceRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    clientToWorld: (x: number, y: number): [number, number] => [x, y],
    requestRedraw: vi.fn(),
    subscribeFrame: vi.fn(() => () => {}),
    subscribeBeforePaint: vi.fn(() => () => {}),
    subscribeResume: vi.fn(() => () => {}),
    hitTestExtras: vi.fn(() => null),
    registerLayer: vi.fn(() => () => {}),
  } as unknown as CanvasExtensionApi;
}

describe('attachHud given a font pair', () => {
  it('refuses a pair other than the one the HUD font holds, attaching nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    attachHud(api(), createHud());
    const canvas = api();
    const hud = createHud();
    expect(() => attachHud(canvas, hud, { font: { metricsUrl: '/host/inter.json', atlasUrl: '/host/inter.png' } }))
      .toThrow(/already registered from other URLs/);
    expect(hud.attached).toBe(false);
    expect(canvas.registerLayer).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

});
