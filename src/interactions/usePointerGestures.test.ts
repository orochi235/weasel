import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { useSelection } from '../features/selection/useSelection';
import { usePointerGestures } from './usePointerGestures';
import type { MoveController } from './gestures/move/move';
import type { ResizeController } from './gestures/resize/resize';

interface Pose { x: number; y: number; width: number; height: number }

function makeMove(): MoveController<{ id: string }, Pose> {
  return {
    start: vi.fn(),
    move: vi.fn(),
    end: vi.fn(),
    cancel: vi.fn(),
    overlay: null,
  } as unknown as MoveController<{ id: string }, Pose>;
}

function makeResize(): ResizeController<{ id: string }, Pose> {
  return {
    start: vi.fn(),
    move: vi.fn(),
    end: vi.fn(),
    cancel: vi.fn(),
    overlay: null,
  } as unknown as ResizeController<{ id: string }, Pose>;
}

interface FakePointerOpts {
  clientX?: number;
  clientY?: number;
  shift?: boolean;
  meta?: boolean;
  ctrl?: boolean;
  alt?: boolean;
}

function makePointer(canvas: HTMLCanvasElement, opts: FakePointerOpts = {}): React.PointerEvent<HTMLCanvasElement> {
  const evt = {
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    shiftKey: opts.shift ?? false,
    metaKey: opts.meta ?? false,
    ctrlKey: opts.ctrl ?? false,
    altKey: opts.alt ?? false,
    pointerId: 1,
    currentTarget: canvas,
    button: 0,
  };
  return evt as unknown as React.PointerEvent<HTMLCanvasElement>;
}

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 100;
  c.height = 100;
  // jsdom doesn't implement setPointerCapture; stub it
  c.setPointerCapture = vi.fn();
  c.releasePointerCapture = vi.fn();
  return c;
}

const IDENTITY_C2W = (_c: HTMLCanvasElement, x: number, y: number): [number, number] => [x, y];

describe('usePointerGestures — onBodyHit firing', () => {
  it('fires onBodyHit even when move is not provided', () => {
    const onBodyHit = vi.fn();
    const pickEvery = () => 'a';
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery,
        onBodyHit,
      }),
    );
    const canvas = makeCanvas();
    act(() => {
      result.current.onPointerDown(makePointer(canvas, { clientX: 10, clientY: 20 }));
    });
    expect(onBodyHit).toHaveBeenCalledTimes(1);
    const [ids, ctx] = onBodyHit.mock.calls[0];
    expect(ids).toEqual(['a']);
    expect(ctx.worldX).toBe(10);
    expect(ctx.worldY).toBe(20);
    expect(ctx.modifiers.shift).toBe(false);
  });

  it('still fires onBodyHit when move is provided', () => {
    const onBodyHit = vi.fn();
    const move = makeMove();
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => 'a',
        onBodyHit,
        move,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas)));
    expect(onBodyHit).toHaveBeenCalledTimes(1);
    expect(move.start).toHaveBeenCalledTimes(1);
  });
});

describe('usePointerGestures — selection-driven defaults', () => {
  it('default onBodyHit calls selection.applyClick with first hit id', () => {
    const { result: sel } = renderHook(() => useSelection({ mode: 'multi' }));
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => 'a',
        selection: sel.current,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas)));
    expect(sel.current.current).toEqual(['a']);
  });

  it('default onTapEmpty clears selection', () => {
    const { result: sel } = renderHook(() => useSelection({ initial: ['x'] }));
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => null,
        selection: sel.current,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas)));
    expect(sel.current.current).toEqual([]);
  });

  it('explicit onBodyHit overrides selection-derived default', () => {
    const onBodyHit = vi.fn();
    const { result: sel } = renderHook(() => useSelection());
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => 'a',
        selection: sel.current,
        onBodyHit,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas)));
    expect(onBodyHit).toHaveBeenCalledTimes(1);
    expect(sel.current.current).toEqual([]); // selection wasn't touched
  });

  it('explicit onTapEmpty overrides selection.clear default', () => {
    const onTapEmpty = vi.fn();
    const { result: sel } = renderHook(() => useSelection({ initial: ['x'] }));
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => null,
        selection: sel.current,
        onTapEmpty,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas)));
    expect(onTapEmpty).toHaveBeenCalledTimes(1);
    expect(sel.current.current).toEqual(['x']); // selection unchanged
  });
});

