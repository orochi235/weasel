import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ActionsRegistry } from '@weasel-js/routing';

let current: ActionsRegistry | null = null;
vi.mock('@weasel-js/routing/react', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useActionsRegistry: () => current,
  useOptionalDepRegistry: () => ({}),
}));

const { useViewportActions } = await import('./useViewportActions');
const { actionSetKeyOf, useActionSet } = await import('interactions/actions/useActionSet');
const { createTouchZoomAction } = await import('interactions/actions/defaults/touchZoom');

function fakeRegistry(): { reg: ActionsRegistry; ids: Set<string> } {
  const ids = new Set<string>();
  const reg = {
    register: (a: { id: string }) => { ids.add(a.id); return () => { ids.delete(a.id); }; },
    mute: () => () => {},
  } as unknown as ActionsRegistry;
  return { reg, ids };
}

describe('useViewportActions', () => {
  it('moves its actions to a new registry in scope', () => {
    const a = fakeRegistry();
    const b = fakeRegistry();
    current = a.reg;
    const { rerender } = renderHook(() => useViewportActions({ pan: true, zoom: true, touchZoom: false }));
    expect(a.ids.has('viewport.wheelPan')).toBe(true);
    current = b.reg;
    rerender();
    expect(a.ids.size).toBe(0);
    expect([...b.ids]).toEqual(expect.arrayContaining(['viewport.wheelPan', 'viewport.zoom']));
  });

  it('registers once a registry comes into scope', () => {
    current = null;
    const { rerender } = renderHook(() => useViewportActions({ pan: true, zoom: false, touchZoom: false }));
    const late = fakeRegistry();
    current = late.reg;
    rerender();
    expect(late.ids.has('viewport.wheelPan')).toBe(true);
  });

  it('puts a configured pinch zoom back on top when the standard set re-registers under the same ids', () => {
    // Newest registration answers, as the real registry's stack does.
    const stacks = new Map<string, object[]>();
    current = {
      register: (a: { id: string }) => {
        const stack = stacks.get(a.id) ?? [];
        stacks.set(a.id, [...stack, a]);
        return () => { stacks.set(a.id, (stacks.get(a.id) ?? []).filter((x) => x !== a)); };
      },
      mute: () => () => {},
    } as unknown as ActionsRegistry;
    const top = () => stacks.get('viewport.touchZoom')?.at(-1);
    const defaults = new Set<object>();
    const kitSet = () => { const a = createTouchZoomAction(); defaults.add(a); return [a]; };
    const { rerender } = renderHook(({ actions }) => {
      useActionSet(actions);
      useViewportActions({ pan: false, zoom: false, touchZoom: { min: 0.5, max: 2 }, rev: actionSetKeyOf(actions) });
    }, { initialProps: { actions: kitSet() } });
    expect(defaults.has(top()!)).toBe(false);
    rerender({ actions: kitSet() });
    expect(defaults.has(top()!)).toBe(false);
  });
});
