import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePolygonTool } from './polygon';
import { useStarTool } from './star';

describe('polygon and star tool options', () => {
  it('usePolygonTool shows the label it is given', () => {
    const { result } = renderHook(() => usePolygonTool({ label: 'Hexagon' }));
    expect(result.current.presentation?.label).toBe('Hexagon');
  });

  it('useStarTool shows the label it is given', () => {
    const { result } = renderHook(() => useStarTool({ label: 'Burst' }));
    expect(result.current.presentation?.label).toBe('Burst');
  });

  it('useStarTool inserts with the innerRatio of the latest render', () => {
    const { result, rerender } = renderHook(
      ({ innerRatio }: { innerRatio: number }) => useStarTool({ innerRatio }),
      { initialProps: { innerRatio: 0.5 } },
    );
    rerender({ innerRatio: 0.2 });
    const insert = (result.current.bindings ?? []).find((b) => b.actionId === 'insert');
    const params = insert?.opts?.params as () => { innerRadiusRatio: number };
    expect(params().innerRadiusRatio).toBe(0.2);
  });
});
