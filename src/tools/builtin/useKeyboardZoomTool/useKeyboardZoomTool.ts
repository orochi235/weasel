import { useMemo, useRef } from 'react';
import { defineViewportTool, claim, none, type Result } from '../../routing';
import type { Tool, ToolCtx } from '../../types';
import { zoomAt } from 'core/viewport/zoomAt';
import { useViewTween } from 'core/viewport/useViewTween';
import type { View } from 'core/viewport/view';

export interface KeyboardZoomToolOpts {
  min?: number;
  max?: number;
  /** Multiplicative step per Cmd+= / Cmd+- press. Default 1.25. */
  keyStep?: number;
  /** Animate zoom transitions with a tween. Default false. */
  animate?: boolean;
  /** Duration in ms for Cmd+=/- steps when `animate` is true. Default 200. */
  duration?: number;
  /** Duration in ms for Cmd+0 reset when `animate` is true. Default 350. */
  resetDuration?: number;
  /** Easing function when `animate` is true. Default ease-out-cubic. */
  easing?: (t: number) => number;
}

/**
 * Always-on tool: claims `Cmd+=` (zoom in), `Cmd+-` (zoom out), `Cmd+0`
 * (reset). Anchors zoom at the canvas center. Treats `metaKey` and
 * `ctrlKey` interchangeably for cross-platform support.
 *
 * Register via `useTools({ ambient: [useKeyboardZoomTool()] })`.
 */
export function useKeyboardZoomTool(opts: KeyboardZoomToolOpts = {}): Tool<null> {
  const { min, max, animate = false, easing } = opts;
  const keyStep = opts.keyStep ?? 1.25;
  const duration = opts.duration ?? 200;
  const resetDuration = opts.resetDuration ?? 350;

  const setViewRef = useRef<((v: View) => void) | null>(null);
  const tween = useViewTween((v) => setViewRef.current?.(v));
  const { animateTo } = tween;

  return useMemo(
    () =>
      defineViewportTool<null>({
        id: 'keyboard-zoom',
        presentation: { label: 'Zoom (keyboard)', group: 'view' },
        initial: {
          keyDown: {
            '=': (ctx, event) => stepZoom(ctx, event, keyStep),
            '+': (ctx, event) => stepZoom(ctx, event, keyStep),
            '-': (ctx, event) => stepZoom(ctx, event, 1 / keyStep),
            '_': (ctx, event) => stepZoom(ctx, event, 1 / keyStep),
            '0': (ctx, event) => resetZoom(ctx, event),
          },
        },
      }) as Tool<null>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, keyStep, animate, duration, resetDuration, easing, animateTo],
  );

  function stepZoom(ctx: ToolCtx<null>, event: unknown, factor: number): Result<null> {
    const e = event as KeyboardEvent;
    if (!(e.metaKey || e.ctrlKey)) return none();
    e.preventDefault();
    setViewRef.current = ctx.setView;
    const rect = ctx.canvasRect;
    const center = { x: rect.width / 2, y: rect.height / 2 };
    const target = zoomAt(ctx.view, center, factor, { min, max });
    if (animate) {
      animateTo(ctx.view, target, { duration, easing });
    } else {
      ctx.setView(target);
    }
    return claim();
  }

  function resetZoom(ctx: ToolCtx<null>, event: unknown): Result<null> {
    const e = event as KeyboardEvent;
    if (!(e.metaKey || e.ctrlKey)) return none();
    e.preventDefault();
    setViewRef.current = ctx.setView;
    const target: View = { x: 0, y: 0, scale: 1 };
    if (animate) {
      animateTo(ctx.view, target, { duration: resetDuration, easing });
    } else {
      ctx.setView(target);
    }
    return claim();
  }
}
