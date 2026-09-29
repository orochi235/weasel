import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { useSelection, type SelectionApi, type SelectionStore } from './useSelection';
import { asNodeId } from 'core/scene/types';
import { createScene } from 'core/scene/scene';

const NO_MODS = { shift: false, meta: false, ctrl: false };
const a = asNodeId('a');
const b = asNodeId('b');
const c = asNodeId('c');

describe('useSelection', () => {
  it('starts empty by default', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.current).toEqual([]);
    expect(result.current.get()).toEqual([]);
  });

  it('honors initial selection', () => {
    const { result } = renderHook(() => useSelection({ initial: [a, b] }));
    expect(result.current.current).toEqual([a, b]);
  });

  it('single-mode applyClick replaces regardless of modifier', () => {
    const { result } = renderHook(() => useSelection({ initial: [a] }));
    act(() => result.current.applyClick(b, { ...NO_MODS, shift: true }));
    expect(result.current.current).toEqual([b]);
  });

  it('multi-mode applyClick with shift toggles', () => {
    const { result } = renderHook(() => useSelection({ mode: 'multi', initial: [a] }));
    act(() => result.current.applyClick(b, { ...NO_MODS, shift: true }));
    expect(result.current.current).toEqual([a, b]);
    act(() => result.current.applyClick(a, { ...NO_MODS, shift: true }));
    expect(result.current.current).toEqual([b]);
  });

  it('multi-mode applyClick without modifier replaces', () => {
    const { result } = renderHook(() => useSelection({ mode: 'multi', initial: [a, b] }));
    act(() => result.current.applyClick(c, NO_MODS));
    expect(result.current.current).toEqual([c]);
  });

  it('multi-mode honors meta extend key', () => {
    const { result } = renderHook(() =>
      useSelection({ mode: 'multi', extend: 'meta', initial: [a] }),
    );
    act(() => result.current.applyClick(b, { ...NO_MODS, shift: true }));
    expect(result.current.current).toEqual([b]);
    act(() => result.current.applyClick(a, { ...NO_MODS, meta: true }));
    expect(result.current.current).toEqual([b, a]);
  });

  it('toggle adds when missing, removes when present (multi)', () => {
    const { result } = renderHook(() => useSelection({ mode: 'multi' }));
    act(() => result.current.toggle(a));
    expect(result.current.current).toEqual([a]);
    act(() => result.current.toggle(b));
    expect(result.current.current).toEqual([a, b]);
    act(() => result.current.toggle(a));
    expect(result.current.current).toEqual([b]);
  });

  it('toggle in single-mode replaces when adding', () => {
    const { result } = renderHook(() => useSelection({ mode: 'single', initial: [a] }));
    act(() => result.current.toggle(b));
    expect(result.current.current).toEqual([b]);
  });

  it('add appends in multi, replaces in single', () => {
    const multi = renderHook(() => useSelection({ mode: 'multi', initial: [a] }));
    act(() => multi.result.current.add(b));
    expect(multi.result.current.current).toEqual([a, b]);
    // duplicate add is a no-op
    act(() => multi.result.current.add(b));
    expect(multi.result.current.current).toEqual([a, b]);

    const single = renderHook(() => useSelection({ initial: [a] }));
    act(() => single.result.current.add(b));
    expect(single.result.current.current).toEqual([b]);
  });

  it('remove drops the id', () => {
    const { result } = renderHook(() => useSelection({ mode: 'multi', initial: [a, b, c] }));
    act(() => result.current.remove(b));
    expect(result.current.current).toEqual([a, c]);
  });

  it('clear empties the selection', () => {
    const { result } = renderHook(() => useSelection({ initial: [a] }));
    act(() => result.current.clear());
    expect(result.current.current).toEqual([]);
  });

  it('contains reports membership', () => {
    const { result } = renderHook(() => useSelection({ initial: [a] }));
    expect(result.current.contains(a)).toBe(true);
    expect(result.current.contains(b)).toBe(false);
  });

  it('adapterMethods.getSelection returns current', () => {
    const { result } = renderHook(() => useSelection({ mode: 'multi', initial: [a] }));
    expect(result.current.adapterMethods.getSelection()).toEqual([a]);
    act(() => result.current.adapterMethods.setSelection([asNodeId('x'), asNodeId('y')]));
    expect(result.current.adapterMethods.getSelection()).toEqual([asNodeId('x'), asNodeId('y')]);
    expect(result.current.current).toEqual([asNodeId('x'), asNodeId('y')]);
  });

  it('get() reads latest synchronously after a setter call', () => {
    const { result } = renderHook(() => useSelection({ mode: 'multi' }));
    act(() => {
      result.current.set([a]);
      // mid-effect: ref should already reflect the new value
      expect(result.current.get()).toEqual([a]);
    });
  });
});

