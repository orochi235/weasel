import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it } from 'vitest';
import type { View } from '@weasel-js/core';
import { DiagramView, fitDiagram } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

afterEach(() => { cleanup(); });

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: [], width: 400, height: 40, at: { x: 0, y: 0 } }, { id: 'b', lines: [], width: 40, height: 40, at: { x: 600, y: 0 } }],
  edges: [],
};
const SPECS = diagramScene(DATA, { layout: 'none' });

describe('DiagramView refit', () => {
  it('fits again when its box changes size, while the view is still its fit', async () => {
    const views: View[] = [];
    const onViewChange = (v: View) => views.push(v);
    const { rerender } = render(<DiagramView specs={SPECS} width={800} height={300} onViewChange={onViewChange} />);
    await act(async () => {
      rerender(<DiagramView specs={SPECS} width={300} height={300} onViewChange={onViewChange} />);
    });
    expect(views.at(-1)).toEqual(fitDiagram(SPECS, { width: 300, height: 300 }));
  });

  it('leaves a view the user has moved alone when its box changes size', async () => {
    const views: View[] = [];
    const onViewChange = (v: View) => views.push(v);
    const { rerender, container } = render(<DiagramView specs={SPECS} width={800} height={300} onViewChange={onViewChange} />);
    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: 40, deltaY: 30, bubbles: true, cancelable: true }));
    });
    expect(views.length).toBeGreaterThan(0);
    const panned = views.at(-1)!;
    await act(async () => {
      rerender(<DiagramView specs={SPECS} width={300} height={300} onViewChange={onViewChange} />);
    });
    expect(views.at(-1)).toEqual(panned);
  });
});
