import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useValueChanges } from './useValueChanges';

describe('useValueChanges', () => {
  it('measures each report from the last one until the component renders again, then from what it shows', () => {
    const { result, rerender } = renderHook(({ on }) => useValueChanges(on), { initialProps: { on: ['a', 'b', 'c'] } });
    const changesOf = result.current;
    expect([...changesOf(['b'])]).toEqual([['a', false], ['c', false]]);
    // A second step through the same handler, before a render: only what it moves.
    expect([...changesOf(['b', 'c'])]).toEqual([['c', true]]);
    rerender({ on: ['b'] });
    expect([...result.current(['a', 'b'])]).toEqual([['a', true]]);
  });
});
