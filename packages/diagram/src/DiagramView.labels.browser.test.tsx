import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerCanvasFont } from '@weasel-js/font';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene } from './fromData';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

registerCanvasFont('sans-serif');

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** `a -> b` runs flat along y = 130, its red label above the middle, under the gray `cover` box at (220, 80)–(280, 118). */
const SPECS = diagramScene(
  {
    nodes: [
      { id: 'a', lines: [], at: { x: 0, y: 100 }, width: 100, height: 60 },
      { id: 'b', lines: [], at: { x: 400, y: 100 }, width: 100, height: 60 },
      { id: 'cover', lines: [], at: { x: 220, y: 80 }, width: 60, height: 38 },
    ],
    edges: [{ from: 'a', to: 'b', fromPort: 'e', toPort: 'w', label: 'note' }],
  },
  {
    layout: 'none',
    nodeStyle: () => ({ fill: '#808080', stroke: '#808080', text: '#808080' }),
    edgeStyle: () => ({ stroke: '#0000ff', label: '#ff0000', markerEnd: null }),
  },
);
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function mount(extra: Partial<DiagramViewProps>): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(DiagramView, {
    specs: SPECS, width: 500, height: 300, view: VIEW, onViewChange: () => {}, background: { color: '#000000' }, ...extra,
  })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

/** How many pixels of the label's red the canvas drew inside a CSS-pixel rect. */
function redPixels(canvas: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number): number {
  const gl = canvasGl(canvas);
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const [l, r, t, b] = [x0, x1, y0, y1].map((v) => Math.round(v * dpr));
  const px = new Uint8Array((r! - l!) * (b! - t!) * 4);
  gl.readPixels(l!, canvas.height - b!, r! - l!, b! - t!, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i]! > 160 && px[i + 1]! < 100 && px[i + 2]! < 100) n++;
  return n;
}

describe('DiagramView labels', () => {
  it('draws a covered label over the box covering it without labels="dodge"', async () => {
    const canvas = await mount({});
    expect(redPixels(canvas, 222, 82, 278, 117)).toBeGreaterThan(0);
  });

  it('draws the label clear of the box with labels="dodge", below the line', async () => {
    const canvas = await mount({ labels: 'dodge' });
    expect(redPixels(canvas, 222, 82, 278, 117)).toBe(0);
    expect(redPixels(canvas, 200, 132, 300, 160)).toBeGreaterThan(0);
  });
});
