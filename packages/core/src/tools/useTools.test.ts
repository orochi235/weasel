// src/tools/useTools.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useTools } from './useTools';
import { defineTool } from './defineTool';
import type { RenderLayer } from 'core/layers/render';
import { ActiveToolContextProvider, useActiveToolContext } from '../interactions/actions/activeToolContext';

const mkLayer = (id: string): RenderLayer<unknown> => ({
  id, label: id, space: 'screen', draw: () => [],
});

/** Wrapper that provides ActiveToolContextProvider for all useTools tests. */
function makeWrapper(initialActive = 'select') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ActiveToolContextProvider, { initialActive, children });
  };
}

describe('useTools', () => {
  it('exposes active id and setActive', () => {
    const select = defineTool({ id: 'select' });
    const pen    = defineTool({ id: 'pen' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select, pen } }),
      { wrapper: makeWrapper('select') },
    );

    expect(result.current.active).toBe('select');
    act(() => result.current.setActive('pen'));
    expect(result.current.active).toBe('pen');
  });

  it('tracks modifier-slot engagement', () => {
    const hand = defineTool({ id: 'hand', hotkey: 'space' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select: defineTool({ id: 'select' }), hand } }),
      { wrapper: makeWrapper('select') },
    );

    expect(result.current.hotkeyEngaged).toBe(null);
    act(() => result.current.engageHotkey('hand'));
    expect(result.current.hotkeyEngaged).toBe('hand');
    act(() => result.current.disengageHotkey());
    expect(result.current.hotkeyEngaged).toBe(null);
  });

  it('picks up a tool added to the registry after mount', () => {
    const select = defineTool({ id: 'select' });
    const rect = defineTool({ id: 'rect' });
    const { result, rerender } = renderHook(
      ({ withRect }: { withRect: boolean }) =>
        useTools({
          active: 'select',
          registry: withRect ? { select, rect } : { select },
        }),
      { wrapper: makeWrapper('select'), initialProps: { withRect: false } },
    );

    expect(Object.keys(result.current.registry)).toEqual(['select']);
    rerender({ withRect: true });
    expect(Object.keys(result.current.registry).sort()).toEqual(['rect', 'select']);
  });

  it('keeps one ToolsApi identity across renders that rebuild an equivalent registry', () => {
    const select = defineTool({ id: 'select' });
    const { result, rerender } = renderHook(
      () => useTools({ active: 'select', registry: { select } }),
      { wrapper: makeWrapper('select') },
    );

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('throws when active id is not in registry', () => {
    expect(() =>
      renderHook(() =>
        useTools({ active: 'nope', registry: { select: defineTool({ id: 'select' }) } }),
        { wrapper: makeWrapper('select') },
      ),
    ).toThrow(/registry/i);
  });

  it('exposes always-on tool list', () => {
    const del = defineTool({ id: 'delete' });
    const nudge = defineTool({ id: 'nudge' });
    const { result } = renderHook(() =>
      useTools({
        active: 'select',
        registry: { select: defineTool({ id: 'select' }) },
        ambient: [del, nudge],
      }),
      { wrapper: makeWrapper('select') },
    );

    expect(result.current.ambient.map((t) => t.id)).toEqual(['delete', 'nudge']);
  });

  // `setActive` used to cancel the in-flight gesture and `engageHotkey` used
  // to lock out mid-gesture, both by reaching into the dispatcher `useTools`
  // owned. Input belongs entirely to `useGestureDispatcher` now: it watches
  // the active tool and cancels in-flight handles itself, covered by
  // "in-flight ongoing handles get onEnd('cancel') when active tool changes"
  // in `useGestureDispatcher.test.tsx`.
});

