import { describe, it, expect, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createHud } from '../hud';
import { createLoupe } from './createLoupe';
import type { RenderLayer, View } from '@weasel-js/core';

const tokens = resolveTheme(weaselTheme, 'dark');
const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const dims = { width: 800, height: 600 };

function makeElement() {
  const el = document.createElement('canvas');
  el.width = 800; el.height = 600;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
  return el;
}

const source: RenderLayer<unknown>[] = [{
  id: 'src', label: 'src', space: 'world',
  draw: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { fill: 'solid', color: '#0f0' } }],
}];

describe('createLoupe', () => {
  it('creates a window widget on the hud', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const loupe = createLoupe({ hud, element: makeElement(), source, requestRedraw: () => {} });
    expect(hud.widgets()).toContain(loupe.window);
  });

  it('stops listening once the window is removed through the HUD', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const el = makeElement();
    const remove = vi.spyOn(el, 'removeEventListener');
    const loupe = createLoupe({ hud, element: el, source, requestRedraw: () => {} });
    hud.remove(loupe.window);
    // The next pointer sample is the one that notices and tears down.
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 400, clientY: 300 }));
    expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function));
    remove.mockRestore();
  });

  it('aimAt after dispose does nothing', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const redraw = vi.fn();
    const loupe = createLoupe({ hud, element: makeElement(), source, requestRedraw: redraw });
    loupe.dispose();
    redraw.mockClear();
    loupe.aimAt({ x: 400, y: 300 });
    expect(redraw).not.toHaveBeenCalled();
  });

  it('vector mode paints the source through a magnified inner view', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const seen: View[] = [];
    const spied: RenderLayer<unknown>[] = [{
      ...source[0],
      draw: (data, v, d) => { seen.push(v); return source[0].draw(data, v, d); },
    }];
    const loupe = createLoupe({ hud, element: makeElement(), source: spied, requestRedraw: () => {}, factor: 4 });
    loupe.aimAt({ x: 400, y: 300 });   // outside the default window bounds
    const rect = loupe.window.contentRect;
    const cmds = loupe.window.content!({ data: null, view, dims, rect, defaultFont: 'D', tokens });
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds[0].kind).toBe('group');
    // The source is drawn through an inner view magnified by `factor` and
    // centered on the aim point.
    expect(seen).toHaveLength(1);
    expect(seen[0].scale).toEqual({ x: 4, y: 4 });
    expect(seen[0].x).toBeCloseTo(400 - rect.w / 2 / 4);
    expect(seen[0].y).toBeCloseTo(300 - rect.h / 2 / 4);
  });

  it('freezes the aim while the pointer is over the window', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const loupe = createLoupe({ hud, element: makeElement(), source, requestRedraw: () => {} });
    loupe.window.setBounds({ x: 0, y: 0, w: 200, h: 150 });
    loupe.aimAt({ x: 400, y: 300 });
    const before = loupe.aim;
    loupe.aimAt({ x: 50, y: 50 });        // inside the window
    expect(loupe.aim).toEqual(before);
  });

  it('setMode switches the painter and requests a redraw', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const requestRedraw = vi.fn();
    const loupe = createLoupe({ hud, element: makeElement(), source, requestRedraw });
    requestRedraw.mockClear();
    loupe.setMode('pixel');
    expect(loupe.mode).toBe('pixel');
    expect(requestRedraw).toHaveBeenCalled();
  });

  it('reports the hex color under the aim point', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const el = makeElement();
    vi.spyOn(el, 'getContext').mockReturnValue({
      RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
      readPixels: (
        _x: number, _y: number, _w: number, _h: number, _f: number, _t: number,
        buf: Uint8Array,
      ) => {
        buf[0] = 0x0a; buf[1] = 0x7b; buf[2] = 0xd5; buf[3] = 255;
      },
    } as unknown as WebGL2RenderingContext);
    const onColorChange = vi.fn();
    const loupe = createLoupe({ hud, element: el, source, requestRedraw: () => {}, onColorChange });
    loupe.aimAt({ x: 400, y: 300 });
    expect(loupe.color).toBe('#0a7bd5');
    expect(onColorChange).toHaveBeenCalledWith('#0a7bd5');
  });

  it('pixel mode re-reads after an in-flight readback settles', async () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const el = makeElement();
    const reads: number[] = [];
    vi.spyOn(el, 'getContext').mockReturnValue({
      RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
      readPixels: (_x: number, y: number) => { reads.push(y); },
    } as unknown as WebGL2RenderingContext);

    const settles: (() => void)[] = [];
    const createImageBitmap = vi.fn(
      () => new Promise<ImageBitmap>((resolve) => {
        settles.push(() => resolve({ close: () => {} } as ImageBitmap));
      }),
    );
    vi.stubGlobal('createImageBitmap', createImageBitmap);

    const loupe = createLoupe({ hud, element: el, source, requestRedraw: () => {}, mode: 'pixel' });
    loupe.aimAt({ x: 400, y: 100 });
    expect(createImageBitmap).toHaveBeenCalledTimes(1);

    // Two more aims land while the first bitmap is still in flight.
    loupe.aimAt({ x: 400, y: 200 });
    loupe.aimAt({ x: 400, y: 300 });
    expect(createImageBitmap).toHaveBeenCalledTimes(1);

    settles[0]();
    await Promise.resolve();
    await Promise.resolve();

    // The trailing refresh runs once, against the final aim rather than the
    // one that was current when the readback started.
    expect(createImageBitmap).toHaveBeenCalledTimes(2);
    const region = reads[reads.length - 1];
    expect(region).not.toBe(reads[0]);

    loupe.dispose();
    vi.unstubAllGlobals();
  });

  it('dispose removes the window and detaches the pointer listener', () => {
    const hud = createHud();
    hud.bind({ requestRedraw: () => {}, registerLayer: () => () => {} });
    const el = makeElement();
    const remove = vi.spyOn(el, 'removeEventListener');
    const loupe = createLoupe({ hud, element: el, source, requestRedraw: () => {} });
    loupe.dispose();
    expect(hud.widgets()).not.toContain(loupe.window);
    expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function));
  });
});
