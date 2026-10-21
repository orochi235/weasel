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

/** One gray box at (100, 100)–(220, 160) whose west and east ports carry red
 *  labels, which sit outside the box. */
const SPECS = diagramScene(
  { nodes: [{ id: 'a', lines: [], at: { x: 100, y: 100 }, width: 120, height: 60, portLabels: { w: 'start', e: 'end' } }], edges: [] },
  { layout: 'none', nodeStyle: () => ({ fill: '#808080', stroke: '#808080', text: '#ff0000' }) },
);
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function mount(extra: Partial<DiagramViewProps>): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(DiagramView, {
    specs: SPECS, width: 320, height: 260, view: VIEW, onViewChange: () => {}, background: { color: '#000000' }, ...extra,
  })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

/** How many red pixels the canvas drew inside a CSS-pixel rect. */
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

describe('DiagramView perimeter port labels', () => {
  it('draws a label that sits outside its node', async () => {
    const label = SPECS.find((s) => (s.data as { text?: string }).text === 'start')!;
    expect(label.pose.x + label.pose.width).toBeLessThan(100);
    const canvas = await mount({});
    expect(redPixels(canvas, 0, 100, 100, 160)).toBeGreaterThan(0);
    expect(redPixels(canvas, 220, 100, 320, 160)).toBeGreaterThan(0);
  });

  it('draws them in edit mode, with ports shown', async () => {
    const canvas = await mount({ onConnect: () => {}, portOptions: { shape: 'circle', fill: { paint: { color: '#00ff00' } } } });
    expect(redPixels(canvas, 0, 100, 100, 160)).toBeGreaterThan(0);
  });
});