describe('usePointerGestures — promote-then-drag', () => {
  it('clicking unselected obj selects it then drags it', () => {
    const move = makeMove();
    const { result: sel } = renderHook(() => useSelection({ mode: 'multi' }));
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => 'a',
        move,
        selection: sel.current,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas)));
    expect(sel.current.current).toEqual(['a']);
    expect(move.start).toHaveBeenCalledTimes(1);
    const startArgs = (move.start as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(startArgs.ids).toEqual(['a']);
  });

  it('clicking already-selected obj drags whole selection', () => {
    const move = makeMove();
    const { result: sel } = renderHook(() =>
      useSelection({ mode: 'multi', initial: ['a', 'b'] }),
    );
    // Configure pickEvery to return 'a', which is already in selection (with shift held to preserve)
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => 'a',
        move,
        selection: sel.current,
      }),
    );
    const canvas = makeCanvas();
    // No modifier: selection.applyClick will replace with ['a'], so post-click drag is ['a']
    act(() => result.current.onPointerDown(makePointer(canvas)));
    expect(sel.current.current).toEqual(['a']);
    const args = (move.start as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.ids).toEqual(['a']);
  });

  it('shift-click on unselected adds to selection and drags whole post-click set', () => {
    const move = makeMove();
    const { result: sel } = renderHook(() =>
      useSelection({ mode: 'multi', initial: ['a'] }),
    );
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => 'b',
        move,
        selection: sel.current,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas, { shift: true })));
    expect(sel.current.current).toEqual(['a', 'b']);
    const args = (move.start as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.ids).toEqual(['a', 'b']);
  });

  it('without selection, drags hit ids directly', () => {
    const move = makeMove();
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => ['x', 'y'],
        move,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas)));
    const args = (move.start as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.ids).toEqual(['x', 'y']);
  });
});

describe('usePointerGestures — resizeTarget derivation', () => {
  it('derives resizeTarget from single selection + boundsOf', () => {
    const resize = makeResize();
    const { result: sel } = renderHook(() => useSelection({ initial: ['a'] }));
    const bounds = { x: 0, y: 0, width: 50, height: 50 };
    const boundsOf = (id: string) => (id === 'a' ? bounds : null);
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        resize,
        selection: sel.current,
        boundsOf,
        handleHitRadius: 8,
      }),
    );
    const canvas = makeCanvas();
    // Click near top-left corner handle (0,0)
    act(() => result.current.onPointerDown(makePointer(canvas, { clientX: 0, clientY: 0 })));
    expect(resize.start).toHaveBeenCalledTimes(1);
    const args = (resize.start as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[0]).toBe('a'); // id
  });

  it('multi-selection yields no resizeTarget', () => {
    const resize = makeResize();
    const { result: sel } = renderHook(() =>
      useSelection({ mode: 'multi', initial: ['a', 'b'] }),
    );
    const boundsOf = () => ({ x: 0, y: 0, width: 50, height: 50 });
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        resize,
        selection: sel.current,
        boundsOf,
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas, { clientX: 0, clientY: 0 })));
    expect(resize.start).not.toHaveBeenCalled();
  });

  it('handleHitRadius is screen-px: scale=2 halves the world hit radius', () => {
    const resize = makeResize();
    const { result: sel } = renderHook(() => useSelection({ initial: ['a'] }));
    const bounds = { x: 0, y: 0, width: 50, height: 50 };
    const boundsOf = (id: string) => (id === 'a' ? bounds : null);
    // clientToWorld at scale=2 maps screen 10 -> world 5.
    const c2w = (_c: HTMLCanvasElement, x: number, y: number): [number, number] => [x / 2, y / 2];
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: c2w,
        resize,
        selection: sel.current,
        boundsOf,
        handleHitRadius: 8, // 8 screen px → 4 world px at scale=2
        getView: () => ({ x: 0, y: 0, scale: 2 }),
      }),
    );
    const canvas = makeCanvas();
    // Screen (8, 0) → world (4, 0). 4 world units from corner (0,0) — within
    // 8/2=4 world-radius. Should hit.
    act(() => result.current.onPointerDown(makePointer(canvas, { clientX: 8, clientY: 0 })));
    expect(resize.start).toHaveBeenCalledTimes(1);

    // Reset and try just outside: screen (10, 0) → world (5, 0). Distance 5
    // exceeds 4 world-radius. Should miss.
    (resize.start as ReturnType<typeof vi.fn>).mockClear();
    act(() => result.current.onPointerDown(makePointer(canvas, { clientX: 10, clientY: 0 })));
    expect(resize.start).not.toHaveBeenCalled();
  });

  it('explicit resizeTarget overrides selection-derived default', () => {
    const resize = makeResize();
    const explicitBounds = { x: 0, y: 0, width: 50, height: 50 };
    const { result: sel } = renderHook(() => useSelection({ initial: ['ignored'] }));
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        resize,
        selection: sel.current,
        boundsOf: () => null, // selection-derived would yield null
        resizeTarget: () => ({ id: 'explicit', bounds: explicitBounds }),
      }),
    );
    const canvas = makeCanvas();
    act(() => result.current.onPointerDown(makePointer(canvas, { clientX: 0, clientY: 0 })));
    expect(resize.start).toHaveBeenCalledTimes(1);
    expect((resize.start as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('explicit');
  });
});

