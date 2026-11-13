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

describe('DiagramView onSelect', () => {
  it('reports the node a drag picks, as a click would', async () => {
    const onSelect = vi.fn();
    const canvas = mount({ onSelect, onMove: () => {}, selected: 'a' });
    await act(async () => {
      pointer(canvas, 'pointerdown', 350, 20);
      pointer(canvas, 'pointermove', 360, 40);
      pointer(canvas, 'pointermove', 380, 80);
      pointer(canvas, 'pointerup', 380, 80);
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith('b', ['b']);
  });

  it('reports a click once', async () => {
    const onSelect = vi.fn();
    const canvas = mount({ onSelect });
    await act(async () => {
      pointer(canvas, 'pointerdown', 350, 20);
      pointer(canvas, 'pointerup', 350, 20);
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith('b', ['b']);
  });

  it('does not report a pick pushed in through selected', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<DiagramView specs={SPECS} width={500} height={300} view={IDENTITY} onViewChange={() => {}} onSelect={onSelect} selected="a" />);
    await act(async () => {
      rerender(<DiagramView specs={SPECS} width={500} height={300} view={IDENTITY} onViewChange={() => {}} onSelect={onSelect} selected="b" />);
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
