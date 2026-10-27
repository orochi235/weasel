import { act } from '@testing-library/react';
import { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { DiagramView, type DiagramViewApi, type DiagramViewProps } from './DiagramView';
import { diagramScene } from './fromData';
import { dragItemProps, type ItemDrop } from './itemDrop';

const node = (id: string, x: number) => ({ id, lines: [id], width: 60, height: 40, at: { x, y: 140 }, pinned: true });
const SPECS = diagramScene({
  nodes: [node('r1', 60), node('r2', 160), node('r3', 260), node('b1', 460)],
  edges: [],
  containers: [
    { id: 'row', role: 'container', label: 'Row', members: ['r1', 'r2', 'r3'], reorder: 'x', box: { x: 40, y: 100, width: 320, height: 100 }, pinned: true },
    { id: 'bag', role: 'container', label: 'Bag', members: ['b1'], box: { x: 440, y: 100, width: 200, height: 160 }, pinned: true },
  ],
}, { layout: 'none' });
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

async function mount(more: Partial<DiagramViewProps> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const api = createRef<DiagramViewApi>();
  const drops: ItemDrop[] = [];
  await act(async () => {
    root = createRoot(host);
    root.render(
      <>
        <button type="button" {...dragItemProps({ kind: 'blur' })}>blur</button>
        <DiagramView ref={api} specs={SPECS} width={700} height={400} view={VIEW} onViewChange={() => {}} onDropItem={(d) => drops.push(d)} {...more} />
      </>,
    );
  });
  const source = host.querySelector('button')!;
  const canvas = host.querySelector('canvas')!;
  const fire = (target: EventTarget, type: string, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));
  /** Carry the item from the button to world point `to`, reading the page just before the release. */
  const carry = async (to: { x: number; y: number }, midway?: () => void) => {
    const s = source.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    await act(async () => {
      fire(source, 'pointerdown', s.left + 4, s.top + 4);
      for (let i = 1; i <= 8; i++) {
        const x = s.left + ((c.left + to.x - s.left) * i) / 8;
        const y = s.top + ((c.top + to.y - s.top) * i) / 8;
        fire(document, 'pointermove', x, y);
      }
    });
    midway?.();
    await act(async () => {
      fire(document, 'pointerup', c.left + to.x, c.top + to.y);
    });
  };
  return { drops, carry };
}

it('reports an item dropped between two members of a reorderable container, at their gap', async () => {
  const { drops, carry } = await mount();
  await carry({ x: 240, y: 160 });
  expect(drops).toEqual([{ item: { kind: 'blur' }, target: 'row', container: 'row', index: 2, at: { x: 240, y: 160 } }]);
});

it('shows the reason a refused container gives while the item is over it, and reports nothing on release', async () => {
  const { drops, carry } = await mount({
    canDropItem: (_item, t) => (t.container === 'bag' ? { refuse: 'Bag is sealed' } : true),
  });
  let shown: string | null = null;
  await carry({ x: 600, y: 230 }, () => {
    shown = document.querySelector('[role="status"]')?.textContent ?? null;
  });
  expect(shown).toBe('Bag is sealed');
  expect(drops).toEqual([]);
  expect(document.querySelector('[role="status"]')).toBeNull();
});
