import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene } from './fromData';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** One box at world (100, 100), 100 by 60, with one port in the middle of its left edge. */
const SPECS = diagramScene(
  { nodes: [{ id: 'a', lines: [], width: 100, height: 60, at: { x: 100, y: 100 }, ports: [{ id: 'p', at: { u: 0, v: 0.5 } }] }], edges: [] },
  { layout: 'none', nodeStyle: () => ({ fill: '#101010', stroke: '#101010', text: '#101010' }) },
);
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function mount(extra: Partial<DiagramViewProps>): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(DiagramView, {
    specs: SPECS, width: 300, height: 300, view: VIEW, onViewChange: () => {},
    background: { color: '#000000' },
    portOptions: { fill: { paint: { color: '#ff0000' } }, sizePx: 10 },
    ...extra,
  })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

/** RGB at a CSS-pixel point in the canvas, read back from the framebuffer. */
function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const gl = canvasGl(canvas);
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const out = new Uint8Array(4);
  gl.readPixels(Math.round(x * dpr), Math.round(canvas.height - y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return [out[0]!, out[1]!, out[2]!];
}

describe('DiagramView ports', () => {
  it('paints a port at its world point when ports is "show"', async () => {
    const canvas = await mount({ ports: 'show' });
    expect(pixelAt(canvas, 150, 130)).toEqual([16, 16, 16]);
    expect(pixelAt(canvas, 100, 130)).toEqual([255, 0, 0]);
  });

  it('paints no port when nothing asks for them', async () => {
    const canvas = await mount({});
    expect(pixelAt(canvas, 150, 130)).toEqual([16, 16, 16]);
    expect(pixelAt(canvas, 97, 130)).toEqual([0, 0, 0]);
  });
});
