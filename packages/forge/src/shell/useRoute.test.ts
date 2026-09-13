import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRoute, useRoute } from './useRoute';

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('readRoute', () => {
  it('reads the story id from a #/<id> hash', () => {
    history.replaceState(null, '', '/#/kit-button--primary');
    expect(readRoute()).toBe('kit-button--primary');
  });

  it('is null for a hash in any other form', () => {
    history.replaceState(null, '', '/#kit-button--primary');
    expect(readRoute()).toBeNull();
    history.replaceState(null, '', '/#/');
    expect(readRoute()).toBeNull();
  });
});

describe('useRoute', () => {
  it('follows the hash as it changes', async () => {
    history.replaceState(null, '', '/#/a');
    const { result } = renderHook(() => useRoute());
    expect(result.current[0]).toBe('a');
    act(() => {
      location.hash = '#/b';
    });
    await waitFor(() => expect(result.current[0]).toBe('b'));
  });

  it('sets the hash to a new id', async () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current[0]).toBeNull();
    act(() => result.current[1]('kit-button--ghost'));
    expect(location.hash).toBe('#/kit-button--ghost');
    await waitFor(() => expect(result.current[0]).toBe('kit-button--ghost'));
  });

  it('replaces the entry rather than adding one when the id is already current', () => {
    history.replaceState(null, '', '/#/a');
    const replace = vi.spyOn(history, 'replaceState');
    const { result } = renderHook(() => useRoute());
    act(() => result.current[1]('a'));
    expect(replace).toHaveBeenCalledWith(null, '', '#/a');
    expect(location.hash).toBe('#/a');
  });
});
