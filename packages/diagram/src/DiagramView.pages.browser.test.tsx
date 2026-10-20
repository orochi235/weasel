import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DiagramView } from './DiagramView';
import { diagramPages } from './dataPages';
import { diagramScene, type DiagramData } from './fromData';
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

/** p1 spans x 0..200, p2 x 240..440, both 100 tall. */
const TWO_PAGES_DATA: DiagramData = {
  pages: [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }],
  nodes: [
    { id: 'a', lines: [], width: 30, height: 20, at: { x: 20, y: 20 } },
    { id: 'b', lines: [], width: 30, height: 20, at: { x: 300, y: 20 } },
  ],
  edges: [],
};
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function rgbAt(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number] {
  const gl = canvasGl(canvas);
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const out = new Uint8Array(4);
  gl.readPixels(Math.round(x * dpr), Math.round(canvas.height - y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return [out[0]!, out[1]!, out[2]!];
}

describe('DiagramView pages', () => {
  it('paints each page under the scene and nothing in the gap', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    flushSync(() => root!.render(createElement(DiagramView, {
      specs: diagramScene(TWO_PAGES_DATA, { layout: 'none' }),
      pages: { placed: diagramPages(TWO_PAGES_DATA), fill: '#ff00ff' },
      width: 600, height: 300, view: VIEW, onViewChange: () => {}, background: { color: '#000000' },
    })));
    await frame();
    await frame();
    const canvas = host.querySelector('canvas')!;
    expect(rgbAt(canvas, 340, 80)).toEqual([255, 0, 255]);
    expect(rgbAt(canvas, 220, 50)).not.toEqual([255, 0, 255]);
  });
});
