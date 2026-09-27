/**
 * Input scopes: what a scope registers stays in it, what it looks up is
 * answered there first and then by the registries above, and chrome above
 * reaches whichever scope is active.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import type { Action, ActionsRegistry } from '@weasel-js/routing';
import type { DepRegistry } from '@weasel-js/routing/react';
import {
  ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, InputScope, useActionsRegistry,
  useActiveToolContext, useOptionalDepRegistry, useYoke, type ActiveToolContextValue,
} from '@weasel-js/routing/react';

const immediate = (id: string, run: () => void = () => {}): Action => ({
  id,
  label: id,
  invoker: { timing: 'immediate', run: () => { run(); } },
});

const ids = (r: ActionsRegistry) => r.list().map((x) => x.id);

/** Two sibling scopes under one provider, plus the provider's own registries. */
function mountScopes(opts: { withB?: boolean } = {}) {
  const withB = opts.withB ?? true;
  const got: Record<string, { actions: ActionsRegistry; deps: DepRegistry }> = {};
  function Capture({ at }: { at: string }) {
    got[at] = { actions: useActionsRegistry()!, deps: useOptionalDepRegistry()! };
    return null;
  }
  const tree = (b: boolean) => (
    <DepRegistryProvider>
      <ActionsProvider>
        <Capture at="root" />
        <InputScope><Capture at="a" /></InputScope>
        {b ? <InputScope><Capture at="b" /></InputScope> : null}
      </ActionsProvider>
    </DepRegistryProvider>
  );
  const view = render(tree(withB));
  return {
    root: got.root!,
    a: got.a!,
    b: got.b!,
    dropB: () => act(() => { view.rerender(tree(false)); }),
  };
}

describe('input scopes', () => {
  it('keeps what a scope registers to that scope', () => {
    const { a, b } = mountScopes();
    act(() => { a.actions.register(immediate('pan')); });
    expect(ids(a.actions)).toEqual(['pan']);
    expect(ids(b.actions)).toEqual([]);
  });

  it('answers a lookup from the scope first, then the registry above', () => {
    const { root, a, b } = mountScopes();
    const fromRoot = immediate('go');
    const fromA = immediate('go');
    act(() => {
      root.actions.register(fromRoot);
      a.actions.register(fromA);
    });
    expect(a.actions.list()).toEqual([fromA]);
    expect(b.actions.list()).toEqual([fromRoot]);
  });

  it('keeps a dep source to the scope that registered it', () => {
    const { root, a, b } = mountScopes();
    act(() => {
      root.deps.register('scene', () => 'shared' as never);
      a.deps.register('scene', () => 'a' as never);
    });
    expect(a.deps.get('scene')).toBe('a');
    expect(b.deps.get('scene')).toBe('shared');
  });

  it('sends chrome above to the newest scope until one is activated', () => {
    const inA = vi.fn();
    const inB = vi.fn();
    const { root, a, b } = mountScopes();
    act(() => {
      a.actions.register(immediate('go', inA));
      b.actions.register(immediate('go', inB));
    });
    act(() => { root.actions.trigger('go'); });
    expect(inB).toHaveBeenCalledOnce();
    act(() => { a.actions.activate(); });
    act(() => { root.actions.trigger('go'); });
    expect(inA).toHaveBeenCalledOnce();
  });

  it('moves the dep lookups with the active scope', () => {
    const { root, a, b } = mountScopes();
    act(() => {
      a.deps.register('scene', () => 'a' as never);
      b.deps.register('scene', () => 'b' as never);
    });
    expect(root.deps.get('scene')).toBe('b');
    act(() => { a.actions.activate(); });
    expect(root.deps.get('scene')).toBe('a');
  });

  it('says which scope keystrokes belong to', () => {
    const { a, b } = mountScopes();
    expect(b.actions.isActive()).toBe(true);
    expect(a.actions.isActive()).toBe(false);
    act(() => { a.actions.activate(); });
    expect(a.actions.isActive()).toBe(true);
    expect(b.actions.isActive()).toBe(false);
  });

  it('falls back to the newest remaining scope when the active one leaves', () => {
    const inA = vi.fn();
    const { root, a, b, dropB } = mountScopes();
    act(() => {
      a.actions.register(immediate('go', inA));
      b.actions.register(immediate('go'));
      b.actions.activate();
    });
    dropB();
    act(() => { root.actions.trigger('go'); });
    expect(inA).toHaveBeenCalledOnce();
  });
});

