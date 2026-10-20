/**
 * A panel's `highlight` and `set-overlays` reach the pixels of a real WebGL2
 * canvas: jsdom has no renderer, so only a browser shows the overlay drew.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from '../core/scene/scene';
import { DEVTOOLS_PROTOCOL, type PanelMessage } from '../devtools/protocol';
import { createInPageTransports } from '../devtools/transport';

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let close: (() => void) | null = null;

afterEach(() => {
  close?.();
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
  close = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const settle = async () => { await frame(); await frame(); await frame(); };

/** RGBA at a device pixel, counted from the top-left. */
function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!;
  const out = new Uint8Array(4);
  gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return Array.from(out);
}

async function mount() {
  const scene = createScene<unknown, 'main', { x: number; y: number; width: number; height: number }>({
    systemLayers: [{ id: 'main' }],
  });
  const id = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 20, y: 20, width: 40, height: 40 }, data: {} });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(SceneCanvas, {
    scene, width: 100, height: 100, dpr: 1, 'aria-label': 'overlay check',
  })));
  await settle();
  const canvas = host.querySelector('canvas')!;
  const hook = window.__weaselDevtools__!;
  const rootId = hook.roots().find((r) => r.label === 'overlay check')!.id;
  const { page, panel } = createInPageTransports();
  close = hook.connect(page);
  panel.send({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
  let requestId = 1;
  const send = async (body: Record<string, unknown>) => {
    panel.send({ protocol: DEVTOOLS_PROTOCOL, requestId: requestId++, rootId, ...body } as PanelMessage);
    await settle();
  };
  return { canvas, id, send };
}

const near = (actual: number[], expected: number[]) =>
  actual.slice(0, 3).every((c, i) => Math.abs(c - expected[i]!) <= 8);

const PINK = [0xff, 0x40, 0x81];
const YELLOW = [0xff, 0xeb, 0x3b];

describe('a devtools panel steering a real canvas', () => {
  it('outlines a highlighted node, and stops when the panel leaves', async () => {
    const { canvas, id, send } = await mount();
    expect(near(pixel(canvas, 20, 40), PINK)).toBe(false);
    await send({ type: 'highlight', ids: [id] });
    expect(pixel(canvas, 20, 40)).toSatisfy((p: number[]) => near(p, PINK));
    close!();
    close = null;
    await settle();
    expect(near(pixel(canvas, 20, 40), PINK)).toBe(false);
  });

  // A 1px bounds line centered on the node's edge half-covers the pixel outside
  // it, over a transparent clear: its color is the line's once unpremultiplied.
  it('turns on an overlay feature the canvas did not ask for', async () => {
    const { canvas, send } = await mount();
    expect(pixel(canvas, 19, 40)[3]).toBe(0);
    await send({ type: 'set-overlays', overlays: { bounds: true } });
    const [r, g, b, a] = pixel(canvas, 19, 40) as [number, number, number, number];
    expect(a).toBeGreaterThan(0);
    expect([r, g, b].map((c) => Math.round((c * 255) / a))).toSatisfy((p: number[]) => near(p, YELLOW));
  });
});
