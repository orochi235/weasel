import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInsert } from './insert';
import { snapToGrid } from './behaviors/snapToGrid';
import type { Op } from 'core/ops/types';
import type { InsertAdapter } from 'core/adapters/types';

interface Obj { id: string; x: number; y: number; width: number; height: number }

function makeAdapter(opts?: { commitReturnsNull?: boolean }) {
  const inserts: Obj[] = [];
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: InsertAdapter<Obj> = {
    commitInsert(b) {
      if (opts?.commitReturnsNull) return null;
      const obj: Obj = { id: `obj-${inserts.length}`, x: b.x, y: b.y, width: b.width, height: b.height };
      return obj;
    },
    commitPaste(_clipboard, _offset, _ctx?) {
      return [];
    },
    snapshotSelection(_ids) {
      return { items: [] };
    },
    insertNode(o) {
      inserts.push(o);
    },
    setSelection(_ids) {},
    getSelection: () => [],
    applyBatch(ops, label) {
      batches.push({ ops, label });
      // Simulate insertNode side-effect by recording.
      for (const op of ops) {
        op.apply({
          insertNode: (o: Obj) => inserts.push(o),
          removeNode: () => {},
        });
      }
    },
  };
  return { adapter, inserts, batches };
}

describe('useInsert — start/cancel', () => {
  it('start sets isInserting and overlay', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() => useInsert<Obj, { x: number; y: number }>(adapter, {}));
    act(() => {
      result.current.start(1, 2, { alt: false, shift: false, meta: false, ctrl: false });
    });
    expect(result.current.isInserting).toBe(true);
    expect(result.current.overlay).toMatchObject({ start: { x: 1, y: 2 }, current: { x: 1, y: 2 }, bounds: { x: 1, y: 2, width: 0, height: 0 } });
  });

  it('cancel clears overlay; no batch', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() => useInsert<Obj, { x: number; y: number }>(adapter, {}));
    act(() => {
      result.current.start(1, 2, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.cancel();
    });
    expect(result.current.overlay).toBeNull();
    expect(batches).toEqual([]);
  });
});

describe('useInsert — move + end', () => {
  it('move updates overlay.current; behaviors compose', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        behaviors: [snapToGrid<{ x: number; y: number }>({ spacing: 1 })],
      }),
    );
    act(() => {
      result.current.start(0.7, 0.3, { alt: false, shift: false, meta: false, ctrl: false });
    });
    // start was snapped to (1, 0).
    expect(result.current.overlay).toMatchObject({ start: { x: 1, y: 0 }, current: { x: 1, y: 0 } });
    act(() => {
      result.current.move(4.6, 2.3, { alt: false, shift: false, meta: false, ctrl: false });
    });
    expect(result.current.overlay).toMatchObject({ start: { x: 1, y: 0 }, current: { x: 5, y: 2 }, bounds: { x: 1, y: 0, width: 4, height: 2 } });
  });

  it('end emits one InsertOp on happy path', () => {
    const { adapter, batches, inserts } = makeAdapter();
    const { result } = renderHook(() => useInsert<Obj, { x: number; y: number }>(adapter, {}));
    act(() => {
      result.current.start(0, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.move(4, 3, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ x: 0, y: 0, width: 4, height: 3 });
  });

  it('inverted drag bounds use min(start, current) and abs(delta)', () => {
    const { adapter, inserts } = makeAdapter();
    const { result } = renderHook(() => useInsert<Obj, { x: number; y: number }>(adapter, {}));
    act(() => {
      result.current.start(5, 5, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.move(2, 3, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    expect(inserts[0]).toMatchObject({ x: 2, y: 3, width: 3, height: 2 });
  });

  it('degenerate bounds (zero width or height) abort with no batch', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() => useInsert<Obj, { x: number; y: number }>(adapter, {}));
    act(() => {
      result.current.start(0, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.move(0, 4, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toEqual([]);
  });

  it('commitInsert returning null aborts', () => {
    const { adapter, batches } = makeAdapter({ commitReturnsNull: true });
    const { result } = renderHook(() => useInsert<Obj, { x: number; y: number }>(adapter, {}));
    act(() => {
      result.current.start(0, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.move(4, 3, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toEqual([]);
  });

  it('minBounds: bounds with width <= minBounds.width abort', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        minBounds: { width: 0.1, height: 0.1 },
      }),
    );
    act(() => {
      result.current.start(0, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.move(0.05, 5, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toEqual([]);
  });
});

describe('useInsert — pointInsert fallback', () => {
  it('sub-threshold release with pointInsert dispatches an InsertOp at the start point', () => {
    const { adapter, batches } = makeAdapter();
    const pointInsert = vi.fn((p: { x: number; y: number }) => ({
      id: 'p-0', x: p.x, y: p.y, width: 0, height: 0,
    }));
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        minBounds: { width: 4, height: 4 },
        pointInsert,
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.move(11, 21, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(pointInsert).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(batches.length).toBe(1);
    expect(batches[0].ops.length).toBe(1);
  });

  it('sub-threshold release with pointInsert returning null does not dispatch', () => {
    const { adapter, batches } = makeAdapter();
    const pointInsert = vi.fn(() => null);
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        minBounds: { width: 4, height: 4 },
        pointInsert,
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(pointInsert).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(batches.length).toBe(0);
  });

  it('above-threshold release still uses commitInsert (pointInsert ignored)', () => {
    const { adapter, batches } = makeAdapter();
    const pointInsert = vi.fn();
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        minBounds: { width: 4, height: 4 },
        pointInsert,
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.move(50, 80, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(pointInsert).not.toHaveBeenCalled();
    expect(batches.length).toBe(1);
  });
});

describe('useInsert — clickOnly', () => {
  it('clickOnly: above-threshold release still routes to pointInsert (commitInsert never called)', () => {
    const { adapter, batches } = makeAdapter();
    const commitSpy = vi.spyOn(adapter, 'commitInsert');
    const pointInsert = vi.fn((p: { x: number; y: number }) => ({
      id: 'p-0', x: p.x, y: p.y, width: 0, height: 0,
    }));
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        clickOnly: true,
        pointInsert,
        minBounds: { width: 4, height: 4 },
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.move(80, 90, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(commitSpy).not.toHaveBeenCalled();
    expect(pointInsert).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(batches.length).toBe(1);
  });

  it('clickOnly with pointInsert returning null does not dispatch', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, {
        clickOnly: true,
        pointInsert: () => null,
      }),
    );
    act(() => {
      result.current.start(10, 20, { alt: false, shift: false, meta: false, ctrl: false });
      result.current.end();
    });
    expect(batches.length).toBe(0);
  });
});

describe('useInsert — supports* flags', () => {
  it('supportsPointInsert reflects whether pointInsert was supplied', () => {
    const { adapter } = makeAdapter();
    const without = renderHook(() => useInsert<Obj, { x: number; y: number }>(adapter, {})).result.current;
    expect(without.supportsPointInsert).toBe(false);
    const withFn = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, { pointInsert: () => null }),
    ).result.current;
    expect(withFn.supportsPointInsert).toBe(true);
  });

  it('supportsCommitInsert is false in clickOnly mode', () => {
    const { adapter } = makeAdapter();
    const drag = renderHook(() => useInsert<Obj, { x: number; y: number }>(adapter, {})).result.current;
    expect(drag.supportsCommitInsert).toBe(true);
    const click = renderHook(() =>
      useInsert<Obj, { x: number; y: number }>(adapter, { clickOnly: true }),
    ).result.current;
    expect(click.supportsCommitInsert).toBe(false);
  });
});
