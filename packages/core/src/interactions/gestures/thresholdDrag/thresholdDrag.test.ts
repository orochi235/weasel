import { afterEach, describe, expect, it, vi } from 'vitest';
import { startThresholdDrag } from './thresholdDrag';

interface FakeReactPointer {
  clientX: number;
  clientY: number;
  pointerId: number;
  currentTarget: HTMLElement;
}

function makeStart(x = 100, y = 100): FakeReactPointer & { _capturedId?: number; _releasedId?: number } {
  const target = document.createElement('div');
  let capturedId: number | undefined;
  let releasedId: number | undefined;
  (target as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = (id: number) => { capturedId = id; };
  (target as unknown as { releasePointerCapture: (id: number) => void }).releasePointerCapture = (id: number) => { releasedId = id; };
  return {
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: target,
    get _capturedId() { return capturedId; },
    get _releasedId() { return releasedId; },
  };
}

function fireMove(x: number, y: number) {
  const ev = new Event('pointermove') as PointerEvent;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1 });
  document.dispatchEvent(ev);
}

function fireMoveAs(pointerId: number, x: number, y: number) {
  const ev = new Event('pointermove') as PointerEvent;
  Object.assign(ev, { clientX: x, clientY: y, pointerId });
  document.dispatchEvent(ev);
}

function fireUp(x: number, y: number) {
  const ev = new Event('pointerup') as PointerEvent;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1 });
  document.dispatchEvent(ev);
}

function fireCancel(pointerId = 1) {
  const ev = new Event('pointercancel') as PointerEvent;
  Object.assign(ev, { pointerId });
  document.dispatchEvent(ev);
}

afterEach(() => {
  // Clean up any leftover listeners by triggering cancels
  vi.restoreAllMocks();
});

describe('startThresholdDrag', () => {
  it('captures the pointer on the originating element', () => {
    const start = makeStart();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      onMove: () => {},
      onCommit: () => {},
    });
    expect(start._capturedId).toBe(1);
    fireUp(100, 100);
  });

  it('does not invoke onActivate or onMove until threshold exceeded', () => {
    const start = makeStart(0, 0);
    const onActivate = vi.fn();
    const onMove = vi.fn();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      threshold: 4,
      onActivate,
      onMove,
      onCommit: () => {},
    });
    // movement squared < threshold squared (16): 2,2 -> 8
    fireMove(2, 2);
    expect(onActivate).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    fireUp(2, 2);
  });

  it('invokes onActivate exactly once when threshold first exceeded', () => {
    const start = makeStart(0, 0);
    const onActivate = vi.fn();
    const onMove = vi.fn();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      threshold: 4,
      onActivate,
      onMove,
      onCommit: () => {},
    });
    fireMove(10, 10);
    fireMove(20, 20);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledTimes(2);
    fireUp(20, 20);
  });

  it('isDragging() reflects activated state', () => {
    const start = makeStart(0, 0);
    const handle = startThresholdDrag(start as unknown as React.PointerEvent, {
      onMove: () => {},
      onCommit: () => {},
    });
    expect(handle.isDragging()).toBe(false);
    fireMove(50, 50);
    expect(handle.isDragging()).toBe(true);
    fireUp(50, 50);
  });

  it('calls onCommit on pointerup when activated; releases pointer capture', () => {
    const start = makeStart(0, 0);
    const onCommit = vi.fn();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      onMove: () => {},
      onCommit,
    });
    fireMove(50, 50);
    fireUp(60, 60);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(start._releasedId).toBe(1);
  });

  it('calls onClick, not onCancel, on a release below the threshold', () => {
    const start = makeStart(0, 0);
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const onClick = vi.fn();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      onMove: () => {},
      onCommit,
      onCancel,
      onClick,
    });
    fireUp(0, 0);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0]).toMatchObject({ type: 'pointerup', pointerId: 1 });
    expect(onCancel).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('calls onCancel, not onClick, on pointercancel', () => {
    const start = makeStart(0, 0);
    const onCancel = vi.fn();
    const onClick = vi.fn();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      onMove: () => {},
      onCommit: () => {},
      onCancel,
      onClick,
    });
    fireMove(50, 50);
    fireCancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onCancel, not onClick, when a sub-threshold press is cancelled', () => {
    const start = makeStart(0, 0);
    const onCancel = vi.fn();
    const onClick = vi.fn();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      onMove: () => {},
      onCommit: () => {},
      onCancel,
      onClick,
    });
    fireCancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('ignores a second pointer arriving mid-gesture', () => {
    const start = makeStart(0, 0);
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    const onMove = vi.fn();
    const h = startThresholdDrag(start as unknown as React.PointerEvent, { onMove, onCommit, onCancel });
    fireMove(50, 50);
    onMove.mockClear();

    fireMoveAs(2, 90, 90);
    fireCancel(2);
    expect(onMove).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(h.isDragging()).toBe(true);
  });

  it('cancel() ends a live gesture without committing', () => {
    const start = makeStart(0, 0);
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    const onClick = vi.fn();
    const h = startThresholdDrag(start as unknown as React.PointerEvent, {
      onMove: () => {}, onCommit, onCancel, onClick,
    });
    fireMove(50, 50);
    expect(h.isDragging()).toBe(true);
    h.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    // And it is really over: a later release commits nothing.
    fireUp(50, 50);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('removes listeners after commit so a stray pointermove does nothing', () => {
    const start = makeStart(0, 0);
    const onMove = vi.fn();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      onMove,
      onCommit: () => {},
    });
    fireMove(50, 50);
    fireUp(50, 50);
    onMove.mockClear();
    fireMove(100, 100);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('default threshold is 4px', () => {
    const start = makeStart(0, 0);
    const onActivate = vi.fn();
    startThresholdDrag(start as unknown as React.PointerEvent, {
      onActivate,
      onMove: () => {},
      onCommit: () => {},
    });
    // 3,0 -> 9 < 16; should not activate
    fireMove(3, 0);
    expect(onActivate).not.toHaveBeenCalled();
    // 5,0 -> 25 > 16; should activate
    fireMove(5, 0);
    expect(onActivate).toHaveBeenCalledTimes(1);
    fireUp(5, 0);
  });
});

