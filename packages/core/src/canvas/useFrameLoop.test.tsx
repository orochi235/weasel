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
