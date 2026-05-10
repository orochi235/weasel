import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLassoSelect } from './lassoSelect';
import type { LassoSelectAdapter } from '../../../core/adapters/types';
import type { LassoSelectBehavior } from '../types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const SHIFT = { ...NO_MOD, shift: true };

function makeAdapter(): LassoSelectAdapter {
  return {
    hitTestLasso: () => [],
    hitTestArea: () => [],
    getSelection: () => [],
    setSelection: () => {},
    applyOps: () => {},
  };
}

describe('useLassoSelect', () => {
  it('start sets isLassoSelecting + overlay seeded with start vertex', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [] }));
    expect(result.current.isLassoSelecting).toBe(false);
    act(() => { result.current.start(1, 2, NO_MOD); });
    expect(result.current.isLassoSelecting).toBe(true);
    expect(result.current.overlay).not.toBeNull();
    expect(result.current.overlay!.vertices).toEqual([{ x: 1, y: 2 }]);
    expect(result.current.overlay!.shiftHeld).toBe(false);
  });

  it('move appends a vertex when distance ≥ minVertexSpacing', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [], minVertexSpacing: 2 }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(1, 0, NO_MOD); });   // 1px — skipped
    expect(result.current.overlay!.vertices).toHaveLength(1);
    act(() => { result.current.move(3, 0, NO_MOD); });   // 3px — appended
    expect(result.current.overlay!.vertices).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
    act(() => { result.current.move(3.5, 0, NO_MOD); }); // 0.5px — skipped
    expect(result.current.overlay!.vertices).toHaveLength(2);
  });

  it('minVertexSpacing: 0 records every move sample', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [], minVertexSpacing: 0 }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(0.1, 0, NO_MOD); });
    act(() => { result.current.move(0.2, 0, NO_MOD); });
    expect(result.current.overlay!.vertices).toHaveLength(3);
  });

  it('cancel clears overlay; behaviors do not see onEnd', () => {
    const adapter = makeAdapter();
    const onEnd = vi.fn();
    const beh: LassoSelectBehavior = { onEnd };
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [beh] }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(5, 0, NO_MOD); });
    act(() => { result.current.cancel(); });
    expect(result.current.isLassoSelecting).toBe(false);
    expect(result.current.overlay).toBeNull();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('end invokes behavior onEnd with vertex history visible in scratch', () => {
    const adapter = makeAdapter();
    let seenVertices: unknown = null;
    const beh: LassoSelectBehavior = {
      onEnd: (ctx) => {
        seenVertices = (ctx.scratch as { 'lassoSelect.vertices'?: unknown })['lassoSelect.vertices'];
        return null;
      },
    };
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [beh], minVertexSpacing: 0 }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(5, 0, NO_MOD); });
    act(() => { result.current.move(5, 5, NO_MOD); });
    act(() => { result.current.end(); });
    expect(seenVertices).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]);
  });

  it('shift held at start is captured on the pose, propagated through end', () => {
    const adapter = makeAdapter();
    let seenShift: boolean | null = null;
    const beh: LassoSelectBehavior = {
      onEnd: (ctx) => {
        seenShift = (ctx.origin.get('gesture') as { shiftHeld: boolean }).shiftHeld;
        return null;
      },
    };
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [beh] }));
    act(() => { result.current.start(0, 0, SHIFT); });
    act(() => { result.current.move(5, 5, NO_MOD); });
    act(() => { result.current.end(); });
    expect(seenShift).toBe(true);
  });

  it('end commits ops via applyOps when behavior returns Op[] (transient default)', () => {
    const applyOps = vi.fn();
    const adapter: LassoSelectAdapter = { ...makeAdapter(), applyOps };
    const beh: LassoSelectBehavior = {
      defaultTransient: true,
      onEnd: () => [{ apply: () => {}, invert: () => null, label: undefined } as never],
    };
    const { result } = renderHook(() => useLassoSelect(adapter, { behaviors: [beh] }));
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(5, 5, NO_MOD); });
    act(() => { result.current.end(); });
    expect(applyOps).toHaveBeenCalledTimes(1);
  });
});