describe('ToolsApi.getActiveOverlays', () => {
  it('returns overlay from active tool', () => {
    const aOverlay = mkLayer('a-ov');
    const a = defineTool({ id: 'a', overlay: aOverlay });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a } }),
      { wrapper: makeWrapper('a') });
    const out = result.current.getActiveOverlays();
    expect(out.map((l) => l.id)).toEqual(['a-ov']);
  });

  it('filters out tools with no overlay', () => {
    const a = defineTool({ id: 'a' });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a } }),
      { wrapper: makeWrapper('a') });
    expect(result.current.getActiveOverlays()).toEqual([]);
  });

  it('orders active, modifier, ambient (in registration order)', () => {
    const aOverlay = mkLayer('a-ov');
    const mOverlay = mkLayer('m-ov');
    const w1Overlay = mkLayer('w1-ov');
    const w2Overlay = mkLayer('w2-ov');
    const a = defineTool({ id: 'a', overlay: aOverlay });
    const m = defineTool({ id: 'm', hotkey: 'space', overlay: mOverlay });
    const w1 = defineTool({ id: 'w1', overlay: w1Overlay });
    const w2 = defineTool({ id: 'w2', overlay: w2Overlay });
    const { result, rerender } = renderHook(() =>
      useTools({ active: 'a', registry: { a, m }, ambient: [w1, w2] }),
      { wrapper: makeWrapper('a') },
    );
    act(() => { result.current.engageHotkey('m'); });
    rerender();
    expect(result.current.getActiveOverlays().map((l) => l.id))
      .toEqual(['a-ov', 'm-ov', 'w1-ov', 'w2-ov']);
  });

  it('omits modifier overlay when not engaged', () => {
    const aOverlay = mkLayer('a-ov');
    const mOverlay = mkLayer('m-ov');
    const a = defineTool({ id: 'a', overlay: aOverlay });
    const m = defineTool({ id: 'm', hotkey: 'space', overlay: mOverlay });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a, m } }),
      { wrapper: makeWrapper('a') });
    expect(result.current.getActiveOverlays().map((l) => l.id)).toEqual(['a-ov']);
  });

  it('flattens an array-valued overlay in declaration order', () => {
    const a = defineTool({ id: 'a', overlay: [mkLayer('a-1'), mkLayer('a-2')] });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a } }),
      { wrapper: makeWrapper('a') });
    expect(result.current.getActiveOverlays().map((l) => l.id)).toEqual(['a-1', 'a-2']);
  });

  it('partitions by overlayPosition, defaulting to top', () => {
    const a = defineTool({ id: 'a', overlay: mkLayer('a-ov') });
    const b = defineTool({
      id: 'b',
      overlay: mkLayer('b-ov'),
      overlayPosition: 'before-selection',
    });
    const { result } = renderHook(() =>
      useTools({ active: 'a', registry: { a }, ambient: [b] }),
      { wrapper: makeWrapper('a') },
    );
    expect(result.current.getActiveOverlays().map((l) => l.id)).toEqual(['a-ov']);
    expect(result.current.getActiveOverlays('before-selection').map((l) => l.id))
      .toEqual(['b-ov']);
    expect(result.current.getActiveOverlays('after-selection')).toEqual([]);
  });
});

describe('useTools (context-backed)', () => {
  it('throws when no ActiveToolContextProvider is in scope', () => {
    const rect = defineTool({ id: 'rect' });
    expect(() =>
      renderHook(() =>
        useTools({ active: 'rect', registry: { rect } }),
      ),
    ).toThrow(/ActiveToolContextProvider/);
  });

  it('opts.active populates context on first mount when context is default', async () => {
    const { result } = renderHook(
      () => {
        useTools({ active: 'rect', registry: { rect: defineTool({ id: 'rect' }), select: defineTool({ id: 'select' }) } });
        return useActiveToolContext();
      },
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(ActiveToolContextProvider, { initialActive: 'select', children }),
      },
    );
    // Allow the microtask to fire and flush the resulting state update.
    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(r));
    });
    // After the microtask flush the context should have been updated to 'rect'
    expect(result.current.active).toBe('rect');
  });

  it('tools.setActive writes to context', () => {
    let ctxValue: ReturnType<typeof useActiveToolContext> | undefined;
    const { result } = renderHook(
      () => {
        const api = useTools({ active: 'select', registry: { select: defineTool({ id: 'select' }), rect: defineTool({ id: 'rect' }) } });
        ctxValue = useActiveToolContext();
        return api;
      },
      { wrapper: makeWrapper('select') },
    );
    act(() => { result.current.setActive('rect'); });
    expect(ctxValue!.active).toBe('rect');
  });

  it('tools.engageHotkey pushes to context.hotkeyStack', () => {
    let ctxValue: ReturnType<typeof useActiveToolContext> | undefined;
    const { result } = renderHook(
      () => {
        const api = useTools({ active: 'select', registry: { select: defineTool({ id: 'select' }), hand: defineTool({ id: 'hand', hotkey: 'space' }) } });
        ctxValue = useActiveToolContext();
        return api;
      },
      { wrapper: makeWrapper('select') },
    );
    act(() => { result.current.engageHotkey('hand'); });
    expect(ctxValue!.hotkeyStack).toEqual(['hand']);
    expect(result.current.hotkeyEngaged).toBe('hand');
  });

  it('tools.disengageHotkey pops from stack', () => {
    let ctxValue: ReturnType<typeof useActiveToolContext> | undefined;
    const { result } = renderHook(
      () => {
        const api = useTools({ active: 'select', registry: { select: defineTool({ id: 'select' }), hand: defineTool({ id: 'hand', hotkey: 'space' }) } });
        ctxValue = useActiveToolContext();
        return api;
      },
      { wrapper: makeWrapper('select') },
    );
    act(() => { result.current.engageHotkey('hand'); });
    act(() => { result.current.disengageHotkey(); });
    expect(ctxValue!.hotkeyStack).toEqual([]);
    expect(result.current.hotkeyEngaged).toBeNull();
  });
});
