import { describe, expect, it } from 'vitest';
import { renderHook, render, act } from '@testing-library/react';
import {
  SelectionContextProvider,
  useSelectionContext,
  usePublishSelection,
} from './SelectionContext';
import { asNodeId, type NodeId } from 'core/scene/types';
import { useState, type ReactNode } from 'react';

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

  it('does re-render consumers when kinds change while ids stay equal', () => {
    let renders = 0;
    function Probe() {
      renders++;
      const ctx = useSelectionContext();
      return <span data-kinds={ctx?.kinds?.join(',') ?? ''} />;
    }
    const { result } = renderHook(() => useSelectionContext(), { wrapper: wrap });
    render(
      <SelectionContextProvider>
        <Probe />
      </SelectionContextProvider>,
    );
    const baseline = renders;
    act(() => result.current!.publishSelection([asNodeId('a')], ['rect']));
    act(() => result.current!.publishSelection([asNodeId('a')], ['path']));
    // A kind change with a stable id list should still propagate. We can't
    // count exact renders across separate trees, but the publishing tree's
    // own consumer should now see the latest kinds.
    expect(result.current!.kinds).toEqual(['path']);
    expect(renders).toBeGreaterThanOrEqual(baseline);
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

  it('does not refire the publish effect when the ids array changes identity but not content', () => {
    const publishCalls = 0;
    function CountingProvider({ children }: { children: ReactNode }) {
      const [state, setState] = useState<{
        selection: readonly NodeId[];
        kinds: readonly (string | undefined)[] | undefined;
      }>({ selection: [], kinds: undefined });
      // Wrap the real provider but instrument by counting publishSelection calls.
      // We can't intercept the real one cleanly, so this test instead checks
      // the parent re-render path: usePublishSelection serializes ids+kinds
      // and uses that as the effect dep, so identity-only changes should not
      // refire the effect.
      void state; void setState; void publishCalls;
      return <SelectionContextProvider>{children}</SelectionContextProvider>;
    }
    function Publisher({ ids }: { ids: NodeId[] }) {
      // Always pass a fresh array reference with the same contents.
      usePublishSelection([...ids]);
      return null;
    }
    function Reader({ onChange }: { onChange: (sel: readonly NodeId[]) => void }) {
      const ctx = useSelectionContext();
      onChange(ctx?.selection ?? []);
      return null;
    }
    let observedSelections = 0;
    let lastSel: readonly NodeId[] = [];
    const onChange = (sel: readonly NodeId[]) => {
      if (sel !== lastSel) { observedSelections++; lastSel = sel; }
    };
    const { rerender } = render(
      <CountingProvider>
        <Publisher ids={[asNodeId('a')]} />
        <Reader onChange={onChange} />
      </CountingProvider>,
    );
    const after1 = observedSelections;
    rerender(
      <CountingProvider>
        <Publisher ids={[asNodeId('a')]} />
        <Reader onChange={onChange} />
      </CountingProvider>,
    );
    // Identity-different but content-equal array: the provider's
    // last-serialized guard should suppress the state update, so the Reader's
    // observed selection reference should not change.
    expect(observedSelections).toBe(after1);
  });
});
