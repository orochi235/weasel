import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** `c -> d` runs down x = 250 from y = 40 to 300; `a -> b`, after it, runs along y = 170 from x = 100 to 400. */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: [], width: 100, height: 40, at: { x: 0, y: 150 } },
    { id: 'b', lines: [], width: 100, height: 40, at: { x: 400, y: 150 } },
    { id: 'c', lines: [], width: 100, height: 40, at: { x: 200, y: 0 } },
    { id: 'd', lines: [], width: 100, height: 40, at: { x: 200, y: 300 } },
  ],
  edges: [{ from: 'c', to: 'd', router: 'straight' }, { from: 'a', to: 'b', router: 'straight' }],
};
const SPECS = diagramScene(DATA, {
  layout: 'none',
  nodeStyle: () => ({ fill: '#101010', stroke: '#101010', text: '#101010' }),
  edgeStyle: () => ({ stroke: '#ffffff', width: 2 }),
});
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function mount(extra: Partial<DiagramViewProps>): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(DiagramView, {
    specs: SPECS, width: 500, height: 360, view: VIEW, onViewChange: () => {}, background: { color: '#000000' }, ...extra,
  })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

/** Whether any pixel within a pixel of a CSS point is lit on the black ground. */
function inked(canvas: HTMLCanvasElement, x: number, y: number): boolean {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })!;
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const side = Math.ceil(3 * dpr);
  const out = new Uint8Array(side * side * 4);
  gl.readPixels(Math.round((x - 1) * dpr), Math.round(canvas.height - (y + 1) * dpr), side, side, gl.RGBA, gl.UNSIGNED_BYTE, out);
  for (let i = 0; i < out.length; i += 4) if (out[i]! + out[i + 1]! + out[i + 2]! > 60) return true;
  return false;
}

describe('DiagramView hops', () => {
  it('draws the later edge bowing over the earlier one where they cross', async () => {
    const plain = await mount({});
    expect(inked(plain, 245, 170)).toBe(true);
    expect(inked(plain, 257, 163)).toBe(false);
    root!.unmount();
    host!.remove();

    const hopped = await mount({ hops: 10 });
    expect(inked(hopped, 245, 170)).toBe(false);
    expect(inked(hopped, 257, 163)).toBe(true);
  });
});
