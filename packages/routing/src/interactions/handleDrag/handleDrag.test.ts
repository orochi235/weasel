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
  it('leaves a live drag to its finger when a second finger presses the handle', () => {
    const onMove = vi.fn();
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove, onStart, onCancel, onEnd }));
    const target = mount();
    const finger = (pointerId: number, x: number) =>
      ({ ...press(target, x, 0), pointerType: 'touch', button: 0, pointerId }) as unknown as React.PointerEvent<HTMLDivElement>;

    result.current.onPointerDown(finger(1, 10));
    result.current.onPointerDown(finger(2, 60));
    target.dispatchEvent(makePointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 0 }));
    target.dispatchEvent(makePointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 0 }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onMove).toHaveBeenCalledWith({ x: 20, y: 0 }, expect.anything());
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores a right or middle mouse press, and leaves a live drag alone', () => {
    const onMove = vi.fn();
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove, onStart, onCancel }));
    const target = mount();
    const mouse = (button: number) => ({ ...press(target, 0, 0), pointerType: 'mouse', button }) as unknown as React.PointerEvent<HTMLDivElement>;

    result.current.onPointerDown(mouse(2));
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 5, clientY: 5 }));
    expect(onStart).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();

    result.current.onPointerDown(mouse(0));
    result.current.onPointerDown(mouse(1));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    document.body.removeChild(target);
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

  it('calls onStart on pointerdown and onEnd on pointerup, and stops reporting moves after it', () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onMove = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove, onStart, onEnd }),
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

    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 99, clientY: 99 }));
    expect(onMove).not.toHaveBeenCalled();

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

  it('ends with moved true when the release lands away from the press with no move before it', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove: () => {}, onEnd }));
    const target = mount();
    result.current.onPointerDown(press(target, 0, 0));
    target.dispatchEvent(makePointerEvent('pointerup', { clientX: 30, clientY: 40 }));
    expect(onEnd.mock.calls[0][0]).toMatchObject({ point: { x: 30, y: 40 }, moved: true });
    result.current.onPointerDown(press(target, 0, 0));
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 5, clientY: 0, buttons: 0 }));
    expect(onEnd.mock.calls[1][0]).toMatchObject({ point: { x: 5, y: 0 }, moved: true });
    target.remove();
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

  it('a pointermove that stays where it pressed is not a move', () => {
    // Chrome sends one when the layout shifts under a still pointer.
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useHandleDrag<HTMLDivElement>({ onMove: () => {}, onEnd }),
    );
    const target = mount();
    result.current.onPointerDown(press(target, 5, 5));
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 5, clientY: 5 }));
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

  it('cancels with lostcapture when the handle leaves the DOM mid-drag', () => {
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

describe('useHandleDrag — callbacks from a later render', () => {
  it('ends the drag with the onEnd from the latest render, not the one that saw the press', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { result, rerender } = renderHook(
      ({ onEnd }: { onEnd: () => void }) => useHandleDrag<HTMLDivElement>({ onMove: () => {}, onEnd }),
      { initialProps: { onEnd: first } },
    );
    const target = mount();
    result.current.onPointerDown(press(target, 0, 0));
    // What a consumer does when `onMove` sets state that `onEnd` closes over.
    rerender({ onEnd: latest });
    target.dispatchEvent(makePointerEvent('pointerup', { clientX: 5, clientY: 5 }));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    target.remove();
  });

  it('cancels on Escape only when asked to', () => {
    for (const escape of [true, false]) {
      const target = mount();
      const onCancel = vi.fn();
      const onEnd = vi.fn();
      const { result, unmount } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove: () => {}, onCancel, onEnd, escape }));
      result.current.onPointerDown(press(target, 10, 10));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(onCancel.mock.calls).toEqual(escape ? [['escape']] : []);
      document.dispatchEvent(makePointerEvent('pointerup', { clientX: 10, clientY: 10 }));
      expect(onEnd).toHaveBeenCalledTimes(escape ? 0 : 1);
      unmount();
      target.remove();
    }
  });

  it('cancels on a window blur, so a release in another app is not committed', () => {
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove: () => {}, onEnd, onCancel }));
    const target = mount();
    result.current.onPointerDown(press(target, 10, 10));
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 20, clientY: 10, buttons: 1 }));
    window.dispatchEvent(new Event('blur'));
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 90, clientY: 90, buttons: 0 }));
    expect(onCancel).toHaveBeenCalledWith('blur');
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('follows a scroll during the drag, so a still pointer reports a point that moved with the page', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    const target = mount();
    scroller.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollTop = 30;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 40 });
    scroller.remove();
  });
  it('leaves out a scroll above a fixed ancestor, which does not move the rect', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    document.body.appendChild(scroller);
    scroller.appendChild(panel);
    const target = mount();
    panel.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollTop = 30;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 10 });
    scroller.remove();
  });

  it('leaves out the scroll a sticky rect sticks in', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    scroller.style.overflow = 'auto';
    document.body.appendChild(scroller);
    const target = mount();
    target.style.position = 'sticky';
    target.style.top = '0';
    scroller.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollTop = 30;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 10 });
    scroller.remove();
  });

  it('sticks a sticky rect in the scroller past an overflow: clip parent, which does not scroll', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    scroller.style.overflow = 'auto';
    const clipper = document.createElement('div');
    clipper.style.overflow = 'clip';
    document.body.appendChild(scroller);
    scroller.appendChild(clipper);
    const target = mount();
    target.style.position = 'sticky';
    target.style.top = '0';
    clipper.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollTop = 30;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 10 });
    scroller.remove();
  });

  it('counts the scroll a sticky rect sticks in on the axis it has no inset on', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    scroller.style.overflow = 'auto';
    document.body.appendChild(scroller);
    const target = mount();
    target.style.position = 'sticky';
    target.style.top = '0';
    scroller.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollLeft = 20;
    scroller.scrollTop = 30;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 30, y: 10 });
    scroller.remove();
  });

  it('counts the scroll a sticky box sticks in while the box is not yet stuck', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    scroller.style.overflow = 'auto';
    document.body.appendChild(scroller);
    const header = document.createElement('div');
    header.style.position = 'sticky';
    header.style.top = '0';
    // Not stuck yet: the header still rides the scroll.
    header.getBoundingClientRect = () => ({ left: 0, top: 50 - scroller.scrollTop, right: 100, bottom: 150 - scroller.scrollTop, width: 100, height: 100, x: 0, y: 50 - scroller.scrollTop, toJSON: () => ({}) });
    scroller.appendChild(header);
    const target = mount();
    header.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollTop = 30;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 40 });
    scroller.remove();
  });

  it('reads a sticky rect stuck to the viewport against the viewport, not the root box the page scrolls', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const root = document.documentElement;
    const rootRect = root.getBoundingClientRect;
    root.getBoundingClientRect = () => ({ left: 0, top: -root.scrollTop, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: -root.scrollTop, toJSON: () => ({}) });
    const target = mount();
    target.style.position = 'sticky';
    target.style.top = '0';
    // At top 100 unscrolled, stuck at the viewport's top once the page scrolls past it.
    target.getBoundingClientRect = () => {
      const top = Math.max(0, 100 - root.scrollTop);
      return { left: 0, top, right: 100, bottom: top + 100, width: 100, height: 100, x: 0, y: top, toJSON: () => ({}) };
    };
    result.current.onPointerDown(press(target, 10, 110));
    root.scrollTop = 50;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 110 }));
    root.scrollTop = 200;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 111 }));
    root.scrollTop = 0;
    root.getBoundingClientRect = rootRect;
    target.remove();
    expect(onMove.mock.calls.map((c) => c[0])).toEqual([{ x: 10, y: 60 }, { x: 10, y: 111 }]);
  });

  it('follows a scroll outside the shadow root the rect is in', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    const host = document.createElement('div');
    scroller.appendChild(host);
    const target = mount();
    host.attachShadow({ mode: 'open' }).appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollTop = 30;
    document.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 40 });
    scroller.remove();
  });

  it('follows a scroll inside the shadow root a slotted rect is shown in', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    const host = document.createElement('div');
    scroller.appendChild(host);
    const inner = document.createElement('div');
    inner.appendChild(document.createElement('slot'));
    host.attachShadow({ mode: 'open' }).appendChild(inner);
    const target = mount();
    host.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollTop = 30;
    inner.scrollTop = 5;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 45 });
    scroller.remove();
  });

  it('moves the rect by a scroll at the scale a transform shows the scroller at', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    mockRect(scroller, { left: 0, top: 0, width: 200, height: 200 });
    Object.defineProperty(scroller, 'offsetWidth', { value: 100 });
    Object.defineProperty(scroller, 'offsetHeight', { value: 100 });
    const target = mount();
    mockRect(target, { left: 0, top: 0, width: 200, height: 200 });
    Object.defineProperty(target, 'offsetWidth', { value: 100 });
    Object.defineProperty(target, 'offsetHeight', { value: 100 });
    scroller.appendChild(target);
    result.current.onPointerDown(press(target, 20, 20));
    scroller.scrollTop = 10;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 20, clientY: 20 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 20 });
    scroller.remove();
  });
  it('counts a scroll above the transformed box that holds a fixed one, which moves it', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const scroller = document.createElement('div');
    const holder = document.createElement('div');
    holder.style.transform = 'translateX(0px)';
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    document.body.appendChild(scroller);
    scroller.appendChild(holder);
    holder.appendChild(panel);
    const target = mount();
    panel.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    scroller.scrollTop = 30;
    panel.scrollTop = 5;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 45 });
    scroller.remove();
  });
  it('counts a scroll of the transformed box that holds a fixed one, which moves it', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const holder = document.createElement('div');
    holder.style.transform = 'translateX(0px)';
    holder.style.overflow = 'auto';
    document.body.appendChild(holder);
    const target = mount();
    target.style.position = 'fixed';
    holder.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    holder.scrollTop = 20;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 30 });
    holder.remove();
  });

  it.each([
    ['will-change', 'transform'],
    ['will-change', 'filter'],
    ['backdrop-filter', 'blur(2px)'],
    ['container-type', 'inline-size'],
    ['translate', '10px'],
    ['rotate', '5deg'],
    ['scale', '2'],
    ['content-visibility', 'auto'],
    ['transform-style', 'preserve-3d'],
    ['offset-path', 'path("M 0 0 L 10 10")'],
    ['will-change', 'offset-path'],
  ])('counts a scroll of a box whose %s: %s holds a fixed one', (prop, value) => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const holder = document.createElement('div');
    holder.style.setProperty(prop, value);
    holder.style.overflow = 'auto';
    document.body.appendChild(holder);
    const target = mount();
    target.style.position = 'fixed';
    holder.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    holder.scrollTop = 20;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 30 });
    holder.remove();
  });

  it('measures an SVG handle in an iframe against its owning svg', () => {
    const onStart = vi.fn();
    const { result } = renderHook(() => useHandleDrag<SVGElement>({ onMove: () => {}, onStart }));
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const dot = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    svg.appendChild(dot);
    doc.body.appendChild(svg);
    mockRect(svg, { left: 100, top: 100 });
    mockRect(dot, { left: 150, top: 150 });
    dot.setPointerCapture = vi.fn();
    dot.releasePointerCapture = vi.fn();
    result.current.onPointerDown({ ...press(dot as unknown as HTMLDivElement, 110, 110), currentTarget: dot } as unknown as React.PointerEvent<SVGElement>);
    expect(onStart.mock.calls[0]![0]).toEqual({ x: 10, y: 10 });
    frame.remove();
  });

  it('moves the rect by a scroll at the scale a transform shows an iframe scroller at', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    const scroller = doc.createElement('div');
    doc.body.appendChild(scroller);
    mockRect(scroller, { left: 0, top: 0, width: 200, height: 200 });
    Object.defineProperty(scroller, 'offsetWidth', { value: 100 });
    Object.defineProperty(scroller, 'offsetHeight', { value: 100 });
    const target = doc.createElement('div') as HTMLDivElement;
    mockRect(target, { left: 0, top: 0 });
    target.setPointerCapture = vi.fn();
    target.releasePointerCapture = vi.fn();
    scroller.appendChild(target);
    result.current.onPointerDown(press(target, 20, 20));
    scroller.scrollTop = 10;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 20, clientY: 20 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 20, y: 40 });
    frame.remove();
  });

  it('leaves out a scroll between an absolute rect and its containing block, which does not move it', () => {
    const onMove = vi.fn();
    const { result } = renderHook(() => useHandleDrag<HTMLDivElement>({ onMove }));
    const block = document.createElement('div');
    block.style.position = 'relative';
    const wrapper = document.createElement('div');
    wrapper.style.overflow = 'auto';
    document.body.appendChild(block);
    block.appendChild(wrapper);
    const target = mount();
    target.style.position = 'absolute';
    wrapper.appendChild(target);
    result.current.onPointerDown(press(target, 10, 10));
    wrapper.scrollTop = 30;
    block.scrollTop = 5;
    target.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    expect(onMove.mock.calls[0]![0]).toEqual({ x: 10, y: 15 });
    block.remove();
  });
});
