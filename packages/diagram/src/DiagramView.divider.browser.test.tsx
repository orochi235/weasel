import { afterEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';
import { DIVIDER_HEIGHT } from './body';
import { DiagramView } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** A 100-wide box at (100, 100), its text drawn in its own fill so only the rule shows. */
const DATA: DiagramData = {
  nodes: [{
    id: 'c', at: { x: 100, y: 100 }, width: 100, padding: 8, gap: 4, verticalAlign: 'top', pinned: true,
    rows: [{ kind: 'label', text: 'A' }, { kind: 'divider' }, { kind: 'label', text: 'B' }],
  }],
  edges: [],
};
const FILL = [16, 16, 16];

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const gl = canvasGl(canvas);
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const out = new Uint8Array(4);
  gl.readPixels(Math.round(x * dpr), Math.round(canvas.height - y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return [out[0]!, out[1]!, out[2]!];
}

describe('a divider row', () => {
  it('paints a rule across the box in its stroke, edge to edge, between the rows', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const specs = diagramScene(DATA, {
      layout: 'none', font: { fontFamily: 'sans-serif', fontSize: 10 },
      nodeStyle: () => ({ fill: '#101010', stroke: '#ff0000', text: '#101010', strokeWidth: 2 }),
    });
    await act(async () => root!.render(createElement(DiagramView, {
      specs, width: 300, height: 300, view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, onViewChange: () => {}, background: { color: '#000000' },
    })));
    await frame();
    await frame();
    const canvas = host.querySelector('canvas')!;
    const rule = 100 + 8 + 14 + 4 + DIVIDER_HEIGHT / 2;
    for (const x of [104, 150, 196]) expect(pixelAt(canvas, x, rule)).toEqual([255, 0, 0]);
    expect(pixelAt(canvas, 150, rule - 4)).toEqual(FILL);
    expect(pixelAt(canvas, 150, rule + 4)).toEqual(FILL);
  });
});
