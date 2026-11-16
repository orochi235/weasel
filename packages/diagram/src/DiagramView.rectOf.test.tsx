import { cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
import { afterEach, expect, it } from 'vitest';
import { DiagramView, type DiagramViewApi } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

afterEach(() => { cleanup(); });

const DATA: DiagramData = { nodes: [{ id: 'a', lines: ['a'], at: { x: 100, y: 100 }, width: 100, height: 60 }], edges: [] };

/** `el` laid out 600 by 300, drawn on the page at `rect`. */
function show(el: HTMLElement, rect: { x: number; y: number; width: number; height: number }) {
  el.getBoundingClientRect = () => DOMRect.fromRect(rect);
}

it("gives a node's client rect where an ancestor drawing the canvas at twice its size puts it", () => {
  const api = createRef<DiagramViewApi>();
  const { container } = render(
    <DiagramView ref={api} specs={diagramScene(DATA, { layout: 'none' })} width={600} height={300}
      view={{ x: 0, y: 0, scale: { x: 1, y: 1 } }} onViewChange={() => {}} />,
  );
  const canvas = container.querySelector('canvas')!;
  Object.defineProperty(canvas, 'offsetWidth', { value: 600 });
  Object.defineProperty(canvas, 'offsetHeight', { value: 300 });
  show(canvas, { x: 0, y: 0, width: 600, height: 300 });
  const flat = api.current!.rectOf('a')!;
  show(canvas, { x: 10, y: 20, width: 1200, height: 600 });
  expect(api.current!.rectOf('a')).toEqual({ x: 10 + 2 * flat.x, y: 20 + 2 * flat.y, width: 2 * flat.width, height: 2 * flat.height });
});
