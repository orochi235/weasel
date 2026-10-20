import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewApi, type DiagramViewProps, type NodeResize } from './DiagramView';
import { diagramScene, type DataNode, type DiagramData } from './fromData';

afterEach(() => { cleanup(); });

/** a at the origin, 100 × 40, and b well clear of it. */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['a'], width: 100, height: 40, at: { x: 0, y: 0 }, pinned: true },
    { id: 'b', lines: ['b'], width: 100, height: 40, at: { x: 300, y: 0 }, pinned: true },
  ],
  edges: [{ from: 'a', to: 'b' }],
};
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const specsOf = (data: DiagramData) => diagramScene(data, { layout: 'none' });

/** What a host keeping `onResize`'s reports does with them. */
function store(data: DiagramData, resizes: readonly NodeResize[]): DiagramData {
  const by = new Map(resizes.map((r) => [r.id, r]));
  return {
    ...data,
    nodes: data.nodes.map((n): DataNode => {
      const r = by.get(n.id);
      return r === undefined ? n : { ...n, width: r.width, height: r.height, at: { x: r.x, y: r.y }, pinned: true };
    }),
  };
}

function mount(extra: Partial<DiagramViewProps>) {
  const api = createRef<DiagramViewApi>();
  const props = { ref: api, specs: specsOf(DATA), width: 500, height: 300, view: IDENTITY, onViewChange: () => {}, ...extra };
  const view = render(<DiagramView {...props} />);
  const rerender = (data: DiagramData) => view.rerender(<DiagramView {...props} specs={specsOf(data)} />);
  return { api, rerender, canvas: view.container.querySelector('canvas')! };
}

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number) =>
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));

function drag(canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }) {
  act(() => {
    pointer(canvas, 'pointerdown', from.x, from.y);
    pointer(canvas, 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
    pointer(canvas, 'pointermove', to.x, to.y);
    pointer(canvas, 'pointerup', to.x, to.y);
  });
}

/** Pick a, then drag its bottom-right corner to `to`. */
function resizeA(canvas: HTMLCanvasElement, to: { x: number; y: number }) {
  drag(canvas, { x: 50, y: 20 }, { x: 50, y: 20 });
  drag(canvas, { x: 100, y: 40 }, to);
}

const sizeOf = (api: DiagramViewApi, id: string) => {
  const r = api.rectOf(id)!;
  return { width: r.width, height: r.height };
};

describe('DiagramView resizing', () => {
  it('reports a handle drag on release, and draws the new box only once the specs follow', () => {
    const onResize = vi.fn();
    const onMove = vi.fn();
    const { api, canvas, rerender } = mount({ onResize, onMove });
    resizeA(canvas, { x: 160, y: 90 });
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledWith([{ id: 'a', x: 0, y: 0, width: 160, height: 90 }]);
    expect(onMove).not.toHaveBeenCalled();
    expect(sizeOf(api.current!, 'a')).toEqual({ width: 100, height: 40 });

    rerender(store(DATA, onResize.mock.calls[0]![0]));
    expect(sizeOf(api.current!, 'a')).toEqual({ width: 160, height: 90 });
    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it('grows a box dragged smaller than its rows back to them once stored', () => {
    const onResize = vi.fn();
    const { api, canvas, rerender } = mount({ onResize });
    resizeA(canvas, { x: 4, y: 3 });
    const [resize] = onResize.mock.calls[0]![0] as NodeResize[];
    expect(resize!.width).toBeLessThan(10);
    const stored = store(DATA, [resize!]);
    rerender(stored);
    const least = specsOf(stored).find((s) => s.id === 'a')!.pose;
    expect(least.width).toBeGreaterThan(resize!.width);
    expect(sizeOf(api.current!, 'a')).toEqual({ width: least.width, height: least.height });
  });

  it('shows no handles without onResize: the same drag moves the node', () => {
    const onMove = vi.fn();
    const { api, canvas } = mount({ onMove });
    resizeA(canvas, { x: 160, y: 90 });
    expect(onMove).toHaveBeenCalled();
    expect(sizeOf(api.current!, 'a')).toEqual({ width: 100, height: 40 });
  });
});
