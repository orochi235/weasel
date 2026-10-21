import { act } from '@testing-library/react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import type { View } from '@weasel-js/core';
import { DiagramView } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }],
  edges: [{ from: 'a', to: 'b' }],
};

const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

// The select tool `pick` brings marquees on an empty drag, and an active tool's binding outranks
// the ambient drag-pan, so the view stayed put until the diagram dropped `areaSelect`.
it('pans on a drag that starts on empty canvas', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const views: View[] = [];
  await act(async () => {
    root = createRoot(host);
    root.render(<DiagramView specs={diagramScene(DATA)} width={400} height={300} onViewChange={(v) => views.push(v)} />);
  });
  const canvas = host.querySelector('canvas')!;
  const { left, top } = canvas.getBoundingClientRect();
  const [x, y] = [left + 10, top + 10];
  await act(async () => {
    fire(canvas, 'pointerdown', x, y);
    for (let i = 1; i <= 10; i++) fire(canvas, 'pointermove', x + i * 8, y + i * 5);
    fire(canvas, 'pointerup', x + 80, y + 50);
  });
  await expect.poll(() => views.length).toBeGreaterThan(0);
});
