import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRoute, readRouteParams, replaceRouteParams, useRoute } from './useRoute';

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

describe('replaceRouteParams', () => {
  it('rewrites the params in place, keeping the story and the history entry', () => {
    history.replaceState({ forgeRoute: { step: 3, inPlace: false } }, '', '/#/a?t=1');
    const entries = history.length;
    replaceRouteParams((params) => ({ ...params, label: 'Go' }));
    expect(location.hash).toBe('#/a?t=1&label=Go');
    expect(readRouteParams()).toEqual({ t: '1', label: 'Go' });
    expect(readRoute()).toBe('a');
    expect(history.length).toBe(entries);
    expect(history.state).toEqual({ forgeRoute: { step: 3, inPlace: false } });
  });

  it('does nothing when no story is named', () => {
    history.replaceState(null, '', '/#elsewhere');
    replaceRouteParams(() => ({ label: 'Go' }));
    expect(location.hash).toBe('#elsewhere');
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

  it('keeps the params when the id is already current, and drops them for another id', () => {
    history.replaceState(null, '', '/#/a?label=Go&t=1');
    const { result } = renderHook(() => useRoute());
    act(() => result.current[1]('a'));
    expect(location.hash).toBe('#/a?label=Go&t=1');
    act(() => result.current[1]('b'));
    expect(location.hash).toBe('#/b');
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
