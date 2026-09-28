import { describe, it, expect, vi } from 'vitest';
import { sliceAction } from './slice';
import type { SliceDep } from '../depSchema';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';

const ctxAt = (x: number, y: number, start = { x: 0, y: 0 }): InvocationCtx => ({
  world: { x, y },
  screen: { x, y },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps: {} as never,
  drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y } },
});

describe('sliceAction', () => {
  it('is an ongoing action with id "slice" and no default binding', () => {
    expect(sliceAction.id).toBe('slice');
    expect(sliceAction.invoker?.timing).toBe('ongoing');
    expect(sliceAction.defaultBinding).toBeUndefined();
  });

  it('enabled reflects slice-dep presence', () => {
    // With the dep wired, Slice is enabled; without it the action can't do
    // anything (onEnd no-ops), so a UI reading enabled() should show it off.
    expect(sliceAction.enabled?.({ slice: { commit: () => {} } } as never)).toBe(true);
    expect(sliceAction.enabled?.({} as never)).toBe(ActionDisabledReason.NotApplicable);
    expect(sliceAction.enabled?.(undefined)).toBe(ActionDisabledReason.NotApplicable);
  });

  it('no-ops (empty handle) when no slice dep is present', () => {
    const handle = (sliceAction.invoker as OngoingInvoker).start(ctxAt(0, 0));
    expect(handle).toBeTruthy();
    expect(() => handle.onEnd?.(ctxAt(10, 10), 'commit')).not.toThrow();
  });

  it('calls dep.commit with the straight cut [start, current] on commit', () => {
    const commit = vi.fn();
    const dep: SliceDep = { commit };
    const start = { x: 1, y: 2 };
    const startCtx: InvocationCtx = { ...ctxAt(1, 2, start), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as OngoingInvoker).start(startCtx);
    handle.onMove?.({ ...ctxAt(40, 60, start), deps: { slice: dep } as never });
    handle.onEnd?.({ ...ctxAt(40, 60, start), deps: { slice: dep } as never }, 'commit');
    expect(commit).toHaveBeenCalledWith([{ x: 1, y: 2 }, { x: 40, y: 60 }]);
  });

  describe("with params { cut: 'freehand' }", () => {
    const trail = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: -5 }, { x: 30, y: 0 }];
    const at = (points: typeof trail, dep: SliceDep): InvocationCtx => {
      const last = points[points.length - 1];
      const base = ctxAt(last.x, last.y);
      return { ...base, deps: { slice: dep } as never, drag: { ...base.drag!, points } };
    };
    const opts = { params: { cut: 'freehand' } };

    it('commits the whole drag trail', () => {
      const commit = vi.fn();
      const dep: SliceDep = { commit };
      const handle = (sliceAction.invoker as OngoingInvoker).start({ ...ctxAt(0, 0), deps: { slice: dep } as never }, opts);
      handle.onMove?.(at(trail.slice(0, 2), dep));
      handle.onEnd?.(at(trail, dep), 'commit');
      expect(commit).toHaveBeenCalledWith(trail);
    });

    it('publishes the trail so far as the overlay', () => {
      const dep: SliceDep = { commit: vi.fn() };
      const handle = (sliceAction.invoker as OngoingInvoker).start({ ...ctxAt(0, 0), deps: { slice: dep } as never }, opts);
      handle.onMove?.(at(trail.slice(0, 3), dep));
      expect(handle.overlay?.()).toEqual({ kind: 'polyline', points: trail.slice(0, 3), role: 'cut' });
    });

    it('reads a thunked param', () => {
      const commit = vi.fn();
      const dep: SliceDep = { commit };
      const handle = (sliceAction.invoker as OngoingInvoker).start(
        { ...ctxAt(0, 0), deps: { slice: dep } as never },
        { params: () => ({ cut: 'freehand' }) },
      );
      handle.onEnd?.(at(trail, dep), 'commit');
      expect(commit).toHaveBeenCalledWith(trail);
    });
  });

  it('does not commit on cancel', () => {
    const commit = vi.fn();
    const dep: SliceDep = { commit };
    const startCtx: InvocationCtx = { ...ctxAt(0, 0), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as OngoingInvoker).start(startCtx);
    handle.onEnd?.({ ...ctxAt(5, 5), deps: { slice: dep } as never }, 'cancel');
    expect(commit).not.toHaveBeenCalled();
  });

  it('overlay publishes the cut as a world-space segment, not a paint', () => {
    const dep: SliceDep = { commit: vi.fn() };
    const startCtx: InvocationCtx = { ...ctxAt(0, 0), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as OngoingInvoker).start(startCtx);
    handle.onMove?.({ ...ctxAt(30, 0), deps: { slice: dep } as never });
    expect(handle.overlay?.()).toEqual({
      kind: 'polyline',
      points: [{ x: 0, y: 0 }, { x: 30, y: 0 }],
      role: 'cut',
    });
  });

  it('stops publishing an overlay once the gesture has ended', () => {
    const dep: SliceDep = { commit: vi.fn() };
    const startCtx: InvocationCtx = { ...ctxAt(0, 0), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as OngoingInvoker).start(startCtx);
    handle.onEnd?.({ ...ctxAt(5, 5), deps: { slice: dep } as never }, 'commit');
    expect(handle.overlay?.()).toBeNull();
  });
});