describe('muting', () => {
  it('hides an id from the muting scope only', () => {
    const { root, a, b } = mountScopes();
    act(() => { root.actions.register(immediate('pinch')); });
    act(() => { b.actions.mute('pinch'); });
    expect(ids(b.actions)).toEqual([]);
    expect(ids(a.actions)).toEqual(['pinch']);
  });

  it('declines trigger and begin for a muted id', () => {
    const run = vi.fn();
    const { root, b } = mountScopes();
    act(() => { root.actions.register(immediate('go', run)); });
    act(() => { b.actions.mute('go'); });
    let fired = true;
    act(() => { fired = b.actions.trigger('go'); });
    expect(fired).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(b.actions.begin('go')).toBeNull();
  });

  it('restores the id when the mute is released, and only then', () => {
    const { a } = mountScopes();
    act(() => { a.actions.register(immediate('go')); });
    let release: () => void = () => {};
    act(() => { release = a.actions.mute('go'); });
    expect(a.actions.list()).toEqual([]);
    act(() => { release(); });
    expect(ids(a.actions)).toEqual(['go']);
    // Releasing twice must not uncover a mute someone else still holds.
    act(() => { release(); a.actions.mute('go'); release(); });
    expect(a.actions.list()).toEqual([]);
  });

  it('mutes on a bare provider too', () => {
    const { root } = mountScopes({ withB: false });
    act(() => { root.actions.register(immediate('go')); });
    let release: () => void = () => {};
    act(() => { release = root.actions.mute('go'); });
    // The root reads through its only scope, which inherits the root's mute.
    expect(root.actions.list()).toEqual([]);
    act(() => { release(); });
    expect(ids(root.actions)).toEqual(['go']);
  });

  it('notifies subscribers when a mute changes', () => {
    const { b } = mountScopes();
    const seen = vi.fn();
    act(() => { b.actions.subscribe(seen); });
    act(() => { b.actions.mute('go'); });
    expect(seen).toHaveBeenCalled();
  });
});

describe('tools and yokes', () => {
  function mountTools(yoked: boolean) {
    const got: Record<string, ActiveToolContextValue> = {};
    function Capture({ at }: { at: string }) {
      got[at] = useActiveToolContext();
      return null;
    }
    function Tree() {
      const yoke = useYoke();
      const joined = yoked ? yoke : undefined;
      return (
        <>
          <Capture at="root" />
          <InputScope yoke={joined}><Capture at="a" /></InputScope>
          <InputScope yoke={joined}><Capture at="b" /></InputScope>
        </>
      );
    }
    render(
      <ActionsProvider>
        <ActiveToolContextProvider initialActive="select">
          <Tree />
        </ActiveToolContextProvider>
      </ActionsProvider>,
    );
    return got;
  }

  it('starts each scope on the tool in effect around it', () => {
    const got = mountTools(false);
    expect(got.a?.active).toBe('select');
    expect(got.b?.active).toBe('select');
  });

  it('keeps a tool per scope when nothing yokes them', () => {
    const got = mountTools(false);
    act(() => { got.a!.setActive('hand'); });
    expect(got.a?.active).toBe('hand');
    expect(got.b?.active).toBe('select');
  });

  it('shares one tool across a yoke', () => {
    const got = mountTools(true);
    act(() => { got.a!.setActive('hand'); });
    expect(got.a?.active).toBe('hand');
    expect(got.b?.active).toBe('hand');
  });

  it('reads and writes the active scope\'s tool from above', () => {
    const got = mountTools(false);
    act(() => { got.root!.setActive('pen'); });
    expect(got.b?.active).toBe('pen');
    expect(got.a?.active).toBe('select');
  });
});
