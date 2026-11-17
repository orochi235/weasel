import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene } from './fromData';

afterEach(() => { cleanup(); });

const SPECS = diagramScene({
  nodes: [
    { id: 'a', lines: [], width: 100, height: 40, at: { x: 0, y: 0 } },
    { id: 'b', lines: [], width: 100, height: 40, at: { x: 300, y: 0 } },
  ],
  edges: [],
}, { layout: 'none' });
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function mount(extra: Partial<DiagramViewProps>) {
  const { container } = render(
    <DiagramView specs={SPECS} width={500} height={300} view={IDENTITY} onViewChange={() => {}} {...extra} />,
  );
  return container.querySelector('canvas')!;
}

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number) =>
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));

describe('DiagramView onSelectionChangeionChange', () => {
  it('reports the node a drag picks, as a click would', async () => {
    const onSelectionChange = vi.fn();
    const canvas = mount({ onSelectionChange, onMove: () => {}, selection: 'a' });
    await act(async () => {
      pointer(canvas, 'pointerdown', 350, 20);
      pointer(canvas, 'pointermove', 360, 40);
      pointer(canvas, 'pointermove', 380, 80);
      pointer(canvas, 'pointerup', 380, 80);
    });
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith('b', ['b']);
  });

  it('reports a click once', async () => {
    const onSelectionChange = vi.fn();
    const canvas = mount({ onSelectionChange });
    await act(async () => {
      pointer(canvas, 'pointerdown', 350, 20);
      pointer(canvas, 'pointerup', 350, 20);
    });
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith('b', ['b']);
  });

  it('does not report a pick pushed in through selection', async () => {
    const onSelectionChange = vi.fn();
    const { rerender } = render(<DiagramView specs={SPECS} width={500} height={300} view={IDENTITY} onViewChange={() => {}} onSelectionChange={onSelectionChange} selection="a" />);
    await act(async () => {
      rerender(<DiagramView specs={SPECS} width={500} height={300} view={IDENTITY} onViewChange={() => {}} onSelectionChange={onSelectionChange} selection="b" />);
    });
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
