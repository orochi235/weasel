import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const calls = vi.hoisted(() => [] as { id: string; params: unknown; batch: string | null }[]);
const batching = vi.hoisted(() => ({ label: null as string | null }));
vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  useActionsRegistry: () => ({
    begin: (id: string, params: unknown) => ({ end: () => { calls.push({ id, params, batch: batching.label }); } }),
  }),
}));

import { usePaintSelection } from './usePaintSelection';

const scene = {
  batch: <T,>(label: string, fn: () => T): T => {
    batching.label = label;
    try { return fn(); } finally { batching.label = null; }
  },
};

describe('usePaintSelection', () => {
  it('paints both slots through setFill and setStroke inside one batch', () => {
    const { result } = renderHook(() => usePaintSelection(scene));
    const fill = { kind: 'solid' as const, color: '#000000' };
    result.current({ fill, stroke: null }, 'Swap fill and stroke');
    expect(calls).toEqual([
      { id: 'setFill', params: { paint: fill }, batch: 'Swap fill and stroke' },
      { id: 'setStroke', params: { paint: null }, batch: 'Swap fill and stroke' },
    ]);
  });
});
