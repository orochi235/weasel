/**
 * `<Canvas imageMinification>` picks how the renderer minifies images. Real
 * `WeaselRenderer` against the recording context: it shows when mipmaps are
 * built, never a pixel.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { WeaselRenderer, type DrawCommand, type ImageMinification } from '@weasel-js/renderer';
import { makeGLRecorder, type GLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import { Canvas } from './testing/BareCanvas';
import type { RenderLayer } from '../core/layers/render';

let recorder: GLRecorder;
beforeAll(() => {
  recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { vi.restoreAllMocks(); });

const waitForFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

/** A 64-texel image drawn 8 pixels wide: an eighth of its size. */
function smallImageLayer(): RenderLayer<unknown> {
  const img = { width: 64, height: 64, close: () => {} } as unknown as ImageBitmap;
  const cmd: DrawCommand = { kind: 'image', image: img, x: 0, y: 0, w: 8, h: 8 };
  return { id: 'probe', label: 'Probe', space: 'screen', draw: () => [cmd] };
}

const mipmaps = (): number => recorder.calls.filter((c) => c.name === 'generateMipmap').length;

describe('Canvas imageMinification prop', () => {
  const el = (layer: RenderLayer<unknown>, mode: ImageMinification | undefined) => (
    <Canvas width={100} height={100} dpr={1} imageMinification={mode}
      layers={{ grid: null, probe: { layer } }} />
  );

  it("builds mipmaps for an image drawn small under 'auto'", async () => {
    recorder.reset();
    render(el(smallImageLayer(), 'auto'));
    await waitForFrame();
    expect(mipmaps()).toBe(1);
  });

  it('builds them by default', async () => {
    recorder.reset();
    render(el(smallImageLayer(), undefined));
    await waitForFrame();
    expect(mipmaps()).toBe(1);
  });

  it("builds none under 'linear'", async () => {
    recorder.reset();
    render(el(smallImageLayer(), 'linear'));
    await waitForFrame();
    expect(mipmaps()).toBe(0);
  });

  it('hands the renderer a changed strategy', async () => {
    const layer = smallImageLayer();
    const { rerender } = render(el(layer, undefined));
    await waitForFrame();
    const set = vi.spyOn(WeaselRenderer.prototype, 'setImageMinification');
    rerender(el(layer, 'mipmap'));
    await waitForFrame();
    expect(set).toHaveBeenCalledWith('mipmap');
  });
});
