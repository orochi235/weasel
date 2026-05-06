// src/tools/useTools.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTools } from './useTools';
import { defineTool } from './defineTool';
import type { RenderLayer } from '../core/layers/render';

const mkLayer = (id: string): RenderLayer<unknown> => ({
  id, label: id, space: 'screen', draw: () => {},
});

function pointerEvent(type: string, init: Partial<PointerEventInit> = {}): PointerEvent {
  // jsdom doesn't implement PointerEvent; synthesize via Event + assign.
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

describe('useTools', () => {
  it('exposes active id and setActive', () => {
    const select = defineTool({ id: 'select' });
    const pen    = defineTool({ id: 'pen' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select, pen } }),
    );

    expect(result.current.active).toBe('select');
    act(() => result.current.setActive('pen'));
    expect(result.current.active).toBe('pen');
  });

  it('tracks modifier-slot engagement', () => {
    const hand = defineTool({ id: 'hand', hotkey: 'space' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select: defineTool({ id: 'select' }), hand } }),
    );

    expect(result.current.hotkeyEngaged).toBe(null);
    act(() => result.current.engageHotkey('hand'));
    expect(result.current.hotkeyEngaged).toBe('hand');
    act(() => result.current.disengageHotkey());
    expect(result.current.hotkeyEngaged).toBe(null);
  });

  it('throws when active id is not in registry', () => {
    expect(() =>
      renderHook(() =>
        useTools({ active: 'nope', registry: { select: defineTool({ id: 'select' }) } }),
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
    );

    expect(result.current.ambient.map((t) => t.id)).toEqual(['delete', 'nudge']);
  });

  it('explicit setActive cancels in-flight gesture', () => {
    const onCancel = vi.fn();
    const select = defineTool({
      id: 'select',
      drag: { onStart: () => 'claim', onCancel },
    });
    const pen = defineTool({ id: 'pen' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select, pen } }),
    );
    const d = result.current.dispatcher;

    d.onPointerDown(pointerEvent('pointerdown', { pointerId: 1 }));
    d.onPointerMove(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 50 }));
    expect(d.hasActiveGesture()).toBe(true);

    act(() => result.current.setActive('pen'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(d.hasActiveGesture()).toBe(false);
  });

  it('engageHotkey is a no-op while a gesture is in flight', () => {
    const select = defineTool({
      id: 'select',
      drag: { onStart: () => 'claim' },
    });
    const hand = defineTool({ id: 'hand', hotkey: 'space' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select, hand } }),
    );
    const d = result.current.dispatcher;

    d.onPointerDown(pointerEvent('pointerdown', { pointerId: 1 }));
    d.onPointerMove(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 50 }));

    act(() => result.current.engageHotkey('hand'));
    expect(result.current.hotkeyEngaged).toBe(null);
  });
});

describe('ToolsApi.getActiveOverlays', () => {
  it('returns overlay from active tool', () => {
    const a = defineTool({ id: 'a', overlay: mkLayer('a-ov') });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a } }));
    const out = result.current.getActiveOverlays();
    expect(out.map((l) => l.id)).toEqual(['a-ov']);
  });

  it('filters out tools with no overlay', () => {
    const a = defineTool({ id: 'a' });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a } }));
    expect(result.current.getActiveOverlays()).toEqual([]);
  });

  it('orders active, modifier, ambient (in registration order)', () => {
    const a = defineTool({ id: 'a', overlay: mkLayer('a-ov') });
    const m = defineTool({ id: 'm', hotkey: 'space', overlay: mkLayer('m-ov') });
    const w1 = defineTool({ id: 'w1', overlay: mkLayer('w1-ov') });
    const w2 = defineTool({ id: 'w2', overlay: mkLayer('w2-ov') });
    const { result, rerender } = renderHook(() =>
      useTools({ active: 'a', registry: { a, m }, ambient: [w1, w2] }),
    );
    act(() => { result.current.engageHotkey('m'); });
    rerender();
    expect(result.current.getActiveOverlays().map((l) => l.id))
      .toEqual(['a-ov', 'm-ov', 'w1-ov', 'w2-ov']);
  });

  it('omits modifier overlay when not engaged', () => {
    const a = defineTool({ id: 'a', overlay: mkLayer('a-ov') });
    const m = defineTool({ id: 'm', hotkey: 'space', overlay: mkLayer('m-ov') });
    const { result } = renderHook(() => useTools({ active: 'a', registry: { a, m } }));
    expect(result.current.getActiveOverlays().map((l) => l.id)).toEqual(['a-ov']);
  });
});
