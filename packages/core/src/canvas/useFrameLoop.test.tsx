/**
 * Frame-loop behavior that `<Canvas>` cannot observe. Canvas's own `paint`
 * bails on a null canvas ref, so after unmount every path looks alike from
 * outside — a paint spy here is what distinguishes "declined" from "ran and
 * found nothing to draw".
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useFrameLoop } from './useFrameLoop';
import type { FrameLoop } from './useFrameLoop';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function Host({ loopRef, paint, syncPaint }: {
  loopRef: { current: FrameLoop | null };
  paint: () => boolean;
  syncPaint?: boolean;
}) {
  loopRef.current = useFrameLoop(paint, { syncPaint });
  return null;
}

describe('useFrameLoop', () => {
  it('declines a sync paint once unmounted', () => {
    const loopRef = { current: null as FrameLoop | null };
    const paint = vi.fn(() => true);
    const { unmount } = render(<Host loopRef={loopRef} paint={paint} syncPaint />);

    const loop = loopRef.current!;
    act(() => { loop.requestRedraw(); });
    expect(paint).toHaveBeenCalledTimes(1);

    unmount();
    act(() => { loop.requestRedraw(); });
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it('declines a scheduled paint once unmounted', async () => {
    const loopRef = { current: null as FrameLoop | null };
    const paint = vi.fn(() => true);
    const { unmount } = render(<Host loopRef={loopRef} paint={paint} />);
    const loop = loopRef.current!;
    act(() => { loop.requestRedraw(); });
    await frame();
    await frame();
    expect(paint).toHaveBeenCalledTimes(1);

    unmount();
    act(() => { loop.requestRedraw(); });
    await frame();
    await frame();
    expect(paint).toHaveBeenCalledTimes(1);
  });
});

/**
 * A paint that throws.
 *
 * The throw skips the `!landed` branch, so before this the loop cleared the
 * dirty flag and scheduled nothing: the surface kept the last landed frame's
 * pixels and only repainted when something unrelated requested a redraw. In
 * WeaselDraw that showed up as one malformed node blanking the whole
 * document until the pointer moved.
 */
describe('useFrameLoop — a paint that throws', () => {
  it('retries on the next frame, and the retry lands', async () => {
    const loopRef = { current: null as FrameLoop | null };
    let calls = 0;
    const paint = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw new Error('bad node');
      return true;
    });
    render(<Host loopRef={loopRef} paint={paint} />);
    const loop = loopRef.current!;

    // The first frame throws out of the rAF callback; jsdom reports it as an
    // unhandled error, which is not this test's subject.
    const onError = vi.fn();
    window.addEventListener('error', onError);
    await act(async () => { loop.requestRedraw(); await frame(); });
    expect(paint).toHaveBeenCalledTimes(1);

    // No further request — the loop re-armed itself.
    await act(async () => { await frame(); await frame(); });
    expect(paint).toHaveBeenCalledTimes(2);
    window.removeEventListener('error', onError);
  });

  it('does not spin when every paint throws', async () => {
    const loopRef = { current: null as FrameLoop | null };
    const paint = vi.fn(() => { throw new Error('always bad'); });
    render(<Host loopRef={loopRef} paint={paint} />);
    const loop = loopRef.current!;

    const onError = vi.fn();
    window.addEventListener('error', onError);
    await act(async () => { loop.requestRedraw(); await frame(); });
    await act(async () => { await frame(); await frame(); await frame(); });
    // One request, one retry, then it stops asking rather than burning
    // every frame on a failure that isn't going to clear on its own.
    expect(paint).toHaveBeenCalledTimes(2);
    window.removeEventListener('error', onError);
  });
});

describe('useFrameLoop after an abandoned render', () => {
  it('keeps the committed syncPaint', () => {
    const loopRef = { current: null as FrameLoop | null };
    const paint = vi.fn(() => true);
    renderThenAbandon(false, true, (syncPaint) => (
      <Host loopRef={loopRef} paint={paint} syncPaint={syncPaint} />
    ));
    act(() => { loopRef.current!.requestRedraw(); });
    expect(paint).not.toHaveBeenCalled();
  });

  it('paints with the committed paint', () => {
    const loopRef = { current: null as FrameLoop | null };
    const a = vi.fn(() => true);
    const b = vi.fn(() => true);
    renderThenAbandon(a, b, (paint) => <Host loopRef={loopRef} paint={paint} syncPaint />);
    act(() => { loopRef.current!.requestRedraw(); });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});

describe('useFrameLoop — before-paint subscribers', () => {
  it('runs before the paint and hands both phases the same frame time', async () => {
    const loopRef = { current: null as FrameLoop | null };
    const order: string[] = [];
    const times: number[] = [];
    const paint = vi.fn(() => { order.push('paint'); return true; });
    render(<Host loopRef={loopRef} paint={paint} />);
    const loop = loopRef.current!;
    loop.subscribeBeforePaint((t) => { order.push('before'); times.push(t); });
    loop.subscribeFrame((t) => { order.push('after'); times.push(t); });

    await act(async () => { loop.requestRedraw(); await frame(); await frame(); });
    expect(order).toEqual(['before', 'paint', 'after']);
    expect(times[0]).toBeTypeOf('number');
    expect(times[1]).toBe(times[0]);
  });

  it('hands a sync paint the current time', () => {
    const loopRef = { current: null as FrameLoop | null };
    render(<Host loopRef={loopRef} paint={() => true} syncPaint />);
    const loop = loopRef.current!;
    const seen = vi.fn();
    loop.subscribeBeforePaint(seen);
    const now = vi.spyOn(performance, 'now').mockReturnValue(1234);
    try {
      act(() => { loop.requestRedraw(); });
    } finally {
      now.mockRestore();
    }
    expect(seen).toHaveBeenCalledWith(1234);
  });

  it('stops calling an unsubscribed before-paint subscriber', async () => {
    const loopRef = { current: null as FrameLoop | null };
    render(<Host loopRef={loopRef} paint={() => true} />);
    const loop = loopRef.current!;
    const seen = vi.fn();
    const off = loop.subscribeBeforePaint(seen);
    off();
    await act(async () => { loop.requestRedraw(); await frame(); await frame(); });
    expect(seen).not.toHaveBeenCalled();
  });
});
