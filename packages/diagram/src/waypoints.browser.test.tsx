/**
 * Route editing through a real canvas: the segment bar takes the press over
 * the edge's own pick and over a port under it, the drag previews the edge
 * where the commit will leave it, and the release reports the new route.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * `a -> b` runs orthogonal from a's east port at (100, 20) out to x = 200,
 * down to y = 220, and in to b's west port at (300, 220). Its middle segment's
 * bar sits at (200, 120), right on c's east port.
 */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: [], width: 100, height: 40, at: { x: 0, y: 0 } },
    { id: 'b', lines: [], width: 100, height: 40, at: { x: 300, y: 200 } },
    { id: 'c', lines: [], width: 60, height: 40, at: { x: 140, y: 100 } },
  ],
  edges: [{ from: 'a', fromPort: 'e', to: 'b', toPort: 'w', router: 'orthogonal' }],
};
const AB = edgeIdOf(DATA.edges[0]!);
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function mount(extra: Partial<DiagramViewProps>): Promise<HTMLCanvasElement> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(createElement(DiagramView, {
    specs: diagramScene(DATA, { layout: 'none' }), width: 400, height: 300, view: VIEW, onViewChange: () => {},
    background: { color: '#000000' },
    ...extra,
  })));
  await frame();
  await frame();
  return host.querySelector('canvas')!;
}

function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  const box = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: box.left + x, clientY: box.top + y,
  }));
}

/** Whether any pixel within a pixel of a CSS point is lit on the black ground. */
function inked(canvas: HTMLCanvasElement, x: number, y: number): boolean {
  const gl = canvas.getContext('webgl2')!;
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  const side = Math.ceil(3 * dpr);
  const out = new Uint8Array(side * side * 4);
  gl.readPixels(Math.round((x - 1) * dpr), Math.round(canvas.height - (y + 1) * dpr), side, side, gl.RGBA, gl.UNSIGNED_BYTE, out);
  for (let i = 0; i < out.length; i += 4) if (out[i]! + out[i + 1]! + out[i + 2]! > 60) return true;
  return false;
}

describe('route editing in a real canvas', () => {
  it('slides a segment by its bar, previewing the route, over the edge\'s pick and a port beneath', async () => {
    const onEditRoute = vi.fn();
    const onConnect = vi.fn();
    const onMove = vi.fn();
    const onSelect = vi.fn();
    const canvas = await mount({ onEditRoute, onConnect, onMove, onSelect });

    pointer(canvas, 'pointerdown', 150, 20);
    pointer(canvas, 'pointerup', 150, 20);
    await frame();
    expect(onSelect).toHaveBeenLastCalledWith(AB);
    await frame();
    expect(inked(canvas, 260, 160)).toBe(false);

    pointer(canvas, 'pointermove', 200, 120);
    pointer(canvas, 'pointerdown', 200, 120);
    for (let i = 1; i <= 6; i++) {
      pointer(canvas, 'pointermove', 200 + i * 10, 120);
      await frame();
    }
    await frame();
    // The middle segment is drawn where it is being dragged, at x = 260.
    expect(inked(canvas, 260, 160)).toBe(true);
    pointer(canvas, 'pointerup', 260, 120);
    await frame();

    expect(onEditRoute).toHaveBeenCalledTimes(1);
    expect(onEditRoute).toHaveBeenCalledWith({ edge: AB, waypoints: [{ x: 260, y: 20 }, { x: 260, y: 220 }] });
    expect(onConnect).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });
});
