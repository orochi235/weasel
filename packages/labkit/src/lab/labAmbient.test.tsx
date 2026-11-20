import { act, renderHook } from '@testing-library/react';
import type { Contribution } from '@weasel-js/routing';
import { describe, expect, it } from 'vitest';
import { useLabAmbientHost } from './labAmbient';

const KEYMAP = [{ id: 'km' }] as unknown as readonly Contribution<never>[];

describe('useLabAmbientHost', () => {
  it('keeps an array installed twice until both installs are removed', () => {
    const { result } = renderHook(() => useLabAmbientHost());
    let first = () => {};
    let second = () => {};
    act(() => {
      first = result.current.host.install(KEYMAP);
      second = result.current.host.install(KEYMAP);
    });
    act(() => first());
    expect(result.current.entriesById.has('km')).toBe(true);
    act(() => first());
    expect(result.current.entriesById.has('km')).toBe(true);
    act(() => second());
    expect(result.current.entriesById.has('km')).toBe(false);
  });
});
