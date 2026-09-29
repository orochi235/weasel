import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLongPressStore, type PendingLongPress } from '@weasel-js/routing';
import type { CanvasExtensionApi } from '../../canvas/canvasExtension';
import type { RenderLayer } from '../../core/layers/render';
import type { DrawCommand } from '../../renderer';
import { createLongPressFeedbackContribution, type LongPressFeedbackOptions } from './longPressFeedback';

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } } as never;
const DIMS = { width: 400, height: 300 };

function pending(over: Partial<PendingLongPress> = {}): PendingLongPress {
  return {
    pointerId: 1, pointerType: 'touch',
    client: { x: 110, y: 120 }, local: { x: 100, y: 80 }, world: { x: 100, y: 80 },
    viewId: null, startedAt: performance.now(), duration: 500, armed: true,
    ...over,
  };
}

function setup(opts: LongPressFeedbackOptions = {}) {
  const store = createLongPressStore();
  const entry = createLongPressFeedbackContribution({ reducedMotion: false, ...opts });
  const layer = entry.overlay as RenderLayer<unknown>;
  const frames = new Set<() => void>();
  const requestRedraw = vi.fn();
  const api = {
    element: null,
    requestRedraw,
    subscribeFrame: (fn: () => void) => { frames.add(fn); return () => { frames.delete(fn); }; },
  } as unknown as CanvasExtensionApi;
  const detach = entry.attach!(api, { get: ((name: string) => (name === 'longPress' ? store : undefined)) as never });
  const draw = (viewId: string | null = null): DrawCommand[] => layer.draw({ viewId }, VIEW, DIMS);
  const frame = () => { for (const fn of [...frames]) fn(); };
  return { store, layer, draw, frame, requestRedraw, detach };
}

/** Every point a draw emitted, flattened across its path commands. */
function points(cmds: DrawCommand[]): number[] {
  return cmds.flatMap((c) => (c.kind === 'path' && c.path.kind === 'polygon' ? [...c.path.coords] : []));
}

const advance = (ms: number) => { vi.advanceTimersByTime(ms); };

describe('createLongPressFeedbackContribution', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('draws nothing with no press pending', () => {
    const { draw } = setup();
    expect(draw()).toEqual([]);
  });

  it('draws nothing for a press no binding would fire on', () => {
    const { store, draw } = setup({ delay: 0 });
    store.set(pending({ armed: false }));
    advance(250);
    expect(draw()).toEqual([]);
  });

  it('draws nothing before the delay, so a tap shows no ring', () => {
    const { store, draw } = setup({ delay: 120 });
    store.set(pending());
    advance(100);
    expect(draw()).toEqual([]);
    advance(40);
    expect(draw().length).toBeGreaterThan(0);
  });

  it('draws a ring around the press point, in screen space, only in the root pass', () => {
    const { store, draw, layer } = setup({ delay: 0, radius: 20 });
    expect(layer.space).toBe('screen');
    store.set(pending());
    advance(250);
    const xs = points(draw()).filter((_, i) => i % 2 === 0);
    const ys = points(draw()).filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeCloseTo(80, 0);
    expect(Math.max(...xs)).toBeCloseTo(120, 0);
    expect(Math.min(...ys)).toBeCloseTo(60, 0);
    expect(Math.max(...ys)).toBeCloseTo(100, 0);
    expect(draw('minimap')).toEqual([]);
  });

  it('fills the ring as the hold progresses', () => {
    const { store, draw } = setup({ delay: 0 });
    store.set(pending());
    advance(100);
    const early = draw();
    advance(300);
    const late = draw();
    // Track + progress arc; the arc carries more vertices the further it has swept.
    expect(early).toHaveLength(2);
    expect(points(late.slice(1)).length).toBeGreaterThan(points(early.slice(1)).length);
  });

  it('paints in the color it is given', () => {
    const { store, draw } = setup({ delay: 0, color: '#ff00aa' });
    store.set(pending());
    advance(200);
    const arc = draw()[1];
    expect(arc?.kind === 'path' && arc.stroke?.paint).toMatchObject({ color: '#ff00aa' });
  });

  it('runs a frame loop while a ring shows and stops it when the press ends', () => {
    const { store, frame, requestRedraw } = setup({ delay: 0 });
    store.set(pending());
    const afterSet = requestRedraw.mock.calls.length;
    expect(afterSet).toBeGreaterThan(0);
    frame();
    expect(requestRedraw.mock.calls.length).toBe(afterSet + 1);
    store.set(null);
    const afterClear = requestRedraw.mock.calls.length;
    frame();
    expect(requestRedraw.mock.calls.length).toBe(afterClear);
  });

  it('runs no frame loop for an unarmed press', () => {
    const { store, frame, requestRedraw } = setup({ delay: 0 });
    store.set(pending({ armed: false }));
    requestRedraw.mockClear();
    frame();
    expect(requestRedraw).not.toHaveBeenCalled();
  });

  describe('reduced motion', () => {
    it('shows a static indicator that does not change with progress', () => {
      const { store, draw } = setup({ delay: 0, reducedMotion: true });
      store.set(pending());
      advance(100);
      const early = draw();
      advance(300);
      expect(early.length).toBeGreaterThan(0);
      expect(draw()).toEqual(early);
    });

    it('runs no frame loop, only one repaint when the indicator appears', () => {
      const { store, frame, requestRedraw } = setup({ delay: 120, reducedMotion: true });
      store.set(pending());
      requestRedraw.mockClear();
      frame();
      expect(requestRedraw).not.toHaveBeenCalled();
      advance(120);
      expect(requestRedraw).toHaveBeenCalledTimes(1);
      frame();
      expect(requestRedraw).toHaveBeenCalledTimes(1);
    });

    it('follows prefers-reduced-motion when left on auto', () => {
      const matchMedia = vi.fn((q: string) => ({ matches: q.includes('reduce') }));
      vi.stubGlobal('matchMedia', matchMedia);
      try {
        const { store, draw } = setup({ delay: 0, reducedMotion: 'auto' });
        store.set(pending());
        advance(100);
        const early = draw();
        advance(300);
        expect(draw()).toEqual(early);
        expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  it('stops listening on detach', () => {
    const { store, detach, requestRedraw } = setup({ delay: 0 });
    detach();
    requestRedraw.mockClear();
    store.set(pending());
    expect(requestRedraw).not.toHaveBeenCalled();
  });
});

