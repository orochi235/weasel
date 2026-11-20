import { describe, it, expect, vi } from 'vitest';
import { createSliceAction, sliceAction } from './slice';
import { SLICE_PATHS_REQUIRES, type SliceCommit } from './slicePaths';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';

const ctxAt = (x: number, y: number, start = { x: 0, y: 0 }): InvocationCtx => ({
  world: { x, y },
  screen: { x, y },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps: {} as never,
  drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y } },
});

/** The action over a spy commit, and the commit's cuts. */
function sliceWith() {
  const commit = vi.fn<SliceCommit>();
  const action = createSliceAction({ commit });
  const start = (ctx: InvocationCtx, opts?: Parameters<OngoingInvoker['start']>[1]) =>
    (action.invoker as OngoingInvoker).start(ctx, opts);
  const cuts = () => commit.mock.calls.map(([cut]) => cut);
  return { action, commit, start, cuts };
}

describe('sliceAction', () => {
  it('is an ongoing action with id "slice" and no default binding', () => {
    expect(sliceAction.id).toBe('slice');
    expect(sliceAction.invoker?.timing).toBe('ongoing');
    expect(sliceAction.defaultBinding).toBeUndefined();
  });

  it('requires what its default commit reads, and a custom commit what it names', () => {
    expect(sliceAction.requires).toEqual([...SLICE_PATHS_REQUIRES]);
    expect(createSliceAction({ commit: () => {} }).requires).toEqual([]);
    expect(createSliceAction({ commit: () => {}, requires: ['scene'] }).requires).toEqual(['scene']);
  });

  it('commits with no scene to cut without throwing', () => {
    const handle = (sliceAction.invoker as OngoingInvoker).start(ctxAt(0, 0));
    expect(() => handle.onEnd?.(ctxAt(10, 10), 'commit')).not.toThrow();
  });

  it('hands the commit the straight cut [start, current], with the deps it started under', () => {
    const { commit, start } = sliceWith();
    const s = { x: 1, y: 2 };
    const deps = { scene: {} } as never;
    const handle = start({ ...ctxAt(1, 2, s), deps });
    handle.onMove?.(ctxAt(40, 60, s));
    // The dispatcher builds every end context with empty deps.
    handle.onEnd?.(ctxAt(40, 60, s), 'commit');
    expect(commit).toHaveBeenCalledWith([{ x: 1, y: 2 }, { x: 40, y: 60 }], deps);
  });

  describe("with params { cut: 'freehand' }", () => {
    const trail = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: -5 }, { x: 30, y: 0 }];
    const at = (points: typeof trail): InvocationCtx => {
      const last = points[points.length - 1];
      const base = ctxAt(last.x, last.y);
      return { ...base, drag: { ...base.drag!, points } };
    };
    const opts = { params: { cut: 'freehand' } };

    it('commits the whole drag trail', () => {
      const { start, cuts } = sliceWith();
      const handle = start(ctxAt(0, 0), opts);
      handle.onMove?.(at(trail.slice(0, 2)));
      handle.onEnd?.(at(trail), 'commit');
      expect(cuts()).toEqual([trail]);
    });

    it('publishes the trail so far as the overlay', () => {
      const { start } = sliceWith();
      const handle = start(ctxAt(0, 0), opts);
      handle.onMove?.(at(trail.slice(0, 3)));
      expect(handle.overlay?.()).toEqual({ kind: 'polyline', points: trail.slice(0, 3), role: 'cut' });
    });

    it('reads a thunked param', () => {
      const { start, cuts } = sliceWith();
      const handle = start(ctxAt(0, 0), { params: () => ({ cut: 'freehand' }) });
      handle.onEnd?.(at(trail), 'commit');
      expect(cuts()).toEqual([trail]);
    });
  });

  it('does not commit on cancel', () => {
    const { commit, start } = sliceWith();
    const handle = start(ctxAt(0, 0));
    handle.onEnd?.(ctxAt(5, 5), 'cancel');
    expect(commit).not.toHaveBeenCalled();
  });

  it('overlay publishes the cut as a world-space segment, not a paint', () => {
    const { start } = sliceWith();
    const handle = start(ctxAt(0, 0));
    handle.onMove?.(ctxAt(30, 0));
    expect(handle.overlay?.()).toEqual({
      kind: 'polyline',
      points: [{ x: 0, y: 0 }, { x: 30, y: 0 }],
      role: 'cut',
    });
  });

  it('stops publishing an overlay once the gesture has ended', () => {
    const { start } = sliceWith();
    const handle = start(ctxAt(0, 0));
    handle.onEnd?.(ctxAt(5, 5), 'commit');
    expect(handle.overlay?.()).toBeNull();
  });
});
