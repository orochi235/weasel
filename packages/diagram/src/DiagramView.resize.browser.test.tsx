import { afterEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DiagramView, type NodeResize } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const frames = async () => { await frame(); await frame(); };

/** One box at world (100, 100), 100 by 60. */
const DATA: DiagramData = { nodes: [{ id: 'a', lines: [], width: 100, height: 60, at: { x: 100, y: 100 }, pinned: true }], edges: [] };
const specsOf = (data: DiagramData) =>
  diagramScene(data, { layout: 'none', nodeStyle: () => ({ fill: '#101010', stroke: '#101010', text: '#101010' }) });
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function mount(onResize: (r: readonly NodeResize[]) => void): Promise<{ canvas: HTMLCanvasElement; show: (d: DiagramData) => Promise<void> }> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const show = async (data: DiagramData) => {
    await act(async () => root!.render(createElement(DiagramView, {
      specs: specsOf(data), width: 300, height: 300, view: VIEW, onViewChange: () => {}, background: { color: '#000000' }, onResize,
    })));
    await frames();
  };
  await show(DATA);
  return { canvas: host.querySelector('canvas')!, show };
}

/** RGB at a CSS-pixel point in the canvas, read back from the framebuffer. */
function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const gl = canvasGl(canvas);
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const out = new Uint8Array(4);
  gl.readPixels(Math.round(x * dpr), Math.round(canvas.height - y * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
  return [out[0]!, out[1]!, out[2]!];
}

function fire(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  const r = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + x, clientY: r.top + y,
  }));
}

const BOX = [16, 16, 16];
const GROUND = [0, 0, 0];

describe('DiagramView resize handles', () => {
  it('resizes live under the drag, reports once on release, and draws the box once the data holds it', async () => {
    const reports: (readonly NodeResize[])[] = [];
    const { canvas, show } = await mount((r) => reports.push(r));
    await act(async () => {
      fire(canvas, 'pointerdown', 150, 130);
      fire(canvas, 'pointerup', 150, 130);
    });
    await frames();
    expect(pixelAt(canvas, 225, 185)).toEqual(GROUND);

    await act(async () => {
      fire(canvas, 'pointerdown', 200, 160);
      for (let i = 1; i <= 8; i++) fire(canvas, 'pointermove', 200 + (40 * i) / 8, 160 + (40 * i) / 8);
    });
    await frames();
    // The live preview may tint the box, so only its absence is exact.
    expect(pixelAt(canvas, 225, 185)).not.toEqual(GROUND);

    await act(async () => { fire(canvas, 'pointerup', 240, 200); });
    await frames();
    expect(reports).toEqual([[{ id: 'a', x: 100, y: 100, width: 140, height: 100 }]]);
    expect(pixelAt(canvas, 225, 185)).toEqual(GROUND);

    const r = reports[0]![0]!;
    await show({ ...DATA, nodes: [{ ...DATA.nodes[0]!, width: r.width, height: r.height, at: { x: r.x, y: r.y } }] });
    expect(pixelAt(canvas, 225, 185)).toEqual(BOX);
    expect(reports).toHaveLength(1);
  });
});
