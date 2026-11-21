import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEditDraft } from './useEditDraft';

describe('useEditDraft', () => {
  it('shows the draft of a commit-only edit over the value it began on', () => {
    const { result } = renderHook(({ value }) => useEditDraft(value, {}), { initialProps: { value: 5 } });
    act(() => result.current.onInput(8));
    expect(result.current.shown).toBe(8);
  });

  it('drops an abandoned draft once the value moves, so a return to where it began shows that value', () => {
    const { result, rerender } = renderHook(({ value }) => useEditDraft(value, {}), { initialProps: { value: 5 } });
    act(() => result.current.onInput(8));
    rerender({ value: 6 });
    expect(result.current.shown).toBe(6);
    rerender({ value: 5 });
    expect(result.current.shown).toBe(5);
  });

  it('keeps the draft over a value rebuilt equal each render', () => {
    const { result, rerender } = renderHook(({ value }) => useEditDraft(value, {}), { initialProps: { value: { a: 1 } } });
    act(() => result.current.onInput({ a: 2 }));
    rerender({ value: { a: 1 } });
    expect(result.current.shown).toEqual({ a: 2 });
  });
});
