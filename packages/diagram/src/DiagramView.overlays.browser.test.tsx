import { act } from '@testing-library/react';
import { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import type { View } from '@weasel-js/core';
import { DiagramView, type DiagramViewApi, type DiagramViewProps } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'], at: { x: 0, y: 0 }, pinned: true }, { id: 'b', lines: ['b'], at: { x: 200, y: 0 }, pinned: true }],
  edges: [{ id: 'ab', from: 'a', to: 'b' }],
};
const SPECS = diagramScene(DATA, { layout: 'none' });
const AT_ORIGIN: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

async function mount(props: Partial<DiagramViewProps>) {
  const host = document.createElement('div');
  document.body.append(host);
  const api = createRef<DiagramViewApi>();
  const render = (more: Partial<DiagramViewProps>) =>
    root!.render(<DiagramView ref={api} specs={SPECS} width={400} height={300} view={AT_ORIGIN} {...props} {...more} />);
  await act(async () => {
    root = createRoot(host);
    render({});
  });
  return { host, api, canvas: host.querySelector('canvas')!, rerender: (more: Partial<DiagramViewProps>) => act(async () => render(more)) };
}

const card = <div data-testid="card" className="card">settings</div>;
const rectOfEl = (el: Element) => el.getBoundingClientRect();

it('holds an overlay beside its node, and moves it with the view', async () => {
  const { host, api, rerender } = await mount({
    overlays: [{ target: 'a', placement: { side: 'right', align: 'start' }, offset: 4, content: card }],
  });
  const el = host.querySelector('[data-testid="card"]')!;
  await expect.poll(() => rectOfEl(el).left).toBeCloseTo(api.current!.rectOf('a')!.x + api.current!.rectOf('a')!.width + 4, 0);
  expect(rectOfEl(el).top).toBeCloseTo(api.current!.rectOf('a')!.y, 0);

  const before = rectOfEl(el).left;
  await rerender({ view: { x: -50, y: 0, scale: { x: 1, y: 1 } } });
  await expect.poll(() => rectOfEl(el).left).toBeCloseTo(before + 50, 0);
});

it('keeps a side overlay inside the view when neither side has room for it', async () => {
  const wide = <div data-testid="wide" className="wide">settings</div>;
  const { host } = await mount({
    view: { x: -120, y: -100, scale: { x: 1, y: 1 } },
    overlays: [{ target: 'a', placement: { side: 'right', align: 'start' }, offset: 8, content: wide }],
  });
  const el = host.querySelector<HTMLElement>('[data-testid="wide"]')!;
  el.style.width = '300px';
  const canvas = host.querySelector('canvas')!.getBoundingClientRect();
  await expect.poll(() => rectOfEl(el).right).toBeLessThanOrEqual(canvas.right + 0.5);
  expect(rectOfEl(el).left).toBeGreaterThanOrEqual(canvas.left - 0.5);
});

it('centers an edge overlay on the midpoint along its route', async () => {
  const { host, api } = await mount({ overlays: [{ target: 'ab', content: <button type="button">+</button> }] });
  const el = host.querySelector('button')!;
  const mid = api.current!.rectOf('ab')!;
  expect(mid.width).toBe(0);
  await expect.poll(() => {
    const r = rectOfEl(el);
    return Math.hypot(r.left + r.width / 2 - mid.x, r.top + r.height / 2 - mid.y);
  }).toBeLessThan(1);
});

it('hides an overlay whose target is not in the diagram', async () => {
  const { host } = await mount({ overlays: [{ target: 'nope', content: card }] });
  const el = host.querySelector('[data-testid="card"]')!;
  await expect.poll(() => (el.parentElement as HTMLElement).hidden).toBe(true);
});

it('reports a hovered edge while edges are picked', async () => {
  const hovered: (string | null)[] = [];
  const { api, canvas } = await mount({ pickEdges: true, onHover: (id) => hovered.push(id) });
  const mid = api.current!.rectOf('ab')!;
  const move = (x: number, y: number) => canvas.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y,
  }));
  await act(async () => {
    move(mid.x, mid.y + 2);
    canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 1, pointerType: 'mouse' }));
  });
  expect(hovered).toEqual(['ab', null]);
});

it('keeps a press on an overlay away from the canvas', async () => {
  const views: View[] = [];
  const { host } = await mount({ view: undefined, onViewChange: (v) => views.push(v), overlays: [{ target: 'a', content: card }] });
  const el = host.querySelector('[data-testid="card"]')!;
  await expect.poll(() => (el.parentElement as HTMLElement).hidden).toBe(false);
  const settled = views.length;
  const { left, top } = rectOfEl(el);
  const fire = (type: string, x: number, y: number) => el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));
  await act(async () => {
    fire('pointerdown', left + 2, top + 2);
    for (let i = 1; i <= 10; i++) fire('pointermove', left + 2 + i * 8, top + 2);
    fire('pointerup', left + 82, top + 2);
  });
  expect(views.length).toBe(settled);
});
