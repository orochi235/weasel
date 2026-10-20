/**
 * `<DrawCanvas>` in real WebGL2: the drawing buffer is sized to the device
 * pixel ratio, and the commands land where the view puts them.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { DrawCommand } from '@weasel-js/renderer';
import { DrawCanvas, type DrawCanvasProps } from './DrawCanvas';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

function mount(props: DrawCanvasProps): HTMLCanvasElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(DrawCanvas, props)));
  return host.querySelector('canvas')!;
}

/** RGBA at a device pixel, counted from the top-left. */
function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!;
  const out = new Uint8Array(4);
  gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return Array.from(out);
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const red: DrawCommand = {
  kind: 'path',
  path: { kind: 'rect', x: 0, y: 0, width: 5, height: 10 },
  fill: { paint: { kind: 'solid', color: '#ff0000' } },
};

describe('<DrawCanvas> in a real browser', () => {
  it('sizes its buffer to the device pixel ratio and paints over the background', () => {
    const canvas = mount({
      width: 20, height: 10, dpr: 2, draw: [red], background: { kind: 'solid', color: '#ffffff' },
    });
    expect([canvas.width, canvas.height]).toEqual([40, 20]);
    expect(pixel(canvas, 4, 10)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 30, 10)).toEqual([255, 255, 255, 255]);
  });

  it('maps its commands through the view', () => {
    const canvas = mount({
      width: 20, height: 10, dpr: 1, draw: [red], view: { x: 0, y: 0, scale: { x: 2, y: 1 } },
      background: { kind: 'solid', color: '#ffffff' },
    });
    expect(pixel(canvas, 8, 5)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 12, 5)).toEqual([255, 255, 255, 255]);
  });

  it('repaints by itself once a lost context is restored', async () => {
    const canvas = mount({
      width: 20, height: 10, dpr: 1, draw: [red], background: { kind: 'solid', color: '#ffffff' },
    });
    const ext = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!.getExtension('WEBGL_lose_context')!;
    const event = (name: string) => new Promise<void>((r) => canvas.addEventListener(name, () => r(), { once: true }));
    const lost = event('webglcontextlost');
    ext.loseContext();
    await lost;
    // Restoring is allowed only once the lost event has finished dispatching.
    await new Promise((r) => setTimeout(r, 0));
    const restored = event('webglcontextrestored');
    ext.restoreContext();
    await restored;
    await frame();
    await frame();
    expect(pixel(canvas, 2, 5)).toEqual([255, 0, 0, 255]);
  });

  it('keeps the device-pixel buffer when the size changes and changes back before a paint', async () => {
    const props: DrawCanvasProps = {
      width: 20, height: 10, dpr: 2, draw: [red], background: { kind: 'solid', color: '#ffffff' },
    };
    const canvas = mount(props);
    await frame();
    flushSync(() => root!.render(createElement(DrawCanvas, { ...props, width: 30 })));
    flushSync(() => root!.render(createElement(DrawCanvas, props)));
    await frame();
    await frame();
    expect([canvas.width, canvas.height]).toEqual([40, 20]);
    expect(pixel(canvas, 4, 10)).toEqual([255, 0, 0, 255]);
  });
});
