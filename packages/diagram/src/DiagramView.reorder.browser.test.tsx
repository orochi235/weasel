import { act } from '@testing-library/react';
import { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import type { View } from '@weasel-js/core';
import { DiagramView, type DiagramViewApi, type DiagramViewProps, type ReorderChange } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

const DATA: DiagramData = {
  nodes: [
    ...['a', 'b', 'c'].flatMap((r) => [{ id: `${r}.patch`, lines: [`${r} patch`] }, { id: `${r}.pool`, lines: [`${r} pool`] }]),
    { id: 'word', lines: ['word'] },
  ],
  edges: ['a', 'b', 'c'].flatMap((r) => [{ from: `${r}.patch`, to: `${r}.pool` }, { from: `${r}.pool`, to: 'word' }]),
  groups: [
    ...['a', 'b', 'c'].map((r) => ({ id: r, members: [`${r}.patch`, `${r}.pool`] })),
    { id: 'layers', members: ['a', 'b', 'c'], reorder: 'y' as const },
  ],
};
const SPECS = diagramScene(DATA, { layout: 'layered', layoutOptions: { direction: 'right' } });

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

async function mount(more: { selected?: string; onViewChange?: (v: View) => void; onMove?: DiagramViewProps['onMove'] } = {}, specs = SPECS) {
  const host = document.createElement('div');
  document.body.append(host);
  const api = createRef<DiagramViewApi>();
  const changes: ReorderChange[] = [];
  await act(async () => {
    root = createRoot(host);
    root.render(
      <DiagramView ref={api} specs={specs} width={700} height={500} onReorder={(c) => changes.push(c)} {...more} />,
    );
  });
  return { host, api, changes, canvas: host.querySelector('canvas')! };
}

const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

async function drag(canvas: Element, from: { x: number; y: number }, dy: number, dx = 0) {
  await act(async () => {
    fire(canvas, 'pointerdown', from.x, from.y);
    for (let i = 1; i <= 12; i++) fire(canvas, 'pointermove', from.x + (dx * i) / 12, from.y + (dy * i) / 12);
    fire(canvas, 'pointerup', from.x + dx, from.y + dy);
  });
}

const middle = (r: { x: number; y: number; width: number; height: number }) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

it('reports the new order when a row is dragged past the next one', async () => {
  const { api, canvas, changes } = await mount();
  const a = api.current!.rectOf('a')!;
  const b = api.current!.rectOf('b')!;
  await drag(canvas, middle(api.current!.rectOf('a.patch')!), b.y + b.height - (a.y + a.height) + 4);
  expect(changes).toEqual([{ parent: 'layers', order: ['b', 'a', 'c'] }]);
});

it('reports nothing for a drag that leaves the order as it was', async () => {
  const { api, canvas, changes } = await mount();
  await drag(canvas, middle(api.current!.rectOf('b.pool')!), 6);
  expect(changes).toEqual([]);
});

it('pans on a drag from a node outside any reorderable group', async () => {
  const views: View[] = [];
  const { api, canvas, changes } = await mount({ onViewChange: (v) => views.push(v) });
  await drag(canvas, middle(api.current!.rectOf('word')!), 60, 60);
  expect(changes).toEqual([]);
  await expect.poll(() => views.length).toBeGreaterThan(0);
});

it('steps the selected row with Alt and an arrow key', async () => {
  const { api, canvas, changes } = await mount();
  const { x, y } = middle(api.current!.rectOf('c.pool')!);
  // A click picks the node, and gives this canvas the keys.
  await act(async () => {
    fire(canvas, 'pointerdown', x, y);
    fire(canvas, 'pointerup', x, y);
  });
  await act(async () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', altKey: true, bubbles: true, cancelable: true }));
  });
  expect(changes).toEqual([{ parent: 'layers', order: ['a', 'c', 'b'] }]);
});


/** A container whose three members stand in a row, marked to reorder along it. */
const ROW = diagramScene({
  nodes: ['m1', 'm2', 'm3'].map((id, k) => ({ id, lines: [id], width: 60, height: 40, at: { x: 60 + 100 * k, y: 140 }, pinned: true })),
  edges: [],
  containers: [{ id: 'k', role: 'container', label: 'K', members: ['m1', 'm2', 'm3'], reorder: 'x', box: { x: 40, y: 100, width: 320, height: 100 }, pinned: true }],
}, { layout: 'none' });

it('reports a container member dragged past the next one as the container\'s new order', async () => {
  const { api, canvas, changes } = await mount({}, ROW);
  await drag(canvas, middle(api.current!.rectOf('m1')!), 0, 110);
  expect(changes).toEqual([{ parent: 'k', order: ['m2', 'm1', 'm3'] }]);
});

it('moves a container member dragged out of the container\'s box out of it, and reorders nothing', async () => {
  const moves: { id: string; parent?: string | null }[] = [];
  const { api, canvas, changes } = await mount({ onMove: (m) => moves.push(...m) }, ROW);
  const k = api.current!.rectOf('k')!;
  const from = middle(api.current!.rectOf('m2')!);
  await drag(canvas, from, k.y + k.height + 80 - from.y);
  expect(changes).toEqual([]);
  expect(moves.filter((m) => m.id === 'm2').at(-1)).toMatchObject({ id: 'm2', parent: null });
});

it('steps the selected container member with Alt and an arrow key', async () => {
  const { api, canvas, changes } = await mount({}, ROW);
  const { x, y } = middle(api.current!.rectOf('m3')!);
  await act(async () => {
    fire(canvas, 'pointerdown', x, y);
    fire(canvas, 'pointerup', x, y);
  });
  await act(async () => {
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }));
  });
  expect(changes).toEqual([{ parent: 'k', order: ['m1', 'm3', 'm2'] }]);
});
