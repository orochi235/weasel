import { act } from '@testing-library/react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagramView, type ContainerEdit, type DiagramViewProps, type NodeResize, diagramScene, type DiagramData } from '@weasel-js/diagram';

// A container's handles, which jsdom cannot tell from a plain drag: a container moved and a container resized are
// both a `box` edit, and only a real layout puts the press on the handle.

/** A container `k`, 200 by 140 at (40, 40), holding nothing. */
const DATA: DiagramData = {
  nodes: [],
  edges: [],
  containers: [{ id: 'k', role: 'container', label: 'K', box: { x: 40, y: 40, width: 200, height: 140 }, pinned: true, members: [] }],
};
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const CORNER = { x: 240, y: 180 };

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function mount(more: Partial<DiagramViewProps>) {
  const host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
    root.render(
      <DiagramView
        specs={diagramScene(DATA, { layout: 'none' })} width={400} height={300} view={VIEW} onViewChange={() => {}}
        {...more}
      />,
    );
  });
  await frame();
  const canvas = host.querySelector('canvas')!;
  const r = canvas.getBoundingClientRect();
  /** A pointer event at `(x, y)`, with the button held while `held`. */
  const fire = (type: string, x: number, y: number, held = type === 'pointerdown') => canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: held ? 1 : 0, clientX: r.left + x, clientY: r.top + y,
  }));
  /** Click the container's body, which selects it. */
  const select = async () => {
    await act(async () => {
      fire('pointermove', 100, 150);
      fire('pointerdown', 100, 150);
      fire('pointerup', 100, 150);
    });
    await frame();
  };
  /** Rest the pointer at `at` and read the cursor the canvas shows there. */
  const hover = async (at: { x: number; y: number }) => {
    await act(async () => { fire('pointermove', at.x, at.y); });
    await frame();
    return canvas.style.cursor;
  };
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await act(async () => {
      fire('pointermove', from.x, from.y);
      fire('pointerdown', from.x, from.y);
      for (let i = 1; i <= 10; i++) fire('pointermove', from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10, true);
      fire('pointerup', to.x, to.y);
    });
    await frame();
  };
  return { select, hover, drag };
}

describe('DiagramView container resize handles', () => {
  it('gives a selected container handles with onEditContainer, and reports its corner dragged as the grown box', async () => {
    const edits: ContainerEdit[] = [];
    const { select, hover, drag } = await mount({ onEditContainer: (e) => edits.push(e) });
    await select();
    expect(await hover(CORNER)).toMatch(/resize/);
    await drag(CORNER, { x: 280, y: 220 });
    expect(edits).toEqual([{ kind: 'box', id: 'k', box: { x: 40, y: 40, width: 240, height: 180 } }]);
  });

  it('gives a container no handles with only onResize, which reports shapes alone', async () => {
    const resizes: (readonly NodeResize[])[] = [];
    const { select, hover, drag } = await mount({ onResize: (r) => resizes.push(r) });
    await select();
    expect(await hover(CORNER)).not.toMatch(/resize/);
    await drag(CORNER, { x: 280, y: 220 });
    expect(resizes).toEqual([]);
  });
});
