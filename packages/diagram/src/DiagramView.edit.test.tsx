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

const click = (canvas: HTMLCanvasElement, x: number, y: number, shiftKey = false) => act(() => {
  for (const type of ['pointerdown', 'pointerup']) {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, shiftKey }));
  }
});

describe('DiagramView editing', () => {
  it('reports a delete as data ids and leaves the scene alone', async () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    const { canvas } = mount({ onDelete, onSelect });
    click(canvas, 50, 20);
    expect(onSelect).toHaveBeenLastCalledWith('a', ['a']);
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true, cancelable: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', code: 'Delete', bubbles: true }));
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith({ nodes: ['a'], edges: [AB] });
    onSelect.mockClear();
    click(canvas, 50, 20);
    expect(onSelect).toHaveBeenLastCalledWith('a', ['a']);
  });

  it('lets an edge be picked, and reports a drag of its end onto another shape', () => {
    const onReconnect = vi.fn();
    const onSelect = vi.fn();
    const { canvas } = mount({ onReconnect, onSelect, connectBodies: true });
    click(canvas, 200, 20);
    expect(onSelect).toHaveBeenLastCalledWith(AB, [AB]);
    const dragEndToC = () => act(() => {
      pointer(canvas, 'pointerdown', 300, 20);
      pointer(canvas, 'pointermove', 320, 100);
      pointer(canvas, 'pointermove', 350, 220);
      pointer(canvas, 'pointerup', 350, 220);
    });
    dragEndToC();
    expect(onReconnect).toHaveBeenCalledWith({ edge: AB, end: 'to', node: 'c' });
    // Reported, not written: the end is still on b, so its handle is still there to drag.
    dragEndToC();
    expect(onReconnect).toHaveBeenCalledTimes(2);
    expect(onReconnect).toHaveBeenLastCalledWith({ edge: AB, end: 'to', node: 'c' });
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

  it('picks one at a time, Shift or not, by default', () => {
    const onSelect = vi.fn();
    const { canvas } = mount({ onSelect });
    click(canvas, 50, 20);
    click(canvas, 350, 20, true);
    expect(onSelect).toHaveBeenLastCalledWith('b', ['b']);
  });

  it('adds to what is picked on Shift-click under selectionMode multiple, and takes a picked one out', () => {
    const onSelect = vi.fn();
    const { canvas } = mount({ onSelect, selectionMode: 'multiple' });
    click(canvas, 50, 20);
    click(canvas, 350, 20, true);
    expect(onSelect).toHaveBeenLastCalledWith('b', ['a', 'b']);
    click(canvas, 350, 220, true);
    expect(onSelect).toHaveBeenLastCalledWith('c', ['a', 'b', 'c']);
    click(canvas, 350, 20, true);
    expect(onSelect).toHaveBeenLastCalledWith('c', ['a', 'c']);
    click(canvas, 350, 20);
    expect(onSelect).toHaveBeenLastCalledWith('b', ['b']);
  });

  it('keeps a pick of several when handed back its latest id, and takes a set as selected', () => {
    const onSelect = vi.fn();
    const { canvas, rerender } = mountControlled({ onSelect, selectionMode: 'multiple' }, null);
    click(canvas, 50, 20);
    click(canvas, 350, 20, true);
    rerender('b');
    click(canvas, 350, 220, true);
    expect(onSelect).toHaveBeenLastCalledWith('c', ['a', 'b', 'c']);
    rerender(['a', 'c']);
    click(canvas, 50, 20, true);
    expect(onSelect).toHaveBeenLastCalledWith('c', ['c']);
  });
});

function mountControlled(extra: Partial<DiagramViewProps>, selected: DiagramViewProps['selected']) {
  const view = (s: DiagramViewProps['selected']) => (
    <DiagramView specs={SPECS} width={500} height={300} view={IDENTITY} onViewChange={() => {}} {...extra} selected={s} />
  );
  const out = render(view(selected));
  return { canvas: out.container.querySelector('canvas')!, rerender: (s: DiagramViewProps['selected']) => out.rerender(view(s)) };
}
