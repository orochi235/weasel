import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewApi, type DiagramViewProps } from './DiagramView';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';

afterEach(() => { cleanup(); });

/** a and b side by side, c below b; `a -> b` runs straight along y = 20 from x = 100 to 300. */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: [], width: 100, height: 40, at: { x: 0, y: 0 } },
    { id: 'b', lines: [], width: 100, height: 40, at: { x: 300, y: 0 } },
    { id: 'c', lines: [], width: 100, height: 40, at: { x: 300, y: 200 } },
  ],
  edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
};
const SPECS = diagramScene(DATA, { layout: 'none' });
const AB = edgeIdOf(DATA.edges[0]!);
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function mount(extra: Partial<DiagramViewProps>) {
  const api = createRef<DiagramViewApi>();
  const { container } = render(
    <DiagramView ref={api} specs={SPECS} width={500} height={300} view={IDENTITY} onViewChange={() => {}} {...extra} />,
  );
  return { api, canvas: container.querySelector('canvas')! };
}

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number) =>
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));

const click = (canvas: HTMLCanvasElement, x: number, y: number) => act(() => {
  pointer(canvas, 'pointerdown', x, y);
  pointer(canvas, 'pointerup', x, y);
});

describe('DiagramView editing', () => {
  it('reports a delete as data ids and leaves the scene alone', async () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    const { canvas } = mount({ onDelete, onSelect });
    click(canvas, 50, 20);
    expect(onSelect).toHaveBeenLastCalledWith('a');
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true, cancelable: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', code: 'Delete', bubbles: true }));
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith({ nodes: ['a'], edges: [AB] });
    onSelect.mockClear();
    click(canvas, 50, 20);
    expect(onSelect).toHaveBeenLastCalledWith('a');
  });

  it('lets an edge be picked, and reports a drag of its end onto another shape', () => {
    const onReconnect = vi.fn();
    const onSelect = vi.fn();
    const { canvas } = mount({ onReconnect, onSelect });
    click(canvas, 200, 20);
    expect(onSelect).toHaveBeenLastCalledWith(AB);
    act(() => {
      pointer(canvas, 'pointerdown', 300, 20);
      pointer(canvas, 'pointermove', 320, 100);
      pointer(canvas, 'pointermove', 350, 220);
      pointer(canvas, 'pointerup', 350, 220);
    });
    expect(onReconnect).toHaveBeenCalledWith({ edge: AB, end: 'to', node: 'c' });
  });

  it('reports a connect onto a body as an edge with no port at that end', () => {
    const onConnect = vi.fn();
    const { canvas } = mount({ onConnect, connectBodies: true });
    act(() => {
      pointer(canvas, 'pointerdown', 100, 20);
      pointer(canvas, 'pointermove', 200, 120);
      pointer(canvas, 'pointermove', 350, 220);
      pointer(canvas, 'pointerup', 350, 220);
    });
    expect(onConnect).toHaveBeenCalledWith({ from: 'a', fromPort: expect.any(String), to: 'c' });
  });

  it('reports a double-click on an edge for its label', () => {
    const onEditLabel = vi.fn();
    const { canvas } = mount({ onEditLabel });
    click(canvas, 200, 20);
    click(canvas, 200, 20);
    expect(onEditLabel).toHaveBeenCalledWith(AB);
  });

  it('maps client points to world points through the view', () => {
    const { api } = mount({ view: { x: 50, y: 20, scale: { x: 2, y: 2 } } });
    expect(api.current!.worldAt(0, 0)).toEqual({ x: 50, y: 20 });
    expect(api.current!.worldAt(50, 20)).toEqual({ x: 75, y: 30 });
  });
});
