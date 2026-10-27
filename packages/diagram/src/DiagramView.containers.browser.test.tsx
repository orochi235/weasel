import { act } from '@testing-library/react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagramView, type ContainerEdit, type DiagramViewProps, type EdgeRoute, type NodeMove } from './DiagramView';
import { diagramScene, type DiagramData } from './fromData';

/** A container `k` holding `c`, a pool `p` of two rows, and two shapes outside both, all pinned. */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['a'], width: 60, height: 40, at: { x: 60, y: 300 }, pinned: true },
    { id: 'b', lines: ['b'], width: 60, height: 40, at: { x: 60, y: 380 }, pinned: true },
    { id: 'c', lines: ['c'], width: 60, height: 40, at: { x: 160, y: 100 }, pinned: true },
  ],
  edges: [],
  containers: [
    { id: 'k', role: 'container', label: 'K', box: { x: 40, y: 40, width: 200, height: 140 }, pinned: true, members: ['c'] },
    {
      id: 'p', role: 'pool', label: 'P', box: { x: 300, y: 40, width: 280, height: 240 }, pinned: true,
      lanes: [{ id: 'l1', label: 'one', size: 120 }, { id: 'l2', label: 'two', size: 120 }],
    },
  ],
};
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function mount(more: Partial<DiagramViewProps> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const moves: (readonly NodeMove[])[] = [];
  const edits: ContainerEdit[] = [];
  await act(async () => {
    root = createRoot(host);
    root.render(
      <DiagramView
        specs={diagramScene(DATA, { layout: 'none' })} width={640} height={480} view={VIEW} onViewChange={() => {}}
        onMove={(m: readonly NodeMove[], _r: readonly EdgeRoute[]) => moves.push(m)} onEditContainer={(e) => edits.push(e)}
        {...more}
      />,
    );
  });
  await frame();
  const canvas = host.querySelector('canvas')!;
  const r = canvas.getBoundingClientRect();
  const fire = (type: string, x: number, y: number) => canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + x, clientY: r.top + y,
  }));
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }, midway?: () => void) => {
    await act(async () => {
      fire('pointermove', from.x, from.y);
      fire('pointerdown', from.x, from.y);
      for (let i = 1; i <= 10; i++) fire('pointermove', from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
    });
    midway?.();
    await act(async () => {
      fire('pointerup', to.x, to.y);
    });
    await frame();
  };
  const click = async (at: { x: number; y: number }) => {
    await act(async () => {
      fire('pointermove', at.x, at.y);
      fire('pointerdown', at.x, at.y);
      fire('pointerup', at.x, at.y);
    });
    await frame();
  };
  // Both clicks in one task: the recognizer times them on performance.now() against a
  // 600ms window, and a frame awaited between them took over 600ms in a loaded fleet run.
  const doubleClick = async (at: { x: number; y: number }) => {
    await act(async () => {
      fire('pointermove', at.x, at.y);
      for (let i = 0; i < 2; i++) {
        fire('pointerdown', at.x, at.y);
        fire('pointerup', at.x, at.y);
      }
      canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + at.x, clientY: r.top + at.y, detail: 2 }));
    });
    await frame();
  };
  return { moves, edits, drag, click, doubleClick };
}

describe('DiagramView containers from data', () => {
  it('reports a shape dragged into a container with the container as its parent, once', async () => {
    const { moves, edits, drag } = await mount();
    await drag({ x: 90, y: 320 }, { x: 130, y: 110 });
    expect(moves).toEqual([[{ id: 'a', x: 100, y: 90, parent: 'k' }]]);
    expect(edits).toEqual([]);
  });

  it('reports a shape dragged into a lane with the lane as its parent, once', async () => {
    const { moves, drag } = await mount();
    await drag({ x: 90, y: 400 }, { x: 450, y: 220 });
    expect(moves).toEqual([[{ id: 'b', x: 420, y: 200, parent: 'l2' }]]);
  });

  it('reports a shape dragged from a container into a lane with the lane as its parent', async () => {
    const { moves, drag } = await mount();
    await drag({ x: 190, y: 120 }, { x: 450, y: 220 });
    expect(moves).toEqual([[{ id: 'c', x: 420, y: 200, parent: 'l2' }]]);
  });

  it('shows the reason a container refuses a shape while it is dragged over it, and moves nothing on release', async () => {
    const asked: [readonly string[], string][] = [];
    const { moves, drag } = await mount({
      canReparent: (ids, into) => {
        asked.push([ids, into]);
        return into === 'k' ? { refuse: 'K takes no more shapes' } : true;
      },
    });
    let shown: string | null = null;
    await drag({ x: 90, y: 320 }, { x: 130, y: 110 }, () => {
      shown = document.querySelector('[role="status"]')?.textContent ?? null;
    });
    expect(shown).toBe('K takes no more shapes');
    expect(asked).toContainEqual([['a'], 'k']);
    expect(moves).toEqual([]);
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it('reports a lane boundary dragged as the pool\'s lane sizes, once', async () => {
    const { edits, drag } = await mount();
    await drag({ x: 450, y: 160 }, { x: 450, y: 190 });
    expect(edits).toEqual([{ kind: 'lanes', pool: 'p', lanes: [{ id: 'l1', size: 150 }, { id: 'l2', size: 120 }] }]);
  });

  it('reports a lane dragged by its header past the one before it as the new order, once', async () => {
    const { edits, drag } = await mount();
    await drag({ x: 346, y: 220 }, { x: 346, y: 60 });
    expect(edits).toEqual([{ kind: 'lanes', pool: 'p', lanes: [{ id: 'l2', size: 120 }, { id: 'l1', size: 120 }] }]);
  });

  it('reports the add-lane button as the lanes with a new one at the end, once', async () => {
    const { edits, click } = await mount();
    await click({ x: 440, y: 294 });
    expect(edits).toHaveLength(1);
    const edit = edits[0] as Extract<ContainerEdit, { kind: 'lanes' }>;
    expect(edit.lanes.slice(0, 2)).toEqual([{ id: 'l1', size: 120 }, { id: 'l2', size: 120 }]);
    expect(edit.lanes).toHaveLength(3);
    expect(edit.lanes[2]!.size).toBe(120);
  });

  it('reports a container dragged as its box, once', async () => {
    const { edits, drag } = await mount();
    await drag({ x: 140, y: 150 }, { x: 160, y: 170 });
    expect(edits).toEqual([{ kind: 'box', id: 'k', box: { x: 60, y: 60, width: 200, height: 140 } }]);
  });

  it('reports a double-click on a header as the region whose title to edit', async () => {
    const { edits, doubleClick } = await mount();
    await doubleClick({ x: 140, y: 54 });
    expect(edits).toEqual([{ kind: 'title', id: 'k' }]);
  });
});
