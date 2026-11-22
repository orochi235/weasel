import { act, renderHook } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { useOverAccess } from './over';

const over: PrefGroup = {
  name: 'Preferences',
  children: {
    view: {
      name: 'View',
      children: {
        grid: { kind: 'boolean', name: 'Show grid', description: '', default: true } as PrefLeaf,
      },
    },
  },
};

describe('useOverAccess', () => {
  it('keeps what an instrument writes outside a lab', () => {
    const { result } = renderHook(() => useOverAccess(over));
    expect(result.current!.read('view.grid')).toBe(true);
    act(() => result.current!.set('view.grid', false));
    expect(result.current!.read('view.grid')).toBe(false);
  });
});
