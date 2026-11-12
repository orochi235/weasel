import { describe, expect, it, vi } from 'vitest';
import type { CanvasExtensionApi } from '@weasel-js/core';
import { attachHud } from './attach';
import { createHud } from './hud';

let arrive: () => void = () => {};
vi.mock('./fonts/registerDefaultFont', async (original) => ({
  ...(await original<typeof import('./fonts/registerDefaultFont')>()),
  registerDefaultFont: () => new Promise<void>((resolve) => { arrive = resolve; }),
}));

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

describe('attachHud and its default font', () => {
  it('redraws when the font arrives', async () => {
    const canvas = api();
    attachHud(canvas, createHud());
    arrive();
    await vi.waitFor(() => expect(canvas.requestRedraw).toHaveBeenCalled());
  });

  it('asks a canvas it has left for no redraw', async () => {
    const canvas = api();
    attachHud(canvas, createHud())();
    arrive();
    await new Promise((r) => setTimeout(r, 0));
    expect(canvas.requestRedraw).not.toHaveBeenCalled();
  });
});
