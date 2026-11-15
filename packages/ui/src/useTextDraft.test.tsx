import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTextDraft } from './useTextDraft';

/** A caller previewing every keystroke into its own value, as the edit protocol lets one. */
function previewing(onChange: (next: string) => void, onInput = vi.fn()) {
  return renderHook(() => {
    const [value, setValue] = useState('a');
    return useTextDraft({
      value,
      onInput: (next) => {
        onInput(next);
        setValue(next);
      },
      onChange,
    });
  });
}

const blurTarget = { blur: () => {} } as unknown as EventTarget;

describe('useTextDraft', () => {
  it('commits what a previewing caller has already written back', () => {
    const onChange = vi.fn();
    const { result } = previewing(onChange);
    act(() => result.current.type('ab'));
    act(() => result.current.settle());
    expect(onChange).toHaveBeenCalledExactlyOnceWith('ab');
  });

  it('commits nothing when a previewing caller types back to where it began', () => {
    const onChange = vi.fn();
    const { result } = previewing(onChange);
    act(() => result.current.type('ab'));
    act(() => result.current.type('a'));
    act(() => result.current.settle());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('gives a previewing caller back the text it began from on Escape', () => {
    const onChange = vi.fn();
    const onInput = vi.fn();
    const { result } = previewing(onChange, onInput);
    act(() => result.current.type('ab'));
    act(() => result.current.keyDown({ key: 'Escape', target: blurTarget }));
    expect(onInput).toHaveBeenLastCalledWith('a');
    expect(onChange).not.toHaveBeenCalled();
  });
});