describe('startThresholdDrag origin', () => {
  function makeOriginStart(x = 0, y = 0) {
    const container = document.createElement('div');
    const child = document.createElement('div');
    container.appendChild(child);
    document.body.appendChild(container);
    for (const el of [container, child]) {
      (el as unknown as { setPointerCapture: unknown }).setPointerCapture = vi.fn();
      (el as unknown as { releasePointerCapture: unknown }).releasePointerCapture = vi.fn();
    }
    const start = { clientX: x, clientY: y, pointerId: 1, currentTarget: child };
    return { container, child, start: start as unknown as React.PointerEvent };
  }

  it('captures on `origin` rather than on the pressed element', () => {
    const { container, child, start } = makeOriginStart();
    startThresholdDrag(start, { origin: container, onMove: () => {}, onCommit: () => {} });
    expect(container.setPointerCapture).toHaveBeenCalledWith(1);
    expect(child.setPointerCapture).not.toHaveBeenCalled();
    fireUp(0, 0);
    container.remove();
  });

  it('survives the pressed element being removed mid-drag', () => {
    const { container, child, start } = makeOriginStart();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    startThresholdDrag(start, { origin: container, onMove: () => {}, onCommit, onCancel });
    fireMove(0, 50);

    child.remove();
    const lost = new Event('lostpointercapture') as PointerEvent;
    Object.assign(lost, { pointerId: 1 });
    child.dispatchEvent(lost);

    fireUp(0, 60);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
    container.remove();
  });

  it('cancels when the origin itself is removed', () => {
    const { container, start } = makeOriginStart();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    startThresholdDrag(start, { origin: container, onMove: () => {}, onCommit, onCancel });
    fireMove(0, 50);

    container.remove();
    const lost = new Event('lostpointercapture') as PointerEvent;
    Object.assign(lost, { pointerId: 1 });
    container.dispatchEvent(lost);

    expect(onCancel).toHaveBeenCalledTimes(1);
    fireUp(0, 60);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits when capture is lost but the origin is still there', () => {
    const { container, start } = makeOriginStart();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    startThresholdDrag(start, { origin: container, onMove: () => {}, onCommit, onCancel });
    fireMove(0, 50);

    const lost = new Event('lostpointercapture') as PointerEvent;
    Object.assign(lost, { pointerId: 1 });
    container.dispatchEvent(lost);

    fireUp(0, 60);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
    container.remove();
  });
});
