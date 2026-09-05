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

/** A handle mounted in the document with a rect at the origin. */
function mount(): HTMLDivElement {
  const target = document.createElement('div');
  document.body.appendChild(target);
  mockRect(target, { left: 0, top: 0 });
  target.setPointerCapture = vi.fn();
  target.releasePointerCapture = vi.fn();
  return target;
}

function press(target: HTMLDivElement, clientX: number, clientY: number): React.PointerEvent<HTMLDivElement> {
  return {
    preventDefault: () => {},
    currentTarget: target,
    pointerId: 1,
    buttons: 1,
    clientX,
    clientY,
  } as unknown as React.PointerEvent<HTMLDivElement>;
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

  it('reports a cancelled pointer as a cancel, not as an end', () => {
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove: () => {}, onEnd, onCancel }),
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
    expect(onCancel).toHaveBeenCalledWith('pointercancel');
    expect(onEnd).not.toHaveBeenCalled();

    document.body.removeChild(target);
  });

  it('reports the end point and whether the pointer moved at all', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove: () => {}, onEnd }),
    );
    const target = mount();
    result.current.onPointerDown(press(target, 0, 0));

    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 30, clientY: 40 }));
    target.dispatchEvent(makePointerEvent('pointerup', { clientX: 30, clientY: 40 }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][0]).toMatchObject({ point: { x: 30, y: 40 }, moved: true });

    document.body.removeChild(target);
  });

  it('a press that never moves ends with moved false', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove: () => {}, onEnd }),
    );
    const target = mount();
    result.current.onPointerDown(press(target, 5, 5));
    target.dispatchEvent(makePointerEvent('pointerup', { clientX: 5, clientY: 5 }));
    expect(onEnd.mock.calls[0][0]).toMatchObject({ moved: false });

    document.body.removeChild(target);
  });

  it('ignores a second pointer arriving mid-drag', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove, onEnd }),
    );
    const target = mount();
    result.current.onPointerDown(press(target, 0, 0));

    target.dispatchEvent(makePointerEvent('pointermove', { pointerId: 2, clientX: 9, clientY: 9 }));
    target.dispatchEvent(makePointerEvent('pointerup', { pointerId: 2 }));
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();

    // The real pointer still drives it.
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 9, clientY: 9 }));
    expect(onMove).toHaveBeenCalledTimes(1);

    document.body.removeChild(target);
  });

  it('keeps driving after the handle leaves the DOM under it', () => {
    // The old lifecycle hung its listeners on the handle, so removing the
    // handle mid-drag stranded the gesture with no end and no cancel.
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove: () => {}, onCancel }),
    );
    const target = mount();
    result.current.onPointerDown(press(target, 0, 0));

    document.body.removeChild(target);
    target.dispatchEvent(makePointerEvent('lostpointercapture'));
    expect(onCancel).toHaveBeenCalledWith('lostcapture');
  });

  it('cancels an in-flight drag when the component unmounts', () => {
    const onCancel = vi.fn();
    const { result, unmount } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove: () => {}, onCancel }),
    );
    const target = mount();
    result.current.onPointerDown(press(target, 0, 0));
    unmount();
    expect(onCancel).toHaveBeenCalledWith('aborted');

    document.body.removeChild(target);
  });
});
