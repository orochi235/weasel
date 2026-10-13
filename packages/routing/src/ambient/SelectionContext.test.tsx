import { describe, expect, it } from 'vitest';
import { renderHook, render, act } from '@testing-library/react';
import {
  SelectionContextProvider,
  useSelectionContext,
  usePublishSelection,
} from './SelectionContext';
import type { NodeId } from '../vocabulary';
import type { ReactNode } from 'react';

const asNodeId = (id: string): NodeId => id as NodeId;

const wrap = ({ children }: { children: ReactNode }) => (
  <SelectionContextProvider>{children}</SelectionContextProvider>
);

describe('useSelectionContext', () => {
  it('returns null when no provider is in scope', () => {
    const { result } = renderHook(() => useSelectionContext());
    expect(result.current).toBeNull();
  });

  it('returns an empty selection when no publisher has called yet', () => {
    const { result } = renderHook(() => useSelectionContext(), { wrapper: wrap });
    expect(result.current).not.toBeNull();
    expect(result.current!.selection).toEqual([]);
    expect(result.current!.kinds).toBeUndefined();
  });

  it('reflects published ids through the context', () => {
    const { result } = renderHook(() => useSelectionContext(), { wrapper: wrap });
    act(() => result.current!.publishSelection([asNodeId('a'), asNodeId('b')]));
    expect(result.current!.selection).toEqual(['a', 'b']);
  });

  it('publishes parallel kinds when supplied', () => {
    const { result } = renderHook(() => useSelectionContext(), { wrapper: wrap });
    act(() => result.current!.publishSelection([asNodeId('a'), asNodeId('b')], ['rect', 'path']));
    expect(result.current!.kinds).toEqual(['rect', 'path']);
  });

  it('clears kinds when re-published without them', () => {
    const { result } = renderHook(() => useSelectionContext(), { wrapper: wrap });
    act(() => result.current!.publishSelection([asNodeId('a')], ['rect']));
    expect(result.current!.kinds).toEqual(['rect']);
    act(() => result.current!.publishSelection([asNodeId('a')]));
    expect(result.current!.kinds).toBeUndefined();
  });
});

describe('SelectionContextProvider re-render gating', () => {
  it('does not bump the context value when republished with content-equal ids', () => {
    const { result } = renderHook(() => useSelectionContext(), { wrapper: wrap });
    act(() => result.current!.publishSelection([asNodeId('a'), asNodeId('b')]));
    const valueAfterFirst = result.current;
    const selectionRef = result.current!.selection;
    // Republish with a fresh array reference but identical contents.
    act(() => result.current!.publishSelection([asNodeId('a'), asNodeId('b')]));
    // Selection array reference is preserved (no setState fired) so the
    // context value object is also unchanged — consumers selecting on
    // either reference avoid a re-render.
    expect(result.current).toBe(valueAfterFirst);
    expect(result.current!.selection).toBe(selectionRef);
  });

  it('publishes a kind change while the ids stay equal', () => {
    const { result } = renderHook(() => useSelectionContext(), { wrapper: wrap });
    act(() => result.current!.publishSelection([asNodeId('a')], ['rect']));
    act(() => result.current!.publishSelection([asNodeId('a')], ['path']));
    expect(result.current!.kinds).toEqual(['path']);
  });
});

describe('usePublishSelection', () => {
  it('publishes ids into the surrounding provider', () => {
    function Publisher({ ids }: { ids: NodeId[] }) {
      usePublishSelection(ids);
      return null;
    }
    function Reader({ onCtx }: { onCtx: (sel: readonly NodeId[]) => void }) {
      const ctx = useSelectionContext();
      onCtx(ctx?.selection ?? []);
      return null;
    }
    let last: readonly NodeId[] = [];
    const { rerender } = render(
      <SelectionContextProvider>
        <Publisher ids={[asNodeId('x')]} />
        <Reader onCtx={(s) => { last = s; }} />
      </SelectionContextProvider>,
    );
    expect(last).toEqual([asNodeId('x')]);
    rerender(
      <SelectionContextProvider>
        <Publisher ids={[asNodeId('x'), asNodeId('y')]} />
        <Reader onCtx={(s) => { last = s; }} />
      </SelectionContextProvider>,
    );
    expect(last).toEqual([asNodeId('x'), asNodeId('y')]);
  });

  it('publishes kinds when supplied', () => {
    function Publisher({ ids, kinds }: { ids: NodeId[]; kinds?: (string | undefined)[] }) {
      usePublishSelection(ids, kinds);
      return null;
    }
    function Reader({ onCtx }: { onCtx: (k: readonly (string | undefined)[] | undefined) => void }) {
      const ctx = useSelectionContext();
      onCtx(ctx?.kinds);
      return null;
    }
    let lastKinds: readonly (string | undefined)[] | undefined;
    render(
      <SelectionContextProvider>
        <Publisher ids={[asNodeId('a'), asNodeId('b')]} kinds={['rect', 'path']} />
        <Reader onCtx={(k) => { lastKinds = k; }} />
      </SelectionContextProvider>,
    );
    expect(lastKinds).toEqual(['rect', 'path']);
  });

  it('is a no-op outside any provider', () => {
    function Publisher() {
      usePublishSelection([asNodeId('z')]);
      return <div>ok</div>;
    }
    // Must not throw.
    expect(() => render(<Publisher />)).not.toThrow();
  });
});

describe('usePublishSelection effect stability', () => {
  it('does not republish stale ids when the provider state changes elsewhere', () => {
    function Publisher() {
      usePublishSelection([asNodeId('a')]);
      return null;
    }
    let ctx: ReturnType<typeof useSelectionContext> = null;
    function Reader() {
      ctx = useSelectionContext();
      return null;
    }
    render(
      <SelectionContextProvider>
        <Publisher />
        <Reader />
      </SelectionContextProvider>,
    );
    expect(ctx!.selection).toEqual(['a']);
    // Another owner publishes a different selection. The publisher's effect
    // must not refire and stomp it back to ['a'].
    act(() => ctx!.publishSelection([asNodeId('b')]));
    expect(ctx!.selection).toEqual(['b']);
  });
});

describe('usePublishSelection — unmount', () => {
  function Publisher({ ids }: { ids: readonly NodeId[] }): ReactNode {
    usePublishSelection(ids);
    return null;
  }
  function Reader({ onRead }: { onRead: (ids: readonly NodeId[]) => void }): ReactNode {
    onRead(useSelectionContext()!.selection);
    return null;
  }

  it('clears the selection a canvas published when that canvas goes away', () => {
    let seen: readonly NodeId[] = [];
    const tree = (mounted: boolean) => (
      <SelectionContextProvider>
        {mounted ? <Publisher ids={[asNodeId('a'), asNodeId('b')]} /> : null}
        <Reader onRead={(ids) => { seen = ids; }} />
      </SelectionContextProvider>
    );
    const { rerender } = render(tree(true));
    expect(seen).toEqual(['a', 'b']);
    rerender(tree(false));
    expect(seen).toEqual([]);
  });

  it('leaves the slot alone when another canvas has published since', () => {
    let seen: readonly NodeId[] = [];
    const tree = (first: boolean) => (
      <SelectionContextProvider>
        {first ? <Publisher ids={[asNodeId('a')]} /> : null}
        <Publisher ids={[asNodeId('z')]} />
        <Reader onRead={(ids) => { seen = ids; }} />
      </SelectionContextProvider>
    );
    const { rerender } = render(tree(true));
    expect(seen).toEqual(['z']);
    rerender(tree(false));
    expect(seen).toEqual(['z']);
  });
});
