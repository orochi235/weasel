import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagramView, type DiagramViewApi, type DiagramViewProps } from './DiagramView';
import { diagramScene } from './fromData';
import type { ReorderChange } from './groupReorder';
import type { NodeMove } from './sceneSync';

afterEach(() => { cleanup(); });

/** A container whose three members stand in a row, marked to reorder along it, and a node outside it. */
const ROW = diagramScene({
  nodes: [
    ...['m1', 'm2', 'm3'].map((id, k) => ({ id, lines: [id], width: 60, height: 40, at: { x: 60 + 100 * k, y: 140 }, pinned: true })),
    { id: 'out', lines: ['out'], width: 60, height: 40, at: { x: 500, y: 400 }, pinned: true },
  ],
  edges: [],
  containers: [{ id: 'k', role: 'container', label: 'K', members: ['m1', 'm2', 'm3'], reorder: 'x', box: { x: 40, y: 100, width: 320, height: 100 }, pinned: true }],
}, { layout: 'none' });
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function mount(extra: Partial<DiagramViewProps> = {}) {
  const api = createRef<DiagramViewApi>();
  const changes: ReorderChange[] = [];
  const moves: NodeMove[] = [];
  const { container } = render(
    <DiagramView
      ref={api} specs={ROW} width={700} height={500} view={IDENTITY} onViewChange={() => {}}
      onReorder={(c) => changes.push(c)} onMove={(m) => moves.push(...m)} {...extra}
    />,
  );
  return { api, changes, moves, canvas: container.querySelector('canvas')! };
}

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number) =>
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1,
  }));

const middle = (r: { x: number; y: number; width: number; height: number }) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

describe('DiagramView with both onReorder and onMove', () => {
  it('reorders a container member dragged within the container, and moves nothing', () => {
    const { api, canvas, changes, moves } = mount();
    const from = middle(api.current!.rectOf('m1')!);
    act(() => {
      pointer(canvas, 'pointerdown', from.x, from.y);
      for (let i = 1; i <= 12; i++) pointer(canvas, 'pointermove', from.x + (110 * i) / 12, from.y);
      pointer(canvas, 'pointerup', from.x + 110, from.y);
    });
    expect(changes).toEqual([{ parent: 'k', order: ['m2', 'm1', 'm3'] }]);
    expect(moves.filter((m) => m.id === 'm1')).toEqual([]);
  });

  it('draws the reorder\'s slide while a member is carried within the container', () => {
    const { api, canvas } = mount();
    const from = middle(api.current!.rectOf('m1')!);
    const m2 = api.current!.rectOf('m2')!;
    act(() => {
      pointer(canvas, 'pointerdown', from.x, from.y);
      for (let i = 1; i <= 12; i++) pointer(canvas, 'pointermove', from.x + (110 * i) / 12, from.y);
    });
    // m2 slides into the place m1 left.
    expect(api.current!.rectOf('m2')!.x).toBeLessThan(m2.x);
    act(() => { pointer(canvas, 'pointerup', from.x + 110, from.y); });
  });

  it('hands a member dragged out of the container\'s box to the move, and reorders nothing', () => {
    const { api, canvas, changes, moves } = mount();
    const from = middle(api.current!.rectOf('m2')!);
    const k = api.current!.rectOf('k')!;
    const dy = k.y + k.height + 80 - from.y;
    act(() => {
      pointer(canvas, 'pointerdown', from.x, from.y);
      for (let i = 1; i <= 12; i++) pointer(canvas, 'pointermove', from.x, from.y + (dy * i) / 12);
      pointer(canvas, 'pointerup', from.x, from.y + dy);
    });
    expect(changes).toEqual([]);
    expect(moves.filter((m) => m.id === 'm2').at(-1)).toMatchObject({ id: 'm2', parent: null });
  });

  it('moves a node outside any reorderable container', () => {
    const { api, canvas, changes, moves } = mount();
    const from = middle(api.current!.rectOf('out')!);
    act(() => {
      pointer(canvas, 'pointerdown', from.x, from.y);
      for (let i = 1; i <= 12; i++) pointer(canvas, 'pointermove', from.x + (40 * i) / 12, from.y);
      pointer(canvas, 'pointerup', from.x + 40, from.y);
    });
    expect(changes).toEqual([]);
    expect(moves.some((m) => m.id === 'out')).toBe(true);
  });

  it('reorders without onMove, and moves without onReorder', () => {
    const along = (canvas: HTMLCanvasElement, from: { x: number; y: number }) => act(() => {
      pointer(canvas, 'pointerdown', from.x, from.y);
      for (let i = 1; i <= 12; i++) pointer(canvas, 'pointermove', from.x + (110 * i) / 12, from.y);
      pointer(canvas, 'pointerup', from.x + 110, from.y);
    });
    const reorderOnly = mount({ onMove: undefined });
    along(reorderOnly.canvas, middle(reorderOnly.api.current!.rectOf('m1')!));
    expect(reorderOnly.changes).toEqual([{ parent: 'k', order: ['m2', 'm1', 'm3'] }]);
    cleanup();
    const moveOnly = mount({ onReorder: undefined });
    along(moveOnly.canvas, middle(moveOnly.api.current!.rectOf('m1')!));
    expect(moveOnly.moves.some((m) => m.id === 'm1')).toBe(true);
  });

  it('steps the selected member with Alt and an arrow key', async () => {
    const { api, canvas, changes } = mount();
    const { x, y } = middle(api.current!.rectOf('m3')!);
    act(() => {
      pointer(canvas, 'pointerdown', x, y);
      pointer(canvas, 'pointerup', x, y);
    });
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true, bubbles: true }));
    });
    expect(changes).toEqual([{ parent: 'k', order: ['m1', 'm3', 'm2'] }]);
  });
});
