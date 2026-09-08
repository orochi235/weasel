/**
 * Muting is per-scope: an `<ActionsScope>` declares an id not-for-here without
 * disturbing any other scope over the same store, and the declaration is
 * released when that scope goes away.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  ActionsProvider,
  ActionsScope,
  useActionsRegistry,
  type Action,
  type ActionsRegistry,
} from './registry';

const immediate = (id: string, run: () => void = () => {}): Action => ({
  id,
  label: id,
  invoker: { timing: 'immediate', run: () => { run(); } },
});

/** Two sibling scopes over one provider, plus the provider's own registry. */
function mountScopes(opts: { withB?: boolean } = {}) {
  const withB = opts.withB ?? true;
  let root: ActionsRegistry | null = null;
  let a: ActionsRegistry | null = null;
  let b: ActionsRegistry | null = null;
  function CaptureRoot() { root = useActionsRegistry(); return null; }
  function CaptureA() { a = useActionsRegistry(); return null; }
  function CaptureB() { b = useActionsRegistry(); return null; }
  const view = render(
    <ActionsProvider>
      <CaptureRoot />
      <ActionsScope><CaptureA /></ActionsScope>
      {withB ? <ActionsScope><CaptureB /></ActionsScope> : null}
    </ActionsProvider>,
  );
  const rerenderWithoutB = () => {
    view.rerender(
      <ActionsProvider>
        <CaptureRoot />
        <ActionsScope><CaptureA /></ActionsScope>
      </ActionsProvider>,
    );
  };
  return {
    root: root as unknown as ActionsRegistry,
    a: a as unknown as ActionsRegistry,
    b: b as unknown as ActionsRegistry,
    rerenderWithoutB,
    unmount: view.unmount,
  };
}

describe('ActionsScope muting', () => {
  it('gives each scope its own registry view over one store', () => {
    const { root, a, b } = mountScopes();
    expect(a).not.toBe(root);
    expect(b).not.toBe(root);
    expect(a).not.toBe(b);
    act(() => { a.register(immediate('viewport.pinchZoom')); });
    // Registration is still shared — that is the point of one provider.
    expect(root.list().map((x) => x.id)).toEqual(['viewport.pinchZoom']);
    expect(b.list().map((x) => x.id)).toEqual(['viewport.pinchZoom']);
  });

  // The reported failure: one canvas opting out took the action away from a
  // sibling that asked for it.
  it('hides a muted id from the muting scope only', () => {
    const { root, a, b } = mountScopes();
    act(() => { a.register(immediate('viewport.pinchZoom')); });
    act(() => { b.mute('viewport.pinchZoom'); });
    expect(b.list().map((x) => x.id)).toEqual([]);
    expect(a.list().map((x) => x.id)).toEqual(['viewport.pinchZoom']);
    expect(root.list().map((x) => x.id)).toEqual(['viewport.pinchZoom']);
  });

  it('declines trigger and begin for a muted id, and leaves the sibling alone', () => {
    const run = vi.fn();
    const { a, b } = mountScopes();
    act(() => { a.register(immediate('go', run)); });
    act(() => { b.mute('go'); });

    let fromB = true;
    act(() => { fromB = b.trigger('go'); });
    expect(fromB).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(b.begin('go')).toBeNull();

    let fromA = false;
    act(() => { fromA = a.trigger('go'); });
    expect(fromA).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it('restores the id when the mute is released', () => {
    const { a } = mountScopes();
    act(() => { a.register(immediate('go')); });
    let release: () => void = () => {};
    act(() => { release = a.mute('go'); });
    expect(a.list()).toEqual([]);
    act(() => { release(); });
    expect(a.list().map((x) => x.id)).toEqual(['go']);
    // Releasing twice must not uncover a mute someone else still holds.
    act(() => { release(); a.mute('go'); release(); });
    expect(a.list()).toEqual([]);
  });

  it('restores the id when the muting scope unmounts', () => {
    const { a, b, rerenderWithoutB } = mountScopes();
    act(() => { a.register(immediate('viewport.pinchZoom')); });
    act(() => { b.mute('viewport.pinchZoom'); });
    act(() => { rerenderWithoutB(); });
    expect(a.list().map((x) => x.id)).toEqual(['viewport.pinchZoom']);
  });

  it('notifies this scope\'s subscribers when a mute changes', () => {
    const { a, b } = mountScopes();
    const seenA = vi.fn();
    const seenB = vi.fn();
    act(() => { a.subscribe(seenA); b.subscribe(seenB); });
    act(() => { b.mute('go'); });
    expect(seenB).toHaveBeenCalled();
    expect(seenA).not.toHaveBeenCalled();
  });

  it('mutes on a bare provider too, so a lone canvas needs no scope', () => {
    const { root } = mountScopes({ withB: false });
    act(() => { root.register(immediate('go')); });
    let release: () => void = () => {};
    act(() => { release = root.mute('go'); });
    expect(root.list()).toEqual([]);
    act(() => { release(); });
    expect(root.list().map((x) => x.id)).toEqual(['go']);
  });

  it('inherits an ancestor scope\'s mutes', () => {
    let outer: ActionsRegistry | null = null;
    let inner: ActionsRegistry | null = null;
    function CaptureOuter() { outer = useActionsRegistry(); return null; }
    function CaptureInner() { inner = useActionsRegistry(); return null; }
    render(
      <ActionsProvider>
        <ActionsScope>
          <CaptureOuter />
          <ActionsScope><CaptureInner /></ActionsScope>
        </ActionsScope>
      </ActionsProvider>,
    );
    const o = outer as unknown as ActionsRegistry;
    const i = inner as unknown as ActionsRegistry;
    act(() => { o.register(immediate('go')); });
    act(() => { o.mute('go'); });
    expect(i.list()).toEqual([]);
  });

  it('unregister still drops the action for everyone', () => {
    const { a, b } = mountScopes();
    act(() => { a.register(immediate('go')); });
    act(() => { b.unregister('go'); });
    expect(a.list()).toEqual([]);
  });
});
