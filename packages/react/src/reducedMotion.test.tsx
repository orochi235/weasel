import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { stubReducedMotion } from './testing/stubReducedMotion';
import { prefersReducedMotion, usePrefersReducedMotion } from './reducedMotion';

afterEach(() => { vi.unstubAllGlobals(); });

describe('prefersReducedMotion', () => {
  it('answers the media query, and false with no matchMedia', () => {
    stubReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('usePrefersReducedMotion', () => {
  it('follows a change to the preference', () => {
    const set = stubReducedMotion(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => set(true));
    expect(result.current).toBe(true);
  });
});
