import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScene } from './useScene';
import { asNodeId } from './types';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const A: Rect = { id: 'a', x: 0, y: 0, width: 10, height: 10, color: 'red' };
const B: Rect = { id: 'b', x: 20, y: 20, width: 30, height: 30, color: 'blue' };

describe('useScene — trivial overload', () => {
  it('seeds one system layer named "default" and adds each item as a leaf', () => {
    const { result } = renderHook(() => useScene({ items: [A, B] }));
    const scene = result.current;
    expect(scene.layers).toHaveLength(1);
    expect(scene.layers[0].id).toBe('default');
    expect(scene.layers[0].kind).toBe('system');
    expect(scene.roots).toHaveLength(2);
    const a = scene.get(asNodeId('a'));
    expect(a?.kind).toBe('leaf');
    expect(a?.layer).toBe('default');
    // pose === data === item (by reference)
    expect(a?.pose).toBe(A);
    expect(a?.data).toBe(A);
  });

  it('uses item.id as the NodeId', () => {
    const { result } = renderHook(() => useScene({ items: [A] }));
    expect(result.current.get(asNodeId('a'))).toBeDefined();
  });

  it('starts with empty undo history (initial items are not undoable)', () => {
    const { result } = renderHook(() => useScene({ items: [A, B] }));
    expect(result.current.canUndo()).toBe(false);
  });

  it('returned Scene supports add/setPose/undo/redo', () => {
    const { result } = renderHook(() => useScene({ items: [A] }));
    const scene = result.current;
    act(() => {
      scene.setPose(asNodeId('a'), { ...A, x: 100 });
    });
    expect(scene.get(asNodeId('a'))?.pose).toMatchObject({ x: 100 });
    act(() => { scene.undo(); });
    expect(scene.get(asNodeId('a'))?.pose).toBe(A);
  });

  it('honors historyLimit', () => {
    const { result } = renderHook(() =>
      useScene({ items: [A], historyLimit: 1 }),
    );
    const scene = result.current;
    act(() => {
      scene.setPose(asNodeId('a'), { ...A, x: 1 });
      scene.setPose(asNodeId('a'), { ...A, x: 2 });
    });
    act(() => { scene.undo(); scene.undo(); });
    // Only one undo took effect — first setPose stays applied.
    expect(scene.get(asNodeId('a'))?.pose).toMatchObject({ x: 1 });
  });

  it('honors generateId for nodes added after construction', () => {
    let n = 0;
    const { result } = renderHook(() =>
      useScene<Rect>({ items: [], generateId: () => asNodeId(`g${n++}`) }),
    );
    const scene = result.current;
    let id: string = '';
    act(() => {
      id = scene.add({ kind: 'leaf', layer: 'default', pose: A, data: A });
    });
    expect(id).toBe('g0');
  });

  it('preserves Scene identity across re-renders', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: Rect[] }) => useScene({ items }),
      { initialProps: { items: [A] } },
    );
    const first = result.current;
    rerender({ items: [A, B] });
    // Construction-time options only; re-rendering with new items doesn't
    // rebuild the scene (matches the rest of the kit).
    expect(result.current).toBe(first);
  });
});

describe('useScene — full overload still works', () => {
  it('passes through systemLayers/initial/ops to createScene', () => {
    const { result } = renderHook(() =>
      useScene<{ label: string }, 'a' | 'b'>({
        systemLayers: [{ id: 'a' }, { id: 'b' }],
        initial: [
          { kind: 'leaf', layer: 'a', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'x' } },
        ],
      }),
    );
    expect(result.current.layers).toHaveLength(2);
    expect(result.current.roots).toHaveLength(1);
  });
});

describe('useScene — subscribe option', () => {
  it('re-renders the host on every mutation by default', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useScene<Rect>({ items: [A] });
    });
    const before = renders;

    act(() => { result.current.setPose(asNodeId('a'), { ...A, x: 5 }); });

    expect(renders).toBe(before + 1);
    expect(result.current.get(asNodeId('a'))?.pose).toMatchObject({ x: 5 });
  });

  it('does not re-render the host when subscribe is false', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useScene<{ fill: string }, 'default', Rect>({
        systemLayers: [{ id: 'default' }],
        initial: [{ kind: 'leaf', layer: 'default', pose: A, data: { fill: '#f00' }, id: asNodeId('a') }],
        subscribe: false,
      });
    });
    const before = renders;

    act(() => { result.current.setPose(asNodeId('a'), { ...A, x: 5 }); });

    expect(renders).toBe(before);
    expect(result.current.get(asNodeId('a'))?.pose).toMatchObject({ x: 5 });
  });

  it('does not re-render the host when the trivial form opts out', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useScene<Rect>({ items: [A], subscribe: false });
    });
    const before = renders;

    act(() => { result.current.setPose(asNodeId('a'), { ...A, x: 7 }); });

    expect(renders).toBe(before);
    expect(result.current.get(asNodeId('a'))?.pose).toMatchObject({ x: 7 });
  });

  it('keeps the scene itself fully live when subscribe is false', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useScene<Rect>({ items: [A], subscribe: false });
    });
    const scene = result.current;
    const v0 = scene.getVersion();

    act(() => { scene.setPose(asNodeId('a'), { ...A, x: 5 }); });
    const v1 = scene.getVersion();
    expect(v1).not.toBe(v0);

    act(() => { scene.undo(); });
    expect(scene.get(asNodeId('a'))?.pose).toBe(A);
    expect(scene.getVersion()).not.toBe(v1);
    expect(renders).toBe(1);
  });
});
