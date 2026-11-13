import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene } from './fromData';

afterEach(() => { cleanup(); });

const SPECS = diagramScene({
  nodes: [{ id: 'a', lines: [], width: 80, height: 40, at: { x: 40, y: 80 }, pinned: true }],
  edges: [],
  containers: [{ id: 'box', role: 'container', label: 'Box', members: ['a'], box: { x: 0, y: 0, width: 300, height: 200 }, pinned: true }],
}, { layout: 'none' });
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function mount(extra: Partial<DiagramViewProps>) {
  const { container } = render(
    <DiagramView specs={SPECS} width={600} height={400} view={IDENTITY} onViewChange={() => {}} {...extra} />,
  );
  return container.querySelector('canvas')!;
}

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number) =>
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));

const dragBox = (canvas: HTMLCanvasElement) => act(async () => {
  pointer(canvas, 'pointerdown', 150, 10);
  pointer(canvas, 'pointermove', 170, 20);
  pointer(canvas, 'pointermove', 250, 60);
  pointer(canvas, 'pointerup', 250, 60);
});

describe('DiagramView onEdit', () => {
  it('reports a container dragged with its members as one edit', async () => {
    const onEdit = vi.fn();
    const onMove = vi.fn();
    const onEditContainer = vi.fn();
    await dragBox(mount({ onEdit, onMove, onEditContainer }));
    expect(onMove).toHaveBeenCalled();
    expect(onEditContainer).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalledTimes(1);
    const [edit] = onEdit.mock.calls[0]!;
    expect(edit.moves).toEqual([expect.objectContaining({ id: 'a', x: 140, y: 130 })]);
    expect(edit.containers).toEqual([expect.objectContaining({ kind: 'box', id: 'box', box: { x: 100, y: 50, width: 300, height: 200 } })]);
  });

  it('turns on dragging and region edits on its own', async () => {
    const onEdit = vi.fn();
    await dragBox(mount({ onEdit }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
