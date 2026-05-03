// src/tools/useTools.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTools } from './useTools';
import { defineTool } from './defineTool';

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
    const hand = defineTool({ id: 'hand', modifier: 'space' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select: defineTool({ id: 'select' }), hand } }),
    );

    expect(result.current.modifierEngaged).toBe(null);
    act(() => result.current.engageModifier('hand'));
    expect(result.current.modifierEngaged).toBe('hand');
    act(() => result.current.disengageModifier());
    expect(result.current.modifierEngaged).toBe(null);
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
        alwaysOn: [del, nudge],
      }),
    );

    expect(result.current.alwaysOn.map((t) => t.id)).toEqual(['delete', 'nudge']);
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

  it('engageModifier is a no-op while a gesture is in flight', () => {
    const select = defineTool({
      id: 'select',
      drag: { onStart: () => 'claim' },
    });
    const hand = defineTool({ id: 'hand', modifier: 'space' });
    const { result } = renderHook(() =>
      useTools({ active: 'select', registry: { select, hand } }),
    );
    const d = result.current.dispatcher;

    d.onPointerDown(pointerEvent('pointerdown', { pointerId: 1 }));
    d.onPointerMove(pointerEvent('pointermove', { pointerId: 1, clientX: 50, clientY: 50 }));

    act(() => result.current.engageModifier('hand'));
    expect(result.current.modifierEngaged).toBe(null);
  });
});
