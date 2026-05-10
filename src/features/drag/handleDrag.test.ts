import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHandleDrag } from './handleDrag';

function makePointerEvent(type: string, init: Partial<PointerEvent> = {}): PointerEvent {
  const ev = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(ev, {
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    ...init,
  });
  return ev;
}

function mockRect(el: Element, rect: { left: number; top: number; width?: number; height?: number }) {
  (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      right: rect.left + (rect.width ?? 100),
      bottom: rect.top + (rect.height ?? 100),
      width: rect.width ?? 100,
      height: rect.height ?? 100,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe('useHandleDrag', () => {
  it('returns an onPointerDown handler', () => {
    const { result } = renderHook(() => useHandleDrag({ onMove: () => {} }));
    expect(typeof result.current.onPointerDown).toBe('function');
  });

  it('reports local coords (clientX/Y minus rect origin) on move', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));

    const target = document.createElement('div');
    document.body.appendChild(target);
    mockRect(target, { left: 10, top: 20 });
    target.setPointerCapture = vi.fn();
    target.releasePointerCapture = vi.fn();

    const fakeReact = {
      preventDefault: () => {},
      currentTarget: target,
      pointerId: 1,
      clientX: 15,
      clientY: 25,
    } as unknown as React.PointerEvent<HTMLDivElement>;
    result.current.onPointerDown(fakeReact);

    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 50, clientY: 80 }));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0]).toEqual({ x: 40, y: 60 });

    document.body.removeChild(target);
  });

  it('calls onStart on pointerdown and onEnd on pointerup', () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove: () => {}, onStart, onEnd }),
    );

    const target = document.createElement('div');
    document.body.appendChild(target);
    mockRect(target, { left: 0, top: 0 });
    target.setPointerCapture = vi.fn();
    target.releasePointerCapture = vi.fn();

    const fakeReact = {
      preventDefault: () => {},
      currentTarget: target,
      pointerId: 1,
      clientX: 5,
      clientY: 7,
    } as unknown as React.PointerEvent<HTMLDivElement>;
    result.current.onPointerDown(fakeReact);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0]).toEqual({ x: 5, y: 7 });

    target.dispatchEvent(makePointerEvent('pointerup'));
    expect(onEnd).toHaveBeenCalledTimes(1);

    // Listeners should be cleaned up: subsequent move triggers nothing.
    const onMoveAfter = vi.fn();
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 99, clientY: 99 }));
    expect(onMoveAfter).not.toHaveBeenCalled();

    document.body.removeChild(target);
  });

  it('uses custom getRect when provided', () => {
    const onMove = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    mockRect(container, { left: 100, top: 200 });

    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove, getRect: () => container }),
    );

    const target = document.createElement('div');
    container.appendChild(target);
    mockRect(target, { left: 110, top: 210 });
    target.setPointerCapture = vi.fn();
    target.releasePointerCapture = vi.fn();

    const fakeReact = {
      preventDefault: () => {},
      currentTarget: target,
      pointerId: 1,
      clientX: 110,
      clientY: 210,
    } as unknown as React.PointerEvent<HTMLDivElement>;
    result.current.onPointerDown(fakeReact);

    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 150, clientY: 260 }));
    expect(onMove.mock.calls[0][0]).toEqual({ x: 50, y: 60 });

    document.body.removeChild(container);
  });

  it('cleans up on pointercancel as well', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove: () => {}, onEnd }),
    );

    const target = document.createElement('div');
    document.body.appendChild(target);
    mockRect(target, { left: 0, top: 0 });
    target.setPointerCapture = vi.fn();
    target.releasePointerCapture = vi.fn();

    const fakeReact = {
      preventDefault: () => {},
      currentTarget: target,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    } as unknown as React.PointerEvent<HTMLDivElement>;
    result.current.onPointerDown(fakeReact);

    target.dispatchEvent(makePointerEvent('pointercancel'));
    expect(onEnd).toHaveBeenCalledTimes(1);

    document.body.removeChild(target);
  });
});
