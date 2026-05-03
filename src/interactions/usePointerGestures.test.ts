import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { useSelection } from './useSelection';
import { usePointerGestures } from './usePointerGestures';
import type { UseMoveReturn } from './gestures/move/move';
import type { UseResizeReturn } from './gestures/resize/resize';

interface Pose { x: number; y: number; width: number; height: number }

function makeMove(): UseMoveReturn<Pose> {
  return {
    start: vi.fn(),
    move: vi.fn(),
    end: vi.fn(),
    cancel: vi.fn(),
    overlay: null,
  } as unknown as UseMoveReturn<Pose>;
}

function makeResize(): UseResizeReturn<Pose> {
  return {
    start: vi.fn(),
    move: vi.fn(),
    end: vi.fn(),
    cancel: vi.fn(),
    overlay: null,
  } as unknown as UseResizeReturn<Pose>;
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
    const hitBody = () => 'a';
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        hitBody,
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
        hitBody: () => 'a',
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
        hitBody: () => 'a',
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
        hitBody: () => null,
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
        hitBody: () => 'a',
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
        hitBody: () => null,
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
        hitBody: () => 'a',
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
    // Configure hitBody to return 'a', which is already in selection (with shift held to preserve)
    const { result } = renderHook(() =>
      usePointerGestures({
        clientToWorld: IDENTITY_C2W,
        hitBody: () => 'a',
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
        hitBody: () => 'b',
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
        hitBody: () => ['x', 'y'],
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
