import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReorderDragList } from './useReorderDragList';

// jsdom omits PointerEvent. Shim it so `new PointerEvent(...)` works.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  class PolyfillPointerEvent extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.isPrimary = init.isPrimary ?? false;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (globalThis as { PointerEvent?: unknown }).PointerEvent = PolyfillPointerEvent;
}

interface Item { id: string; label: string }
const ITEMS: Item[] = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
  { id: 'd', label: 'D' },
];

// Build a container with stubbed row geometry (each row 32 tall, starting at y=0).
function makeContainer(n: number): HTMLDivElement {
  const c = document.createElement('div');
  Object.defineProperty(c, 'getBoundingClientRect', {
    value: () => ({ x: 0, y: 0, top: 0, left: 0, right: 200, bottom: n * 32, width: 200, height: n * 32 } as DOMRect),
  });
  for (let i = 0; i < n; i++) {
    const row = document.createElement('div');
    row.setAttribute('data-row-index', String(i));
    Object.defineProperty(row, 'getBoundingClientRect', {
      value: () => ({ x: 0, y: i * 32, top: i * 32, left: 0, right: 200, bottom: (i + 1) * 32, width: 200, height: 32 } as DOMRect),
    });
    c.appendChild(row);
  }
  return c;
}

function makePointerEvent(type: string, x: number, y: number): React.PointerEvent {
  return new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, button: 0, isPrimary: true }) as unknown as React.PointerEvent;
}

describe('useReorderDragList', () => {
  it('plain pointerdown + pointerup (no move) does not fire onReorder', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: ['a'], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    act(() => {
      result.current.rowProps('b', 1).onPointerDown(makePointerEvent('pointerdown', 100, 48));
    });
    act(() => {
      result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 48));
    });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('drag past threshold + drop fires onReorder with [draggedId] when row is unselected', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: ['a'], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    // Pointer down on row 'c' (index 2, y=64..96, midpoint y=80).
    act(() => result.current.rowProps('c', 2).onPointerDown(makePointerEvent('pointerdown', 100, 80)));
    // Move past 4-px threshold up to y=20 (above row 0 midpoint y=16).
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 20)));
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 20)));
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['c'], 0);
  });

  it('dragging a selected row moves entire selection as one block', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: ['a', 'c'], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    // Pointer down on selected row 'a' (index 0).
    act(() => result.current.rowProps('a', 0).onPointerDown(makePointerEvent('pointerdown', 100, 16)));
    // Move down to below all rows (y > 128).
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 200)));
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 200)));
    expect(onReorder).toHaveBeenCalledWith(['a', 'c'], ITEMS.length);
  });

  it('drop below all rows yields targetIndex = items.length', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: [], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    act(() => result.current.rowProps('a', 0).onPointerDown(makePointerEvent('pointerdown', 100, 16)));
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 999)));
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 999)));
    expect(onReorder).toHaveBeenCalledWith(['a'], ITEMS.length);
  });

  it('pointercancel during drag resets state without firing onReorder', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: [], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    act(() => result.current.rowProps('a', 0).onPointerDown(makePointerEvent('pointerdown', 100, 16)));
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 64)));
    act(() => result.current.containerProps.onPointerCancel(makePointerEvent('pointercancel', 100, 64)));
    expect(onReorder).not.toHaveBeenCalled();
    expect(result.current.state.draggedIds).toBeNull();
  });

  it('drop at the source row index is a no-op (targetIndex would equal source position) — does not fire onReorder', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: [], onReorder })
    );
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    // Pointer down on row 'b' (index 1). Drag 5px (past threshold) then back.
    act(() => result.current.rowProps('b', 1).onPointerDown(makePointerEvent('pointerdown', 100, 48)));
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 55))); // engages
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 48))); // back to source row
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 48)));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('state.draggedIds is null when idle, populated when actively dragging', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useReorderDragList({ items: ITEMS, selectedIds: ['a', 'b'], onReorder })
    );
    expect(result.current.state.draggedIds).toBeNull();
    const container = makeContainer(ITEMS.length);
    act(() => result.current.containerProps.ref(container));
    act(() => result.current.rowProps('a', 0).onPointerDown(makePointerEvent('pointerdown', 100, 16)));
    expect(result.current.state.draggedIds).toBeNull(); // still pending, sub-threshold
    act(() => result.current.containerProps.onPointerMove(makePointerEvent('pointermove', 100, 64))); // past threshold
    expect(result.current.state.draggedIds).toEqual(['a', 'b']);
    act(() => result.current.containerProps.onPointerUp(makePointerEvent('pointerup', 100, 64)));
    expect(result.current.state.draggedIds).toBeNull();
  });
});
