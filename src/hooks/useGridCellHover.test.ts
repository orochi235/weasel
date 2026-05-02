import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { useGridCellHover } from './useGridCellHover';
import type { ViewTransform } from '../grid';

function makeRect(left = 0, top = 0, width = 500, height = 500): DOMRect {
  return {
    left, top, width, height,
    right: left + width, bottom: top + height,
    x: left, y: top, toJSON: () => ({}),
  } as DOMRect;
}

function makeEl(rect = makeRect()) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => rect;
  document.body.appendChild(el);
  return el;
}

function fire(el: HTMLElement, type: string, init: PointerEventInit = {}) {
  // jsdom doesn't ship PointerEvent — fall back to a typed MouseEvent that
  // exposes the same fields the hook reads (clientX/clientY).
  const ctor = (typeof PointerEvent === 'function' ? PointerEvent : MouseEvent) as typeof MouseEvent;
  el.dispatchEvent(new ctor(type, { bubbles: true, ...init }));
}

const identityView: ViewTransform = { panX: 0, panY: 0, zoom: 1 };

describe('useGridCellHover', () => {
  it('translates pointermove into the integer cell under the cursor', () => {
    const el = makeEl();
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = el;
    const { result } = renderHook(() =>
      useGridCellHover({ ref, view: () => identityView, spacing: 10 }),
    );
    act(() => { fire(el, 'pointermove', { clientX: 25, clientY: 7 }); });
    expect(result.current.cell).toEqual({ col: 2, row: 0 });
    expect(result.current.getCell()).toEqual({ col: 2, row: 0 });
  });

  it('only updates state when the cell actually changes', () => {
    const el = makeEl();
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = el;
    const onChange = vi.fn();
    renderHook(() =>
      useGridCellHover({ ref, view: () => identityView, spacing: 10, onChange }),
    );
    // Three moves all inside col 2, row 0: only one onChange fire.
    act(() => {
      fire(el, 'pointermove', { clientX: 21, clientY: 1 });
      fire(el, 'pointermove', { clientX: 25, clientY: 5 });
      fire(el, 'pointermove', { clientX: 29, clientY: 9 });
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ col: 2, row: 0 });
    // Cross into col 3 — onChange fires again.
    act(() => { fire(el, 'pointermove', { clientX: 31, clientY: 5 }); });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({ col: 3, row: 0 });
  });

  it('resets to null on pointerleave', () => {
    const el = makeEl();
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = el;
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useGridCellHover({ ref, view: () => identityView, spacing: 10, onChange }),
    );
    act(() => { fire(el, 'pointermove', { clientX: 5, clientY: 5 }); });
    expect(result.current.cell).toEqual({ col: 0, row: 0 });
    act(() => { fire(el, 'pointerleave'); });
    expect(result.current.cell).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('honors view pan and zoom when projecting to world space', () => {
    const el = makeEl();
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = el;
    // pan = (10,10), zoom = 2 → screen(30,30) maps to world((30-10)/2, (30-10)/2) = (10, 10)
    const view: ViewTransform = { panX: 10, panY: 10, zoom: 2 };
    const { result } = renderHook(() =>
      useGridCellHover({ ref, view: () => view, spacing: 10 }),
    );
    act(() => { fire(el, 'pointermove', { clientX: 30, clientY: 30 }); });
    expect(result.current.cell).toEqual({ col: 1, row: 1 });
  });

  it('subtracts the element bounding rect so layout offsets do not leak in', () => {
    const el = makeEl(makeRect(50, 100));
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = el;
    const { result } = renderHook(() =>
      useGridCellHover({ ref, view: () => identityView, spacing: 10 }),
    );
    act(() => { fire(el, 'pointermove', { clientX: 75, clientY: 117 }); });
    // local: (25, 17) → cell (2, 1)
    expect(result.current.cell).toEqual({ col: 2, row: 1 });
  });

  it('does not attach listeners when enabled is false', () => {
    const el = makeEl();
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement }).current = el;
    const { result } = renderHook(() =>
      useGridCellHover({ ref, view: () => identityView, spacing: 10, enabled: false }),
    );
    act(() => { fire(el, 'pointermove', { clientX: 50, clientY: 50 }); });
    expect(result.current.cell).toBeNull();
  });
});
