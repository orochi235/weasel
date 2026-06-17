import { describe, it, expect, vi } from 'vitest';
import { sliceAction } from './slice';
import type { SliceDep } from './slice';
import type { InvocationCtx } from '../invoker';

const ctxAt = (x: number, y: number, start = { x: 0, y: 0 }): InvocationCtx => ({
  world: { x, y },
  screen: { x, y },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps: {} as never,
  drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y } },
});

describe('sliceAction', () => {
  it('is an ongoing drag action with id "slice"', () => {
    expect(sliceAction.id).toBe('slice');
    expect(sliceAction.invoker?.timing).toBe('ongoing');
    expect(sliceAction.defaultBinding).toEqual({ kind: 'drag' });
  });

  it('no-ops (empty handle) when no slice dep is present', () => {
    const handle = (sliceAction.invoker as { start: Function }).start(ctxAt(0, 0));
    expect(handle).toBeTruthy();
    expect(() => handle.onEnd?.(ctxAt(10, 10), 'commit')).not.toThrow();
  });

  it('calls dep.commit(start, current) on commit', () => {
    const commit = vi.fn();
    const dep: SliceDep = { commit };
    const start = { x: 1, y: 2 };
    const startCtx: InvocationCtx = { ...ctxAt(1, 2, start), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as { start: Function }).start(startCtx);
    handle.onMove?.({ ...ctxAt(40, 60, start), deps: { slice: dep } as never });
    handle.onEnd?.({ ...ctxAt(40, 60, start), deps: { slice: dep } as never }, 'commit');
    expect(commit).toHaveBeenCalledWith({ x: 1, y: 2 }, { x: 40, y: 60 });
  });

  it('does not commit on cancel', () => {
    const commit = vi.fn();
    const dep: SliceDep = { commit };
    const startCtx: InvocationCtx = { ...ctxAt(0, 0), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as { start: Function }).start(startCtx);
    handle.onEnd?.({ ...ctxAt(5, 5), deps: { slice: dep } as never }, 'cancel');
    expect(commit).not.toHaveBeenCalled();
  });

  it('overlay returns a world-space line command while dragging', () => {
    const dep: SliceDep = { commit: vi.fn() };
    const startCtx: InvocationCtx = { ...ctxAt(0, 0), deps: { slice: dep } as never };
    const handle = (sliceAction.invoker as { start: Function }).start(startCtx);
    handle.onMove?.({ ...ctxAt(30, 0), deps: { slice: dep } as never });
    const ov = handle.overlay?.();
    expect(ov?.kind).toBe('commands');
    expect(ov?.space).toBe('world');
    const cmds = ov?.kind === 'commands' ? ov.commands : [];
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0];
    expect(cmd?.kind).toBe('path');
    const paint = cmd?.kind === 'path' ? (cmd.stroke?.paint as { color?: string } | undefined) : undefined;
    expect(paint?.color).toBe('#e23b3b');
  });
});