import { rotatePoint } from './gestures/rotate/geometry';

describe('usePointerGestures — rotated resize handle hit-test', () => {
  it('hits the rotated-corner position, not the unrotated AABB corner', () => {
    // Setup: 100×60 rect at (0,0), rotated π/4. The unrotated bottom-right
    // corner is at (100, 60); the rotated bottom-right corner sits at the
    // image of (100, 60) under R(π/4) about center (50, 30).
    const bounds = { x: 0, y: 0, width: 100, height: 60 };
    const center = { x: 50, y: 30 };
    const rotation = Math.PI / 4;
    const rotatedBR = rotatePoint(100, 60, center.x, center.y, rotation);

    const resize = makeResize();
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        resize,
        resizeTarget: () => ({ id: 'a', bounds, rotation }),
        handleHitRadius: 8,
      }),
    );
    const canvas = makeCanvas();

    // Click at the rotated-corner world position — should fire resize.start.
    act(() => result.current.onPointerDown(makePointer(canvas, { clientX: rotatedBR.x, clientY: rotatedBR.y })));
    expect(resize.start).toHaveBeenCalledTimes(1);
    const args = (resize.start as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[0]).toBe('a');
    expect(args[1]).toEqual({ x: 'min', y: 'min' }); // BR anchor pins TL (min,min)

    (resize.start as ReturnType<typeof vi.fn>).mockClear();

    // Click at the unrotated AABB BR corner (100, 60) — should NOT fire resize.start.
    act(() => result.current.onPointerDown(makePointer(canvas, { clientX: 100, clientY: 60 })));
    expect(resize.start).not.toHaveBeenCalled();
  });
});

import { createDebugSink } from '../debug/createDebugSink';

describe('usePointerGestures — debug recording', () => {
  it('records a body hitbox for each id returned by pickEvery', () => {
    const sink = createDebugSink({ hitboxes: true });
    const pickEvery = () => 'a';
    const boundsOf = (id: string) =>
      id === 'a' ? { x: 0, y: 0, width: 50, height: 30 } : null;
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery,
        boundsOf,
        debug: sink,
      }),
    );
    const canvas = makeCanvas();
    act(() => {
      result.current.onPointerDown(makePointer(canvas, { clientX: 10, clientY: 10 }));
    });
    const hits = sink.snapshot().hitboxes;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].kind).toBe('body');
    expect(hits[0].id).toBe('a');
  });

  it('clears snap candidates on pointer up', () => {
    const sink = createDebugSink({ snap: true });
    // Pre-record a candidate so we can observe it being cleared.
    sink.recordSnapCandidate({ x: 1, y: 2 }, true);
    expect(sink.snapshot().snap.length).toBe(1);
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery: () => null,
        debug: sink,
      }),
    );
    const canvas = makeCanvas();
    act(() => {
      result.current.onPointerUp(makePointer(canvas, { clientX: 0, clientY: 0 }));
    });
    expect(sink.snapshot().snap.length).toBe(0);
  });

  it('does not throw when debug sink is omitted', () => {
    const pickEvery = () => 'a';
    const boundsOf = () => ({ x: 0, y: 0, width: 50, height: 30 });
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        pickEvery,
        boundsOf,
      }),
    );
    const canvas = makeCanvas();
    expect(() => {
      act(() => {
        result.current.onPointerDown(makePointer(canvas, { clientX: 10, clientY: 10 }));
      });
    }).not.toThrow();
  });
});
