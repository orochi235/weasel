/**
 * Label dragging through a real canvas: a drag on an edge's label reports the
 * placement it left and draws nothing, and a click on it selects the edge.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { registerCanvasFont } from '@weasel-js/font';
import { DiagramView, type DiagramViewApi, type DiagramViewProps } from './DiagramView';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';

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

/** `a -> b` runs flat along y = 120 from x = 100 to x = 300, its label above the middle. */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: [], width: 100, height: 40, at: { x: 0, y: 100 } },
    { id: 'b', lines: [], width: 100, height: 40, at: { x: 300, y: 100 } },
  ],
  edges: [{ from: 'a', fromPort: 'e', to: 'b', toPort: 'w', label: 'Yes' }],
};
const AB = edgeIdOf(DATA.edges[0]!);
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

async function mount(extra: Partial<DiagramViewProps>): Promise<{ canvas: HTMLCanvasElement; api: DiagramViewApi }> {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const ref = createRef<DiagramViewApi>();
  flushSync(() => root!.render(createElement(DiagramView, {
    ref, specs: diagramScene(DATA, { layout: 'none' }), width: 400, height: 300, view: VIEW, onViewChange: () => {},
    background: { color: '#000000' },
    ...extra,
  })));
  await frame();
  await frame();
  return { canvas: host.querySelector('canvas')!, api: ref.current! };
}

function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  const box = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: box.left + x, clientY: box.top + y,
  }));
}

/** The label's center, in the canvas's CSS pixels. */
function labelCenter(canvas: HTMLCanvasElement, api: DiagramViewApi): { x: number; y: number } {
  const rect = api.rectOf(`${AB}/label`);
  expect(rect).not.toBeNull();
  const box = canvas.getBoundingClientRect();
  return { x: rect!.x - box.left + rect!.width / 2, y: rect!.y - box.top + rect!.height / 2 };
}

describe('label dragging in DiagramView', () => {
  it('reports where a drag leaves the label, below the edge', async () => {
    const onMoveLabel = vi.fn();
    const { canvas, api } = await mount({ onMoveLabel });
    const { x, y } = labelCenter(canvas, api);
    // The label stands above the edge.
    expect(y).toBeLessThan(120);

    pointer(canvas, 'pointermove', x, y);
    pointer(canvas, 'pointerdown', x, y);
    for (let i = 1; i <= 8; i++) {
      pointer(canvas, 'pointermove', x, y + i * 5);
      await frame();
    }
    pointer(canvas, 'pointerup', x, y + 40);
    await frame();

    expect(onMoveLabel).toHaveBeenCalledTimes(1);
    const change = onMoveLabel.mock.calls[0]![0];
    expect(change.edge).toBe(AB);
    expect(change.placement.at).toBeCloseTo(0.5, 1);
    expect(change.placement.offset).toBeLessThan(0);
    expect(change.placement.dodge).toBe(false);
  });

  it('selects the edge on a click on its label, and reports no move', async () => {
    const onMoveLabel = vi.fn();
    const onSelect = vi.fn();
    const { canvas, api } = await mount({ onMoveLabel, onSelect });
    const { x, y } = labelCenter(canvas, api);

    pointer(canvas, 'pointermove', x, y);
    pointer(canvas, 'pointerdown', x, y);
    pointer(canvas, 'pointerup', x, y);
    await frame();

    expect(onSelect).toHaveBeenLastCalledWith(AB, [AB]);
    expect(onMoveLabel).not.toHaveBeenCalled();
  });
});
