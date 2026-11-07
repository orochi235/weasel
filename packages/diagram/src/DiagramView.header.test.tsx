import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

afterEach(() => { cleanup(); });

const DATA: DiagramData = {
  nodes: [{ id: 'a', at: { x: 0, y: 0 }, width: 200, rows: [{ kind: 'header', text: 'TITLE' }, { kind: 'label', text: 'body' }] }],
  edges: [],
};
const SPECS = diagramScene(DATA, { layout: 'none' });
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function mount(extra: Partial<DiagramViewProps>) {
  const { container } = render(
    <DiagramView specs={SPECS} width={500} height={300} view={IDENTITY} onViewChange={() => {}} {...extra} />,
  );
  return container.querySelector('canvas')!;
}

const click = (canvas: HTMLCanvasElement, x: number, y: number) => act(() => {
  for (const type of ['pointerdown', 'pointerup']) {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  }
});

describe('DiagramView onHeaderClick', () => {
  it('fires on the band, on its text and beside it, and not below it', () => {
    const onHeaderClick = vi.fn();
    const onSelect = vi.fn();
    const canvas = mount({ onHeaderClick, onSelect });
    click(canvas, 100, 40);
    expect(onHeaderClick).not.toHaveBeenCalled();
    click(canvas, 14, 10);
    expect(onSelect).toHaveBeenLastCalledWith('a', ['a']);
    expect(onHeaderClick).toHaveBeenCalledTimes(1);
    click(canvas, 180, 10);
    expect(onHeaderClick).toHaveBeenCalledTimes(2);
    click(canvas, 100, 40);
    expect(onHeaderClick).toHaveBeenCalledTimes(2);
    expect(onHeaderClick).toHaveBeenLastCalledWith('a');
  });
});
