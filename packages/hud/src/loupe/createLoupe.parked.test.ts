import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import type { RenderLayer, View } from '@weasel-js/core';
import { createHud, type Hud } from '../hud';
import { createLoupe, type LoupeHandle } from './createLoupe';

// A parked lens: the aim holds still while what is under it changes.

const tokens = resolveTheme(weaselTheme, { mode: 'dark' });
const dims = { width: 800, height: 600, dpr: 1 };
const source: RenderLayer<unknown>[] = [];

function makeElement(pixel: () => number[]) {
  const el = document.createElement('canvas');
  el.width = 800; el.height = 600;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
  vi.spyOn(el, 'getContext').mockReturnValue({
    RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    readPixels: (_x: number, _y: number, _w: number, _h: number, _f: number, _t: number, out: Uint8Array) => {
      const px = pixel();
      for (let i = 0; i < out.length; i++) out[i] = px[i % 4]!;
    },
  } as unknown as WebGL2RenderingContext);
  return el;
}

/** A host whose paints a test lands by hand, each one drawing the lens through `view` first. */
function bindHost(hud: Hud): { frame(loupe: LoupeHandle, view?: View): void; redraws: () => number } {
  const subs = new Set<() => void>();
  let redraws = 0;
  hud.bind({
    requestRedraw: () => { redraws += 1; },
    registerLayer: () => () => {},
    subscribeFrame: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
  });
  return {
    frame(loupe, view = { x: 0, y: 0, scale: { x: 1, y: 1 } }) {
      const rect = loupe.window.contentRect;
      loupe.window.content!({ data: null, view, dims, rect, defaultFont: 'D', color: () => '#000000', tokens });
      for (const fn of [...subs]) fn();
    },
    redraws: () => redraws,
  };
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

function parked(extra: { contentVersion?: () => number } = {}) {
  let px = [255, 0, 0, 255];
  const hud = createHud();
  const host = bindHost(hud);
  const made = vi.fn(() => Promise.resolve({ close: () => {} } as ImageBitmap));
  vi.stubGlobal('createImageBitmap', made);
  const colors: string[] = [];
  const requestRedraw = vi.fn();
  const loupe = createLoupe({
    hud, canvas: makeElement(() => px), source, requestRedraw, mode: 'pixel',
    onColorChange: (hex) => colors.push(hex), ...extra,
  });
  loupe.aimAt({ x: 400, y: 300 });
  return { loupe, host, made, colors, requestRedraw, paint: (next: number[]) => { px = next; } };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('a parked pixel-mode loupe', () => {
  it('reads the framebuffer and the color again when the content version moves under it', async () => {
    let version = 1;
    const { loupe, host, made, colors, paint } = parked({ contentVersion: () => version });
    host.frame(loupe);
    await settle();
    expect(made).toHaveBeenCalledTimes(1);
    expect(colors).toEqual(['#ff0000']);

    paint([0, 0, 255, 255]);
    version = 2;
    host.frame(loupe);
    await settle();
    expect(made).toHaveBeenCalledTimes(2);
    expect(colors).toEqual(['#ff0000', '#0000ff']);
    expect(loupe.color).toBe('#0000ff');
    loupe.dispose();
  });

  it('does not read again on the frame its own new picture lands, or on any frame nothing changed for', async () => {
    let version = 1;
    const { loupe, host, made } = parked({ contentVersion: () => version });
    host.frame(loupe);
    await settle();
    version = 2;
    host.frame(loupe);
    await settle();
    expect(made).toHaveBeenCalledTimes(2);
    host.frame(loupe);
    await settle();
    host.frame(loupe);
    await settle();
    expect(made).toHaveBeenCalledTimes(2);
    loupe.dispose();
  });

  it('reads again when the camera moves under it', async () => {
    const { loupe, host, made, colors, paint } = parked();
    host.frame(loupe);
    await settle();
    expect(made).toHaveBeenCalledTimes(1);
    paint([0, 255, 0, 255]);
    host.frame(loupe, { x: 40, y: 0, scale: { x: 1, y: 1 } });
    await settle();
    expect(made).toHaveBeenCalledTimes(2);
    expect(colors.at(-1)).toBe('#00ff00');
    host.frame(loupe, { x: 40, y: 0, scale: { x: 1, y: 1 } });
    await settle();
    expect(made).toHaveBeenCalledTimes(2);
    loupe.dispose();
  });

  it('refresh() asks for a paint and reads again on the frame that lands, once', async () => {
    const { loupe, host, made, colors, requestRedraw, paint } = parked();
    host.frame(loupe);
    await settle();
    requestRedraw.mockClear();
    paint([0, 0, 255, 255]);
    loupe.refresh();
    // The buffer still holds the frame before the change until a paint lands.
    expect(made).toHaveBeenCalledTimes(1);
    expect(requestRedraw).toHaveBeenCalledTimes(1);
    host.frame(loupe);
    await settle();
    expect(made).toHaveBeenCalledTimes(2);
    expect(colors.at(-1)).toBe('#0000ff');
    host.frame(loupe);
    await settle();
    expect(made).toHaveBeenCalledTimes(2);
    loupe.dispose();
  });

  it('follows the color in vector mode too, where the picture already follows', async () => {
    let version = 1;
    const { loupe, host, made, colors, paint } = parked({ contentVersion: () => version });
    loupe.setMode('vector');
    host.frame(loupe);
    paint([0, 0, 255, 255]);
    version = 2;
    host.frame(loupe);
    await settle();
    expect(colors.at(-1)).toBe('#0000ff');
    expect(made).not.toHaveBeenCalled();
    loupe.dispose();
  });
});
