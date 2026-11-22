import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ActionsRegistry } from '@weasel-js/routing';

let current: ActionsRegistry | null = null;
vi.mock('@weasel-js/routing/react', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useActionsRegistry: () => current,
}));

const { useViewportActions } = await import('./useViewportActions');

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
});
