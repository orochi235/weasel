import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVelocityTracker } from './useVelocityTracker';

describe('useVelocityTracker', () => {
  it('returns zero velocity with no samples', () => {
    const { result } = renderHook(() => useVelocityTracker());
    expect(result.current.getVelocity()).toEqual({ vx: 0, vy: 0 });
  });

  it('returns zero velocity with one sample (need two for delta)', () => {
    const { result } = renderHook(() => useVelocityTracker());
    result.current.record(10, 5, 1000);
    expect(result.current.getVelocity()).toEqual({ vx: 0, vy: 0 });
  });

  it('computes average velocity over recorded samples', () => {
    const { result } = renderHook(() => useVelocityTracker());
    result.current.record(10, 4, 1000);
    result.current.record(10, 4, 1050);
    result.current.record(10, 4, 1100);
    // total dx=20, dy=8 over 100ms
    const v = result.current.getVelocity();
    expect(v.vx).toBeCloseTo(0.2);
    expect(v.vy).toBeCloseTo(0.08);
  });

  it('excludes samples older than 100ms', () => {
    const { result } = renderHook(() => useVelocityTracker());
    result.current.record(100, 100, 900);  // older than 100ms ago
    result.current.record(10, 4, 1050);
    result.current.record(10, 4, 1100);
    // only the last two count; total dx=10, dy=4 over 50ms
    const v = result.current.getVelocity();
    expect(v.vx).toBeCloseTo(0.2);
    expect(v.vy).toBeCloseTo(0.08);
  });

  it('reset clears all samples', () => {
    const { result } = renderHook(() => useVelocityTracker());
    result.current.record(10, 5, 1000);
    result.current.record(10, 5, 1050);
    result.current.reset();
    expect(result.current.getVelocity()).toEqual({ vx: 0, vy: 0 });
  });
});