describe('useSelection — bound to a scene', () => {
  function makeScene() {
    return createScene<{ label: string }, 'default'>({ systemLayers: [{ id: 'default' }] });
  }

  it('reads and writes the scene selection', () => {
    const scene = makeScene();
    const { result } = renderHook(() => useSelection({ mode: 'multi', scene }));

    act(() => { result.current.set([a, b]); });

    expect(scene.getSelection()).toEqual([a, b]);
    expect(result.current.current).toEqual([a, b]);
    expect(result.current.get()).toEqual([a, b]);
  });

  it('re-renders when the scene selection changes elsewhere', () => {
    const scene = makeScene();
    const { result } = renderHook(() => useSelection({ scene }));

    act(() => { scene.setSelection([c]); });

    expect(result.current.current).toEqual([c]);
  });

  it('two hooks on one scene share a selection', () => {
    const scene = makeScene();
    const first = renderHook(() => useSelection({ mode: 'multi', scene }));
    const second = renderHook(() => useSelection({ mode: 'multi', scene }));

    act(() => { first.result.current.set([a]); });

    expect(second.result.current.current).toEqual([a]);
  });

  it('an unbound hook keeps its own selection', () => {
    const scene = makeScene();
    const bound = renderHook(() => useSelection({ scene }));
    const own = renderHook(() => useSelection());

    act(() => { own.result.current.set([a]); });

    expect(own.result.current.current).toEqual([a]);
    expect(bound.result.current.current).toEqual([]);
    expect(scene.getSelection()).toEqual([]);
  });

  it('seeds the scene from `initial` only when the scene has no selection', () => {
    const scene = makeScene();
    scene.setSelection([c]);
    const { result } = renderHook(() => useSelection({ scene, initial: [a] }));

    expect(result.current.current).toEqual([c]);
  });

  it('honors lock', () => {
    const scene = makeScene();
    const { result } = renderHook(() => useSelection({ scene, lock: true }));

    act(() => { result.current.set([a]); });

    expect(scene.getSelection()).toEqual([]);
  });
});

describe('useSelection — seeding a scene', () => {
  it('seeds an empty scene from `initial`', () => {
    const scene = createScene<{ label: string }, 'default'>({ systemLayers: [{ id: 'default' }] });
    const { result } = renderHook(() => useSelection({ scene, initial: [a] }));

    expect(scene.getSelection()).toEqual([a]);
    expect(result.current.current).toEqual([a]);
  });
});

describe('useSelection — identity', () => {
  it('returns the same object across re-renders and selection changes', () => {
    const { result, rerender } = renderHook(() => useSelection({ mode: 'multi' }));
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);

    act(() => { first.set([a, b]); });
    expect(result.current).toBe(first);
    expect(first.current).toEqual([a, b]);
  });

  it('stays the same object when bound to a scene, and reads the scene live', () => {
    const scene = createScene<{ label: string }, 'default'>({ systemLayers: [{ id: 'default' }] });
    const { result } = renderHook(() => useSelection({ scene }));
    const first = result.current;

    act(() => { scene.setSelection([c]); });

    expect(result.current).toBe(first);
    expect(first.current).toEqual([c]);
  });

  it('follows a changed mode without changing identity', () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'single' | 'multi' }) => useSelection({ mode, initial: [a] }),
      { initialProps: { mode: 'single' as 'single' | 'multi' } },
    );
    const first = result.current;

    rerender({ mode: 'multi' });
    act(() => { result.current.applyClick(b, { ...NO_MODS, shift: true }); });

    expect(result.current).toBe(first);
    expect(first.current).toEqual([a, b]);
  });

  it('an abandoned render\'s lock does not stick', () => {
    let api = null as SelectionApi | null;
    function Probe({ lock }: { lock: boolean }) {
      api = useSelection({ lock });
      return null;
    }
    renderThenAbandon(false, true, (lock) => createElement(Probe, { lock }));
    act(() => api!.set([a]));
    expect(api!.get()).toEqual([a]);
  });

  it('an abandoned render\'s scene does not redirect the committed selection', () => {
    const sceneA = createScene({ systemLayers: [{ id: 'main' }] });
    const sceneB = createScene({ systemLayers: [{ id: 'main' }] });
    sceneA.setSelection([a]);
    sceneB.setSelection([b]);
    const committed: SelectionApi[] = [];
    function Probe({ scene }: { scene: SelectionStore }) {
      const api = useSelection({ scene });
      if (scene === sceneA) committed.push(api);
      return null;
    }
    renderThenAbandon<SelectionStore>(sceneA, sceneB, (scene) => createElement(Probe, { scene }));
    expect(committed.at(-1)!.get()).toEqual([a]);
  });
});
