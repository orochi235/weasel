import { describe, it, expect, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import type { LayerSampleArgs, RenderLayer } from '@weasel-js/core';
import { createHud, type Hud } from '../hud';
import { createLoupe } from './createLoupe';

const exact = vi.hoisted(() => ({ calls: [] as LayerSampleArgs[], answer: null as number[] | null }));
vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  createLayerSampler: () => ({
    rgba: (args: LayerSampleArgs) => {
      exact.calls.push(args);
      return exact.answer && Uint8ClampedArray.from(exact.answer);
    },
    sample: () => null,
    dispose: () => undefined,
  }),
}));

const tokens = resolveTheme(weaselTheme, { mode: 'dark' });
const view = { x: 5, y: 6, scale: { x: 2, y: 2 } };
const dims = { width: 800, height: 600, dpr: 2 };
const source: RenderLayer<unknown>[] = [{ id: 'src', label: 'src', draw: () => [] }];

function bind(hud: Hud): () => void {
  const subs = new Set<() => void>();
  hud.bind({
    requestRedraw: () => {},
    registerLayer: () => () => {},
    subscribeFrame: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
  });
  return () => { for (const fn of [...subs]) fn(); };
}

/** A canvas whose framebuffer reads back a selection handle's blue everywhere. */
function canvasShowingChrome() {
  const el = document.createElement('canvas');
  el.width = 1600; el.height = 1200;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
  vi.spyOn(el, 'getContext').mockReturnValue({
    RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    readPixels: (_x: number, _y: number, _w: number, _h: number, _f: number, _t: number, buf: Uint8Array) => {
      buf.set([0, 0, 255, 255]);
    },
  } as unknown as WebGL2RenderingContext);
  return el;
}

describe('createLoupe: exact color in vector mode', () => {
  it('reads the source layers at the aim, at the frame it last drew in, not the framebuffer', () => {
    exact.calls = [];
    exact.answer = [10, 200, 30, 255];
    const hud = createHud();
    const frame = bind(hud);
    const onColorChange = vi.fn();
    const loupe = createLoupe({ hud, canvas: canvasShowingChrome(), source, requestRedraw: () => {}, onColorChange });
    loupe.window.content!({ data: 'd', view, dims, rect: loupe.window.contentRect, defaultFont: 'D', color: () => '#000', tokens });
    loupe.aimAt({ x: 400, y: 300 });
    frame();
    expect(loupe.color).toBe('#0ac81e');
    expect(onColorChange).toHaveBeenCalledWith('#0ac81e');
    expect(exact.calls.at(-1)).toEqual({ layers: source, data: 'd', view, dims, point: { x: 400, y: 300 } });
  });

  it('reads the framebuffer in pixel mode, and where the redraw cannot answer', () => {
    exact.answer = null;
    const hud = createHud();
    const frame = bind(hud);
    const loupe = createLoupe({ hud, canvas: canvasShowingChrome(), source, requestRedraw: () => {} });
    loupe.window.content!({ data: null, view, dims, rect: loupe.window.contentRect, defaultFont: 'D', color: () => '#000', tokens });
    loupe.aimAt({ x: 400, y: 300 });
    frame();
    expect(loupe.color).toBe('#0000ff');

    exact.answer = [1, 2, 3, 255];
    exact.calls = [];
    loupe.setMode('pixel');
    expect(loupe.pick()).toBe('#0000ff');
    expect(exact.calls).toHaveLength(0);
  });
});
