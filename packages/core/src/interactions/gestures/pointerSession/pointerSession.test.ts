import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openPointerSession } from './pointerSession';

function el(): HTMLElement {
  const e = document.createElement('div');
  document.body.appendChild(e);
  return e;
}

/** A pointerdown that reports a held button, so the release rule arms. */
function down(id = 1, buttons = 1): PointerEvent {
  return new PointerEvent('pointerdown', { pointerId: id, buttons, bubbles: true });
}
function move(id = 1, buttons = 1, x = 0, y = 0): PointerEvent {
  return new PointerEvent('pointermove', { pointerId: id, buttons, clientX: x, clientY: y, bubbles: true });
}

beforeEach(() => {
  document.body.innerHTML = '';
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

describe('openPointerSession', () => {
  it('forwards moves for its own pointer and ends on pointerup', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const s = openPointerSession(el(), down(), { onMove, onEnd });

    document.dispatchEvent(move(1, 1, 10, 20));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0].clientX).toBe(10);

    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(s.active).toBe(false);

    // Listeners are gone: a later move reaches nothing.
    document.dispatchEvent(move(1, 1, 30, 40));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('ignores every event belonging to another pointer', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const s = openPointerSession(el(), down(1), { onMove, onEnd, onCancel });

    document.dispatchEvent(move(2, 1, 10, 20));
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 }));
    document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 2 }));

    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(s.active).toBe(true);
  });

  it('cancels on pointercancel', () => {
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    const s = openPointerSession(el(), down(), { onCancel, onEnd });
    document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    expect(onCancel).toHaveBeenCalledWith('pointercancel');
    expect(onEnd).not.toHaveBeenCalled();
    expect(s.active).toBe(false);
  });

  it('cancels when the origin is removed and takes capture with it', () => {
    // Nothing more is coming for a detached origin, so the drag would hang.
    const onCancel = vi.fn();
    const target = el();
    const s = openPointerSession(target, down(), { onCancel });
    target.remove();
    target.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    expect(onCancel).toHaveBeenCalledWith('lostcapture');
    expect(s.active).toBe(false);
  });

  it('keeps tracking when capture is lost but the origin is still there', () => {
    // Chrome releases capture implicitly a beat before it delivers pointerup.
    // Cancelling on that threw away a release already on its way — and the
    // session reads the document, so it never needed capture to hear it.
    const onCancel = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const target = el();
    const s = openPointerSession(target, down(), { onCancel, onMove, onEnd });

    target.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(s.active).toBe(true);

    document.dispatchEvent(move(1, 1, 30, 40));
    expect(onMove).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('a normal release does not also report a cancel', () => {
    // pointerup is followed by lostpointercapture in a real browser; the
    // session is closed by then and must not fire onCancel after onEnd.
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    const target = el();
    openPointerSession(target, down(), { onCancel, onEnd });
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    target.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('treats a move with no buttons held as the release it missed', () => {
    const onEnd = vi.fn();
    const onMove = vi.fn();
    const s = openPointerSession(el(), down(1, 1), { onEnd, onMove });
    document.dispatchEvent(move(1, 0, 5, 5));
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onMove).not.toHaveBeenCalled();
    expect(s.active).toBe(false);
  });

  it('does not apply the release rule when the environment reports no buttons', () => {
    // jsdom defaults `buttons` to 0, and a synthesized pointerdown carrying 0
    // means the source is not reporting button state at all. Reading a missed
    // release out of that would end every such drag on its first move.
    const onEnd = vi.fn();
    const onMove = vi.fn();
    const s = openPointerSession(el(), down(1, 0), { onEnd, onMove });
    document.dispatchEvent(move(1, 0, 5, 5));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(s.active).toBe(true);
  });

  it('cancel() closes the session and reports why', () => {
    const onCancel = vi.fn();
    const onMove = vi.fn();
    const s = openPointerSession(el(), down(), { onCancel, onMove });
    s.cancel();
    expect(onCancel).toHaveBeenCalledWith('aborted');
    expect(s.active).toBe(false);
    document.dispatchEvent(move());
    expect(onMove).not.toHaveBeenCalled();
  });

  it('cancel() twice reports once', () => {
    const onCancel = vi.fn();
    const s = openPointerSession(el(), down(), { onCancel });
    s.cancel();
    s.cancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // Proxy assertion: jsdom's setPointerCapture records the call and does
  // nothing else, so this can only show that the session asked — never that
  // events were retargeted. See the "jsdom API with no consequence" trap.
  it('asks the origin element for capture, and gives it back on release', () => {
    const target = el();
    const capture = vi.spyOn(target, 'setPointerCapture');
    const release = vi.spyOn(target, 'releasePointerCapture');
    openPointerSession(target, down(7), {});
    expect(capture).toHaveBeenCalledWith(7);
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
    expect(release).toHaveBeenCalledWith(7);
  });

  it('survives an origin element that refuses capture', () => {
    const target = el();
    vi.spyOn(target, 'setPointerCapture').mockImplementation(() => { throw new Error('nope'); });
    const onMove = vi.fn();
    expect(() => openPointerSession(target, down(), { onMove })).not.toThrow();
    document.dispatchEvent(move(1, 1, 3, 4));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('cancels when a fresh press arrives on the same pointer', () => {
    // The release landed on another window and the pointer never came back
    // over us, so neither pointerup nor the missed-release rule ever fired.
    // Without this the stale session resumes on the next move and steers the
    // old drag with the new press.
    const onCancel = vi.fn();
    const onMove = vi.fn();
    const s = openPointerSession(el(), down(), { onCancel, onMove });

    document.dispatchEvent(down());
    expect(onCancel).toHaveBeenCalledWith('superseded');
    expect(s.active).toBe(false);

    document.dispatchEvent(move(1, 1, 10, 20));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('a press from another pointer is not evidence about this one', () => {
    // A second finger landing is not a release of the first.
    const onCancel = vi.fn();
    const s = openPointerSession(el(), down(1), { onCancel });
    document.dispatchEvent(down(2));
    expect(onCancel).not.toHaveBeenCalled();
    expect(s.active).toBe(true);
  });

  it('does not cancel itself on the press that opened it', () => {
    // The session is opened while its own pointerdown is still propagating.
    // Document capture runs before the target, so the listener added here
    // must not see the event that created it.
    const onCancel = vi.fn();
    const target = el();
    let s: ReturnType<typeof openPointerSession> | null = null;
    target.addEventListener('pointerdown', (e) => {
      s = openPointerSession(target, e as PointerEvent, { onCancel });
    });
    target.dispatchEvent(down());
    expect(onCancel).not.toHaveBeenCalled();
    expect(s!.active).toBe(true);
  });
});
